"use server";

import { db } from "@/lib/db";
import { toUserMessage } from "@/lib/errors";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { generateWorkOrderCode } from "@/lib/numbering";
import { syncEquipmentStatus } from "@/server/services/equipment-status";
import { createAuditLog } from "@/lib/audit";
import { uploadBuffer } from "@/lib/storage";
import { validateUpload, safeDisplayName, isSafeFileKey } from "@/lib/upload-guard";
import crypto from "crypto";
import {
  createWorkOrderSchema,
  CreateWorkOrderInput,
  assignWorkOrderSchema,
  AssignWorkOrderInput,
  updateWorkOrderStatusSchema,
  UpdateWorkOrderStatusInput,
  updateDiagnosisSchema,
  UpdateDiagnosisInput,
  updateRepairResultSchema,
  UpdateRepairResultInput,
  closeWorkOrderSchema,
  CloseWorkOrderInput,
} from "@/lib/validations/work-order";
import {
  AttachmentEntity,
  WorkOrderStatus,
  WorkOrderType,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface GetWorkOrdersParams {
  status?: WorkOrderStatus | "ALL";
  type?: WorkOrderType | "ALL";
  equipmentId?: string;
  assignedToId?: string;
  search?: string;
  limit?: number;
}

export async function getWorkOrders(params?: GetWorkOrdersParams) {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const where: Prisma.WorkOrderWhereInput = {
    deletedAt: null,
    ...(params?.status && params.status !== "ALL" ? { status: params.status } : {}),
    ...(params?.type && params.type !== "ALL" ? { type: params.type } : {}),
    ...(params?.equipmentId ? { equipmentId: params.equipmentId } : {}),
    ...(params?.assignedToId ? { assignedToId: params.assignedToId } : {}),
  };

  if (params?.search) {
    const s = params.search.toLowerCase();
    where.OR = [
      { code: { contains: s, mode: "insensitive" } },
      { equipment: { name: { contains: s, mode: "insensitive" } } },
      { equipment: { code: { contains: s, mode: "insensitive" } } },
      { assignedTo: { name: { contains: s, mode: "insensitive" } } },
    ];
  }

  return db.workOrder.findMany({
    where,
    take: params?.limit ?? 100,
    orderBy: { createdAt: "desc" },
    include: {
      equipment: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          status: true,
          location: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          nik: true,
          role: true,
          avatarUrl: true,
        },
      },
      breakdownRequest: {
        select: {
          id: true,
          code: true,
          problem: true,
          priority: true,
          reportedAt: true,
          reportedBy: { select: { id: true, name: true } },
        },
      },
      pmPlan: {
        select: {
          id: true,
          pmType: { select: { name: true } },
        },
      },
      diagnosis: {
        select: {
          finding: true,
          rootCause: true,
        },
      },
      repairResult: {
        select: {
          correctiveAction: true,
        },
      },
    },
  });
}

export async function getWorkOrderById(id: string) {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const workOrder = await db.workOrder.findUnique({
    where: { id },
    include: {
      equipment: {
        include: {
          department: true,
          location: true,
        },
      },
      breakdownRequest: {
        include: {
          reportedBy: { select: { id: true, name: true, nik: true, avatarUrl: true } },
        },
      },
      pmPlan: {
        include: {
          pmType: true,
        },
      },
      assignedTo: {
        select: { id: true, name: true, nik: true, role: true, avatarUrl: true },
      },
      closedBy: {
        select: { id: true, name: true, nik: true, role: true, avatarUrl: true },
      },
      diagnosis: true,
      repairResult: true,
      partUsages: {
        where: { deletedAt: null },
        include: {
          part: true,
        },
      },
      statusHistory: {
        orderBy: { changedAt: "desc" },
      },
    },
  });

  if (!workOrder) return null;

  // Get attachments for this work order and associated breakdown
  const attachmentWhere: Prisma.AttachmentWhereInput = {
    OR: [
      { entityType: AttachmentEntity.WORK_ORDER, entityId: id },
      ...(workOrder.breakdownRequestId
        ? [
            {
              entityType: AttachmentEntity.BREAKDOWN,
              entityId: workOrder.breakdownRequestId,
            },
          ]
        : []),
    ],
  };

  const attachments = await db.attachment.findMany({
    where: attachmentWhere,
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  // Get all user records who changed status history
  const userIds = Array.from(
    new Set(workOrder.statusHistory.map((h: { changedById: string }) => h.changedById))
  ) as string[];

  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, nik: true, role: true, avatarUrl: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const enrichedHistory = workOrder.statusHistory.map((h: { id: string; fromStatus: WorkOrderStatus | null; toStatus: WorkOrderStatus; changedAt: Date; note: string | null; changedById: string }) => ({
    ...h,
    changedBy: userMap.get(h.changedById) || {
      id: h.changedById,
      name: "Sistem",
      nik: "-",
      role: "ADMIN" as const,
      avatarUrl: null,
    },
  }));

  return {
    ...workOrder,
    attachments,
    statusHistory: enrichedHistory,
  };
}

export async function createWorkOrder(data: CreateWorkOrderInput) {
  const user = await requireRole(["ADMIN", "SUPERVISOR", "TECHNICIAN"]);

  const validation = createWorkOrderSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { equipmentId, type, assignedToId, externalServiceBy, problem } =
    validation.data;

  const equipment = await db.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, code: true, name: true, deletedAt: true },
  });

  if (!equipment || equipment.deletedAt) {
    return { success: false, error: "Unit equipment tidak ditemukan." };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const code = await generateWorkOrderCode(tx);

      const workOrder = await tx.workOrder.create({
        data: {
          code,
          equipmentId,
          type,
          status: WorkOrderStatus.OPEN,
          assignedToId: assignedToId || null,
          externalServiceBy: externalServiceBy || null,
        },
      });

      await tx.workOrderStatusHistory.create({
        data: {
          workOrderId: workOrder.id,
          fromStatus: null,
          toStatus: WorkOrderStatus.OPEN,
          changedById: user.id,
          note: `Work Order dibuat secara manual: ${problem}`,
        },
      });

      await syncEquipmentStatus(equipmentId, tx);

      // 4. Audit Log
      await createAuditLog({
        userId: user.id,
        action: "CREATE",
        entity: "WorkOrder",
        entityId: workOrder.id,
        reason: problem,
        details: `Work Order #${code} dibuat untuk unit ${equipment.code} (${equipment.name}). Tipe: ${type}`,
      });

      return workOrder;
    });

    revalidatePath("/dashboard");
    revalidatePath("/work-order");
    revalidatePath("/equipment");
    revalidatePath(`/equipment/${equipmentId}`);

    return {
      success: true,
      data: result,
    };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal membuat Work Order.");
    return { success: false, error: msg };
  }
}

export async function deleteWorkOrder(id: string) {
  const admin = await requireRole(["ADMIN"]);

  const existing = await db.workOrder.findUnique({
    where: { id },
    select: { id: true, code: true, deletedAt: true },
  });

  if (!existing || existing.deletedAt) {
    return { success: false, error: "Work Order tidak ditemukan atau sudah dihapus." };
  }

  try {
    await db.workOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await createAuditLog({
      userId: admin.id,
      action: "DELETE",
      entity: "WorkOrder",
      entityId: id,
      reason: "Penghapusan oleh Admin",
      details: `Work Order #${existing.code} dihapus.`,
    });

    revalidatePath("/dashboard");
    revalidatePath("/work-order");
    revalidatePath("/equipment");
    
    return { success: true };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menghapus Work Order.");
    return { success: false, error: msg };
  }
}

export async function assignWorkOrder(data: AssignWorkOrderInput) {
  const user = await requireRole(["ADMIN", "SUPERVISOR"]);

  const validation = assignWorkOrderSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { workOrderId, assignedToId, externalServiceBy, note } = validation.data;

  const workOrder = await db.workOrder.findUnique({
    where: { id: workOrderId },
    select: { id: true, code: true, equipmentId: true, status: true, deletedAt: true },
  });

  if (!workOrder || workOrder.deletedAt) {
    return { success: false, error: "Work Order tidak ditemukan." };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: workOrderId },
        data: {
          assignedToId: assignedToId || null,
          externalServiceBy: externalServiceBy || null,
        },
      });

      let techName = "Servis Eksternal";
      if (assignedToId) {
        const tech = await tx.user.findUnique({
          where: { id: assignedToId },
          select: { name: true, nik: true },
        });
        if (tech) techName = `${tech.name} (${tech.nik})`;
      }

      await tx.workOrderStatusHistory.create({
        data: {
          workOrderId,
          fromStatus: workOrder.status,
          toStatus: workOrder.status,
          changedById: user.id,
          note: note || `Ditugaskan kepada: ${techName}`,
        },
      });
    });

    revalidatePath(`/work-order/${workOrderId}`);
    revalidatePath("/work-order");

    return { success: true };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menugaskan Work Order.");
    return { success: false, error: msg };
  }
}

export async function updateWorkOrderStatus(data: UpdateWorkOrderStatusInput) {
  const user = await requireRole(["ADMIN", "SUPERVISOR", "TECHNICIAN"]);

  const validation = updateWorkOrderStatusSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { workOrderId, toStatus, note } = validation.data;

  const workOrder = await db.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      id: true,
      code: true,
      equipmentId: true,
      type: true,
      status: true,
      deletedAt: true,
      startedAt: true,
      finishedAt: true,
    },
  });

  if (!workOrder || workOrder.deletedAt) {
    return { success: false, error: "Work Order tidak ditemukan." };
  }

  if (workOrder.status === WorkOrderStatus.CLOSED) {
    return { success: false, error: "Work Order yang sudah CLOSED tidak dapat diubah lagi." };
  }

  // Update fields based on status transition
  const updateData: Prisma.WorkOrderUpdateInput = {
    status: toStatus,
  };

  if (toStatus === WorkOrderStatus.IN_PROGRESS && !workOrder.startedAt) {
    updateData.startedAt = new Date();
  } else if (toStatus === WorkOrderStatus.DONE) {
    updateData.finishedAt = new Date();
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: workOrderId },
        data: updateData,
      });

      await tx.workOrderStatusHistory.create({
        data: {
          workOrderId,
          fromStatus: workOrder.status,
          toStatus,
          changedById: user.id,
          note: note || `Status diubah dari ${workOrder.status} menjadi ${toStatus}`,
        },
      });

      // Synchronize equipment status
      await syncEquipmentStatus(workOrder.equipmentId, tx);

      await createAuditLog({
        userId: user.id,
        action: "STATUS_CHANGE",
        entity: "WorkOrder",
        entityId: workOrderId,
        field: "status",
        oldValue: workOrder.status,
        newValue: toStatus,
        reason: note || `Perubahan status dari ${workOrder.status} menjadi ${toStatus}`,
        details: `Status Work Order #${workOrder.code} diubah dari ${workOrder.status} ke ${toStatus}`,
      });
    });

    revalidatePath(`/work-order/${workOrderId}`);
    revalidatePath("/work-order");
    revalidatePath("/equipment");
    revalidatePath(`/equipment/${workOrder.equipmentId}`);
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal memperbarui status Work Order.");
    return { success: false, error: msg };
  }
}

export async function updateDiagnosis(data: UpdateDiagnosisInput) {
  await requireRole(["ADMIN", "SUPERVISOR", "TECHNICIAN"]);

  const validation = updateDiagnosisSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { workOrderId, finding, rootCause, recommendation, checklist } =
    validation.data;

  try {
    await db.diagnosis.upsert({
      where: { workOrderId },
      update: {
        finding,
        rootCause,
        recommendation: recommendation || null,
        checklist: checklist || Prisma.JsonNull,
      },
      create: {
        workOrderId,
        finding,
        rootCause,
        recommendation: recommendation || null,
        checklist: checklist || Prisma.JsonNull,
      },
    });

    revalidatePath(`/work-order/${workOrderId}`);
    return { success: true };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menyimpan diagnosis.");
    return { success: false, error: msg };
  }
}

export async function updateRepairResult(data: UpdateRepairResultInput) {
  await requireRole(["ADMIN", "SUPERVISOR", "TECHNICIAN"]);

  const validation = updateRepairResultSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { workOrderId, correctiveAction, remark } = validation.data;

  try {
    await db.repairResult.upsert({
      where: { workOrderId },
      update: {
        correctiveAction,
        remark: remark || null,
      },
      create: {
        workOrderId,
        correctiveAction,
        remark: remark || null,
      },
    });

    revalidatePath(`/work-order/${workOrderId}`);
    return { success: true };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menyimpan hasil perbaikan.");
    return { success: false, error: msg };
  }
}

export async function closeWorkOrder(data: CloseWorkOrderInput) {
  const user = await requireRole(["ADMIN", "SUPERVISOR", "TECHNICIAN"]);

  const validation = closeWorkOrderSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { workOrderId, correctiveAction, remark, note } = validation.data;

  const workOrder = await db.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      repairResult: true,
      breakdownRequest: true,
    },
  });

  if (!workOrder) {
    return { success: false, error: "Work Order tidak ditemukan." };
  }

  if (workOrder.status === WorkOrderStatus.CLOSED) {
    return { success: false, error: "Work Order ini sudah ditutup (CLOSED)." };
  }

  // ATURAN 1: Wajib ada corrective action
  const finalCorrectiveAction =
    correctiveAction || workOrder.repairResult?.correctiveAction;

  if (!finalCorrectiveAction || finalCorrectiveAction.trim().length < 3) {
    return {
      success: false,
      error: "Wajib mengisi tindakan perbaikan (Corrective Action) sebelum menutup Work Order.",
    };
  }

  // ATURAN 2: Wajib ada minimal satu foto/lampiran
  const attachmentCount = await db.attachment.count({
    where: {
      OR: [
        { entityType: AttachmentEntity.WORK_ORDER, entityId: workOrderId },
        ...(workOrder.breakdownRequestId
          ? [
              {
                entityType: AttachmentEntity.BREAKDOWN,
                entityId: workOrder.breakdownRequestId,
              },
            ]
          : []),
      ],
    },
  });

  if (attachmentCount === 0) {
    return {
      success: false,
      error: "Wajib mengunggah minimal 1 foto/lampiran dokumentasi perbaikan sebelum menutup Work Order.",
    };
  }

  // ATURAN 3: Hitung downtimeMinutes
  const now = new Date();
  const startTime =
    workOrder.breakdownRequest?.reportedAt ||
    workOrder.startedAt ||
    workOrder.createdAt;
  const diffMs = Math.max(0, now.getTime() - new Date(startTime).getTime());
  const downtimeMinutes = Math.floor(diffMs / (1000 * 60));

  try {
    await db.$transaction(async (tx) => {
      // 1. Upsert repair result
      await tx.repairResult.upsert({
        where: { workOrderId },
        update: {
          correctiveAction: finalCorrectiveAction,
          remark: remark || workOrder.repairResult?.remark || null,
        },
        create: {
          workOrderId,
          correctiveAction: finalCorrectiveAction,
          remark: remark || null,
        },
      });

      // 2. Update Work Order
      await tx.workOrder.update({
        where: { id: workOrderId },
        data: {
          status: WorkOrderStatus.CLOSED,
          closedAt: now,
          closedById: user.id,
          downtimeMinutes,
          finishedAt: workOrder.finishedAt || now,
        },
      });

      // 3. Record status history
      await tx.workOrderStatusHistory.create({
        data: {
          workOrderId,
          fromStatus: workOrder.status,
          toStatus: WorkOrderStatus.CLOSED,
          changedById: user.id,
          note:
            note ||
            `Work Order ditutup oleh ${user.name}. Total Downtime: ${downtimeMinutes} Menit.`,
        },
      });

      // 4. Synchronize equipment status back to READY
      await syncEquipmentStatus(workOrder.equipmentId, tx);

      // 5. Audit Log
      await createAuditLog({
        userId: user.id,
        action: "STATUS_CHANGE",
        entity: "WorkOrder",
        entityId: workOrderId,
        field: "status",
        oldValue: workOrder.status,
        newValue: "CLOSED",
        reason: note || `Penyelesaian Work Order #${workOrder.code}`,
        details: `Work Order #${workOrder.code} diselesaikan dan ditutup. Total downtime: ${downtimeMinutes} menit.`,
      });
    });

    revalidatePath(`/work-order/${workOrderId}`);
    revalidatePath("/work-order");
    revalidatePath("/equipment");
    revalidatePath(`/equipment/${workOrder.equipmentId}`);
    revalidatePath("/dashboard");

    return { success: true, downtimeMinutes };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menutup Work Order.");
    return { success: false, error: msg };
  }
}

export async function uploadWorkOrderAttachment(formData: FormData) {
  const user = await requireRole(["ADMIN", "SUPERVISOR", "TECHNICIAN"]);

  const file = formData.get("file") as File | null;
  const workOrderId = formData.get("workOrderId") as string | null;
  const kind = (formData.get("kind") as string) || "PHOTO";

  if (!file || !workOrderId) {
    return { success: false, error: "Berkas atau ID Work Order tidak ditemukan." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extension and MIME come from the server allowlist, not from the
    // client-supplied file name / Content-Type
    const validated = validateUpload(file.type, buffer);
    if (!validated.ok) {
      return { success: false, error: validated.error };
    }

    const fileKey = `work-orders/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${validated.ext}`;

    await uploadBuffer(fileKey, buffer, validated.mime);

    const attachment = await db.attachment.create({
      data: {
        entityType: AttachmentEntity.WORK_ORDER,
        entityId: workOrderId,
        kind,
        fileKey,
        fileName: safeDisplayName(file.name, validated.ext),
        mimeType: validated.mime,
        sizeBytes: buffer.length,
        uploadedById: user.id,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "WorkOrderAttachment",
      entityId: workOrderId,
      reason: `Dokumentasi foto/berkas (${kind}) untuk Work Order`,
      details: `Mengunggah berkas dokumentasi ${safeDisplayName(file.name, validated.ext)} (${kind})`,
    });

    revalidatePath(`/work-order/${workOrderId}`);

    return {
      success: true,
      attachment: {
        id: attachment.id,
        fileKey: attachment.fileKey,
        fileName: attachment.fileName,
        url: `/api/files/${fileKey}`,
      },
    };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal mengunggah lampiran.");
    return { success: false, error: msg };
  }
}

export async function saveWorkOrderCapturedPhoto({
  workOrderId,
  fileKey,
  kind = "PHOTO",
}: {
  workOrderId: string;
  fileKey: string;
  kind?: string;
}) {
  const user = await requireRole(["ADMIN", "SUPERVISOR", "TECHNICIAN"]);

  // fileKey arrives from the client, so it must not escape the bucket prefix
  if (!isSafeFileKey(fileKey)) {
    return { success: false, error: "Kunci berkas tidak valid." };
  }

  try {
    const attachment = await db.attachment.create({
      data: {
        entityType: AttachmentEntity.WORK_ORDER,
        entityId: workOrderId,
        kind,
        fileKey,
        fileName: `wo-foto-${Date.now()}.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: 0,
        uploadedById: user.id,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "WorkOrderAttachment",
      entityId: workOrderId,
      reason: `Dokumentasi foto (${kind}) via kamera langsung`,
      details: `Pengguna ${user.name} mengambil foto dokumentasi (${kind}) untuk Work Order`,
    });

    revalidatePath(`/work-order/${workOrderId}`);
    return { success: true, attachment };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menyimpan foto dokumentasi.");
    return { success: false, error: msg };
  }
}

export async function startWorkOrderExecution(workOrderId: string) {
  const user = await requireRole(["ADMIN", "SUPERVISOR", "TECHNICIAN"]);

  const workOrder = await db.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      id: true,
      code: true,
      equipmentId: true,
      status: true,
      assignedToId: true,
    },
  });

  if (!workOrder) {
    return { success: false, error: "Work Order tidak ditemukan." };
  }

  if (workOrder.status === WorkOrderStatus.CLOSED) {
    return { success: false, error: "Work Order sudah ditutup (CLOSED)." };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: workOrderId },
        data: {
          status: WorkOrderStatus.IN_PROGRESS,
          startedAt: new Date(),
          assignedToId: workOrder.assignedToId || user.id,
        },
      });

      await tx.workOrderStatusHistory.create({
        data: {
          workOrderId,
          fromStatus: workOrder.status,
          toStatus: WorkOrderStatus.IN_PROGRESS,
          changedById: user.id,
          note: `Teknisi ${user.name} mulai mengerjakan perbaikan di lapangan (On Work).`,
        },
      });

      // Synchronize equipment status to UNDER_REPAIR
      await syncEquipmentStatus(workOrder.equipmentId, tx);

      await createAuditLog({
        userId: user.id,
        action: "STATUS_CHANGE",
        entity: "WorkOrder",
        entityId: workOrderId,
        field: "status",
        oldValue: workOrder.status,
        newValue: "IN_PROGRESS",
        reason: "Mulai Pengerjaan Lapangan (On Work)",
        details: `Teknisi ${user.name} memulai perbaikan pada Work Order #${workOrder.code}`,
      });
    });

    revalidatePath(`/work-order/${workOrderId}`);
    revalidatePath(`/equipment/${workOrder.equipmentId}`);
    revalidatePath("/work-order");
    revalidatePath("/equipment");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal memulai pengerjaan.");
    return { success: false, error: msg };
  }
}

export async function technicianQuickCloseWorkOrder({
  workOrderId,
  rootCause,
  correctiveAction,
  remark,
  partsIssued,
  photoKey,
}: {
  workOrderId: string;
  rootCause: string;
  correctiveAction: string;
  remark?: string;
  partsIssued?: Array<{ partId: string; qty: number }>;
  photoKey?: string;
}) {
  const user = await requireRole(["ADMIN", "SUPERVISOR", "TECHNICIAN"]);

  if (!correctiveAction || correctiveAction.trim().length < 3) {
    return { success: false, error: "Wajib mengisi tindakan perbaikan yang dilakukan." };
  }

  const workOrder = await db.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      breakdownRequest: true,
      equipment: true,
    },
  });

  if (!workOrder) {
    return { success: false, error: "Work Order tidak ditemukan." };
  }

  if (workOrder.status === WorkOrderStatus.CLOSED) {
    return { success: false, error: "Work Order ini sudah ditutup sebelumnya." };
  }

  const now = new Date();
  const startTime =
    workOrder.breakdownRequest?.reportedAt ||
    workOrder.startedAt ||
    workOrder.createdAt;
  const diffMs = Math.max(0, now.getTime() - new Date(startTime).getTime());
  const downtimeMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));

  try {
    await db.$transaction(async (tx) => {
      // 1. Simpan Diagnosis / Temuan & Akar Masalah
      await tx.diagnosis.upsert({
        where: { workOrderId },
        update: {
          finding: rootCause,
          rootCause,
        },
        create: {
          workOrderId,
          finding: rootCause,
          rootCause,
        },
      });

      // 2. Simpan Hasil Perbaikan
      await tx.repairResult.upsert({
        where: { workOrderId },
        update: {
          correctiveAction,
          remark: remark?.trim() || null,
        },
        create: {
          workOrderId,
          correctiveAction,
          remark: remark?.trim() || null,
        },
      });

      // 3. Catat Spare Part yang dipakai (PartUsage)
      if (partsIssued && partsIssued.length > 0) {
        for (const item of partsIssued) {
          if (item.qty > 0 && item.partId) {
            await tx.partUsage.create({
              data: {
                workOrderId,
                partId: item.partId,
                qty: item.qty,
                usedAt: now,
              },
            });
          }
        }
      }

      // 4. Catat Foto Hasil Perbaikan jika ada
      if (photoKey) {
        await tx.attachment.create({
          data: {
            entityType: AttachmentEntity.WORK_ORDER,
            entityId: workOrderId,
            kind: "PHOTO",
            fileKey: photoKey,
            fileName: `Hasil Perbaikan #${workOrder.code} - ${Date.now()}.jpg`,
            mimeType: "image/jpeg",
            sizeBytes: 0,
            uploadedById: user.id,
          },
        });

        // Also attach to Equipment master gallery
        await tx.attachment.create({
          data: {
            entityType: AttachmentEntity.EQUIPMENT,
            entityId: workOrder.equipmentId,
            kind: "PHOTO",
            fileKey: photoKey,
            fileName: `Hasil Perbaikan #${workOrder.code}.jpg`,
            mimeType: "image/jpeg",
            sizeBytes: 0,
            uploadedById: user.id,
          },
        });
      }

      // 5. Update Status WO ke CLOSED
      await tx.workOrder.update({
        where: { id: workOrderId },
        data: {
          status: WorkOrderStatus.CLOSED,
          closedAt: now,
          finishedAt: now,
          closedById: user.id,
          downtimeMinutes,
        },
      });

      // 6. Catat Status History
      await tx.workOrderStatusHistory.create({
        data: {
          workOrderId,
          fromStatus: workOrder.status,
          toStatus: WorkOrderStatus.CLOSED,
          changedById: user.id,
          note: `Work Order diselesaikan oleh teknisi ${user.name}. Total Downtime: ${downtimeMinutes} Menit.`,
        },
      });

      // 7. Kembalikan status unit ke READY
      await syncEquipmentStatus(workOrder.equipmentId, tx);

      // 8. Audit Log
      await createAuditLog({
        userId: user.id,
        action: "STATUS_CHANGE",
        entity: "WorkOrder",
        entityId: workOrderId,
        field: "status",
        oldValue: workOrder.status,
        newValue: "CLOSED",
        reason: `Penyelesaian Perbaikan Lapangan #${workOrder.code}`,
        details: `Teknisi ${user.name} menutup WO #${workOrder.code}. Downtime: ${downtimeMinutes} menit. Part terpasang: ${partsIssued?.length || 0} jenis.`,
      });
    });

    revalidatePath(`/work-order/${workOrderId}`);
    revalidatePath(`/equipment/${workOrder.equipmentId}`);
    revalidatePath("/work-order");
    revalidatePath("/equipment");
    revalidatePath("/dashboard");
    revalidatePath("/report");

    return { success: true, downtimeMinutes };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menyelesaikan Work Order.");
    return { success: false, error: msg };
  }
}
