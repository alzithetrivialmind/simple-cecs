"use server";

import { db } from "@/lib/db";
import { toUserMessage } from "@/lib/errors";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { generateBreakdownCode, generateWorkOrderCode } from "@/lib/numbering";
import { syncEquipmentStatus } from "@/server/services/equipment-status";
import { createAuditLog } from "@/lib/audit";
import {
  breakdownRequestSchema,
  BreakdownRequestInput,
} from "@/lib/validations/breakdown";
import {
  AttachmentEntity,
  BreakdownStatus,
  WorkOrderStatus,
  WorkOrderType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function createBreakdownRequest(data: BreakdownRequestInput) {
  const user = await requireAuth();

  const validation = breakdownRequestSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input data tidak valid.",
    };
  }

  const {
    equipmentId,
    problem,
    priority,
    hourMeter,
    reportedAt,
    photoKey,
    photoName,
    photoSize,
    photoMime,
  } = validation.data;

  const equipment = await db.equipment.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      code: true,
      name: true,
      currentHourMeter: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!equipment || equipment.deletedAt) {
    return { success: false, error: "Unit equipment tidak ditemukan atau telah dihapus." };
  }

  const finalHourMeter =
    hourMeter !== undefined && hourMeter !== null
      ? hourMeter
      : equipment.currentHourMeter;

  // VALIDATION: Hour meter cannot decrease
  if (finalHourMeter < equipment.currentHourMeter) {
    return {
      success: false,
      error: `Hour meter yang dilaporkan (${finalHourMeter} Jam) tidak boleh lebih kecil dari data saat ini (${equipment.currentHourMeter} Jam).`,
    };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // 1. Generate BD Code
      const bdCode = await generateBreakdownCode(tx);

      // 2. Create BreakdownRequest
      const breakdown = await tx.breakdownRequest.create({
        data: {
          code: bdCode,
          equipmentId,
          reportedById: user.id,
          reportedAt: reportedAt || new Date(),
          problem,
          priority,
          hourMeter: finalHourMeter,
          status: BreakdownStatus.CONVERTED,
        },
      });

      // 3. Generate WO Code
      const woCode = await generateWorkOrderCode(tx);

      // 4. Create WorkOrder (CORRECTIVE)
      const workOrder = await tx.workOrder.create({
        data: {
          code: woCode,
          equipmentId,
          breakdownRequestId: breakdown.id,
          type: WorkOrderType.CORRECTIVE,
          status: WorkOrderStatus.OPEN,
        },
      });

      // 5. Create WorkOrderStatusHistory
      await tx.workOrderStatusHistory.create({
        data: {
          workOrderId: workOrder.id,
          fromStatus: null,
          toStatus: WorkOrderStatus.OPEN,
          changedById: user.id,
          note: `Work Order otomatis dibuat dari laporan breakdown #${bdCode}`,
        },
      });

      // 6. Record Attachment if photo uploaded
      if (photoKey) {
        await tx.attachment.create({
          data: {
            entityType: AttachmentEntity.BREAKDOWN,
            entityId: breakdown.id,
            kind: "PHOTO",
            fileKey: photoKey,
            fileName: photoName || "breakdown-photo.jpg",
            mimeType: photoMime || "image/jpeg",
            sizeBytes: photoSize || 0,
            uploadedById: user.id,
          },
        });

        // Also attach to the Work Order for reference
        await tx.attachment.create({
          data: {
            entityType: AttachmentEntity.WORK_ORDER,
            entityId: workOrder.id,
            kind: "PHOTO_BEFORE",
            fileKey: photoKey,
            fileName: photoName || "breakdown-photo.jpg",
            mimeType: photoMime || "image/jpeg",
            sizeBytes: photoSize || 0,
            uploadedById: user.id,
          },
        });

        // Also attach to the Equipment master gallery
        await tx.attachment.create({
          data: {
            entityType: AttachmentEntity.EQUIPMENT,
            entityId: equipmentId,
            kind: "PHOTO",
            fileKey: photoKey,
            fileName: `Foto Kerusakan #${bdCode} - ${photoName || "kendala.jpg"}`,
            mimeType: photoMime || "image/jpeg",
            sizeBytes: photoSize || 0,
            uploadedById: user.id,
          },
        });
      }

      // 7. Record HourMeterLog if greater than current
      if (finalHourMeter > equipment.currentHourMeter) {
        await tx.hourMeterLog.create({
          data: {
            equipmentId,
            readingDate: reportedAt || new Date(),
            hourMeter: finalHourMeter,
            source: "BREAKDOWN",
            remark: `Pencatatan dari Laporan Breakdown #${bdCode}`,
            createdById: user.id,
          },
        });

        await tx.equipment.update({
          where: { id: equipmentId },
          data: { currentHourMeter: finalHourMeter },
        });
      }

      // 8. Synchronize equipment status to BREAKDOWN
      await syncEquipmentStatus(equipmentId, tx);

      // 9. Audit Log
      await createAuditLog({
        userId: user.id,
        action: "CREATE",
        entity: "BreakdownRequest",
        entityId: breakdown.id,
        reason: problem,
        details: `Laporan Breakdown #${bdCode} dibuat untuk unit ${equipment.code} (${equipment.name}). Work Order #${woCode} otomatis digenerate.`,
        newValue: JSON.stringify({
          code: bdCode,
          equipmentCode: equipment.code,
          priority,
          hourMeter,
          problem,
        }),
      });

      return { breakdown, workOrder };
    });

    revalidatePath("/dashboard");
    revalidatePath("/breakdown");
    revalidatePath("/work-order");
    revalidatePath(`/work-order/${result.workOrder.id}`);
    revalidatePath("/equipment");
    revalidatePath(`/equipment/${equipmentId}`);
    revalidatePath("/hour-meter");

    return {
      success: true,
      breakdownId: result.breakdown.id,
      breakdownCode: result.breakdown.code,
      workOrderId: result.workOrder.id,
      workOrderCode: result.workOrder.code,
    };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal memproses laporan breakdown.");
    return { success: false, error: msg };
  }
}

export async function getBreakdownRequests(params?: {
  equipmentId?: string;
  limit?: number;
}) {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const where = {
    deletedAt: null,
    ...(params?.equipmentId ? { equipmentId: params.equipmentId } : {}),
  };

  return db.breakdownRequest.findMany({
    where,
    take: params?.limit ?? 50,
    orderBy: { reportedAt: "desc" },
    include: {
      equipment: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
        },
      },
      reportedBy: {
        select: {
          id: true,
          name: true,
          nik: true,
        },
      },
      workOrder: {
        select: {
          id: true,
          code: true,
          status: true,
        },
      },
    },
  });
}

export async function deleteBreakdown(id: string) {
  const admin = await requireRole(["ADMIN"]);

  const existing = await db.breakdownRequest.findUnique({
    where: { id },
    select: { id: true, code: true, deletedAt: true },
  });

  if (!existing || existing.deletedAt) {
    return { success: false, error: "Laporan breakdown tidak ditemukan atau sudah dihapus." };
  }

  try {
    await db.breakdownRequest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await createAuditLog({
      userId: admin.id,
      action: "DELETE",
      entity: "BreakdownRequest",
      entityId: id,
      reason: "Penghapusan oleh Admin",
      details: `Laporan Breakdown #${existing.code} dihapus.`,
    });

    revalidatePath("/breakdown");
    revalidatePath("/dashboard");
    
    return { success: true };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menghapus laporan breakdown.");
    return { success: false, error: msg };
  }
}

