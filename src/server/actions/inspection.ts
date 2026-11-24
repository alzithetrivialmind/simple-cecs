"use server";

import { db } from "@/lib/db";
import { toUserMessage } from "@/lib/errors";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { INPUT_ROLES } from "@/lib/roles";
import {
  generateInspectionCode,
  generateBreakdownCode,
  generateWorkOrderCode,
} from "@/lib/numbering";
import { syncEquipmentStatus } from "@/server/services/equipment-status";
import { createAuditLog } from "@/lib/audit";
import {
  inspectionSchema,
  InspectionInput,
} from "@/lib/validations/inspection";
import {
  AttachmentEntity,
  BreakdownStatus,
  InspectionResult,
  Priority,
  Prisma,
  WorkOrderStatus,
  WorkOrderType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface GetInspectionsParams {
  result?: InspectionResult | "ALL";
  equipmentId?: string;
  search?: string;
  limit?: number;
}

export async function getInspections(params?: GetInspectionsParams) {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const where: Prisma.InspectionWhereInput = {
    deletedAt: null,
    ...(params?.result && params.result !== "ALL" ? { result: params.result } : {}),
    ...(params?.equipmentId ? { equipmentId: params.equipmentId } : {}),
  };

  if (params?.search) {
    const s = params.search.toLowerCase();
    where.OR = [
      { code: { contains: s, mode: "insensitive" } },
      { equipment: { name: { contains: s, mode: "insensitive" } } },
      { equipment: { code: { contains: s, mode: "insensitive" } } },
      { inspectionType: { name: { contains: s, mode: "insensitive" } } },
      { inspector: { name: { contains: s, mode: "insensitive" } } },
      { certificateNumber: { contains: s, mode: "insensitive" } },
    ];
  }

  return db.inspection.findMany({
    where,
    take: params?.limit ?? 100,
    orderBy: { inspectionDate: "desc" },
    include: {
      equipment: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          location: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      },
      inspectionType: {
        select: {
          id: true,
          name: true,
        },
      },
      inspector: {
        select: {
          id: true,
          name: true,
          nik: true,
          avatarUrl: true,
        },
      },
    },
  });
}

export async function getInspectionById(id: string) {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const inspection = await db.inspection.findUnique({
    where: { id },
    include: {
      equipment: {
        include: {
          department: true,
          location: true,
        },
      },
      inspectionType: true,
      inspector: {
        select: { id: true, name: true, nik: true, role: true, avatarUrl: true },
      },
    },
  });

  if (!inspection) return null;

  const attachments = await db.attachment.findMany({
    where: {
      entityType: AttachmentEntity.INSPECTION,
      entityId: id,
    },
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return {
    ...inspection,
    attachments,
  };
}

export async function createInspection(data: InspectionInput) {
  const user = await requireRole(INPUT_ROLES);

  const validation = inspectionSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input inspeksi tidak valid",
    };
  }

  const {
    equipmentId,
    inspectionTypeId,
    inspectorId,
    inspectionDate,
    hourMeter,
    result,
    finding,
    recommendation,
    certificateNumber,
    validUntil,
    attachmentKey,
    attachmentName,
    attachmentSize,
    attachmentMime,
  } = validation.data;

  const equipment = await db.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, code: true, name: true, currentHourMeter: true, deletedAt: true },
  });

  if (!equipment || equipment.deletedAt) {
    return { success: false, error: "Unit equipment tidak ditemukan." };
  }

  // VALIDATION: Hour meter cannot decrease
  if (hourMeter < equipment.currentHourMeter) {
    return {
      success: false,
      error: `Hour meter (${hourMeter} Jam) tidak boleh lebih kecil dari data saat ini (${equipment.currentHourMeter} Jam).`,
    };
  }

  try {
    const transactionResult = await db.$transaction(async (tx) => {
      // 1. Generate Inspection Code
      const code = await generateInspectionCode(tx);

      // 2. Create Inspection
      const ins = await tx.inspection.create({
        data: {
          code,
          equipmentId,
          inspectionTypeId,
          inspectorId: inspectorId || user.id,
          inspectionDate,
          hourMeter,
          result,
          finding: finding || null,
          recommendation: recommendation || null,
          certificateNumber: certificateNumber || null,
          validUntil: validUntil || null,
        },
      });

      // 3. Record Attachment if certificate / photo uploaded
      if (attachmentKey) {
        await tx.attachment.create({
          data: {
            entityType: AttachmentEntity.INSPECTION,
            entityId: ins.id,
            kind: certificateNumber ? "CERTIFICATE" : "PHOTO",
            fileKey: attachmentKey,
            fileName: attachmentName || "inspection-doc.pdf",
            mimeType: attachmentMime || "application/pdf",
            sizeBytes: attachmentSize || 0,
            uploadedById: user.id,
          },
        });
      }

      // 4. Record HourMeterLog
      await tx.hourMeterLog.create({
        data: {
          equipmentId,
          readingDate: inspectionDate,
          hourMeter,
          source: "INSPECTION",
          remark: `Inspeksi berkala #${code} (${result})`,
          createdById: user.id,
        },
      });

      // 5. Update equipment currentHourMeter if greater
      if (hourMeter > equipment.currentHourMeter) {
        await tx.equipment.update({
          where: { id: equipmentId },
          data: { currentHourMeter: hourMeter },
        });
      }

      let createdBreakdown = null;

      // 6. CRITICAL RULE: If FAIL, automatically trigger BreakdownRequest (HIGH) & WorkOrder
      if (result === InspectionResult.FAIL) {
        const bdCode = await generateBreakdownCode(tx);
        createdBreakdown = await tx.breakdownRequest.create({
          data: {
            code: bdCode,
            equipmentId,
            reportedById: user.id,
            reportedAt: inspectionDate,
            problem: `[FAIL INSPEKSI #${code}] ${finding || "Temuan kegagalan fungsi saat inspeksi teknis."}`,
            priority: Priority.HIGH,
            hourMeter,
            status: BreakdownStatus.CONVERTED,
          },
        });

        const woCode = await generateWorkOrderCode(tx);
        const workOrder = await tx.workOrder.create({
          data: {
            code: woCode,
            equipmentId,
            breakdownRequestId: createdBreakdown.id,
            type: WorkOrderType.INSPECTION_FOLLOW_UP,
            status: WorkOrderStatus.OPEN,
          },
        });

        await tx.workOrderStatusHistory.create({
          data: {
            workOrderId: workOrder.id,
            fromStatus: null,
            toStatus: WorkOrderStatus.OPEN,
            changedById: user.id,
            note: `Work Order otomatis dibuat dari hasil inspeksi #${code} yang berstatus FAIL.`,
          },
        });

        // Sync equipment status -> BREAKDOWN
        await syncEquipmentStatus(equipmentId, tx);
      }

      // 7. Audit Log
      await createAuditLog({
        userId: user.id,
        action: "CREATE",
        entity: "Inspection",
        entityId: ins.id,
        newValue: `Inspeksi #${code} (${result}) dicatat untuk unit ${equipment.code}`,
      });

      return { inspection: ins, breakdown: createdBreakdown };
    });

    revalidatePath("/inspection");
    revalidatePath("/equipment");
    revalidatePath(`/equipment/${equipmentId}`);
    revalidatePath("/breakdown");
    revalidatePath("/work-order");
    revalidatePath("/dashboard");

    return {
      success: true,
      inspectionId: transactionResult.inspection.id,
      code: transactionResult.inspection.code,
      createdBreakdown: transactionResult.breakdown?.code || null,
    };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menyimpan data inspeksi.");
    return { success: false, error: msg };
  }
}

export async function deleteInspection(id: string) {
  const admin = await requireRole(["ADMIN"]);

  const existing = await db.inspection.findUnique({
    where: { id },
    select: { id: true, code: true, equipmentId: true, deletedAt: true },
  });

  if (!existing || existing.deletedAt) {
    return { success: false, error: "Inspeksi tidak ditemukan atau sudah dihapus." };
  }

  try {
    await db.inspection.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await createAuditLog({
      userId: admin.id,
      action: "DELETE",
      entity: "Inspection",
      entityId: id,
      reason: "Penghapusan oleh Admin",
      details: `Inspeksi #${existing.code} dihapus.`,
    });

    revalidatePath("/inspection");
    revalidatePath(`/equipment/${existing.equipmentId}`);
    revalidatePath("/dashboard");
    
    return { success: true };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menghapus inspeksi.");
    return { success: false, error: msg };
  }
}

