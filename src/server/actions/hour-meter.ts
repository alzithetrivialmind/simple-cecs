"use server";

import { db } from "@/lib/db";
import { toUserMessage } from "@/lib/errors";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import {
  hourMeterLogSchema,
  HourMeterLogInput,
} from "@/lib/validations/hour-meter";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

import { Prisma } from "@prisma/client";

export interface GetHourMeterLogsParams {
  equipmentId?: string;
  page?: number;
  limit?: number;
}

export async function getHourMeterLogs(params?: GetHourMeterLogsParams) {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const page = Math.max(1, params?.page ?? 1);
  const limit = Math.max(1, Math.min(100, params?.limit ?? 25));
  const skip = (page - 1) * limit;

  const where: Prisma.HourMeterLogWhereInput = { deletedAt: null };
  if (params?.equipmentId) {
    where.equipmentId = params.equipmentId;
  }

  const [total, logs] = await Promise.all([
    db.hourMeterLog.count({ where }),
    db.hourMeterLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { readingDate: "desc" },
      include: {
        equipment: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            currentHourMeter: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            nik: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
    }),
  ]);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createHourMeterLog(data: HourMeterLogInput) {
  const user = await requireRole(["ADMIN", "SUPERVISOR", "TECHNICIAN"]);

  const validation = hourMeterLogSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { equipmentId, readingDate, hourMeter, source, remark } =
    validation.data;

  const equipment = await db.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, code: true, name: true, currentHourMeter: true, deletedAt: true },
  });

  if (!equipment || equipment.deletedAt) {
    return { success: false, error: "Unit tidak ditemukan." };
  }

  // VALIDATION: Hour meter cannot decrease
  if (hourMeter < equipment.currentHourMeter) {
    return {
      success: false,
      error: `Hour meter baru (${hourMeter} Jam) tidak boleh lebih kecil dari Hour meter saat ini (${equipment.currentHourMeter} Jam).`,
    };
  }

  // Update in a transaction
  const result = await db.$transaction(async (tx) => {
    // 1. Create log
    const log = await tx.hourMeterLog.create({
      data: {
        equipmentId,
        readingDate: new Date(readingDate),
        hourMeter,
        source: source || "MANUAL",
        remark: remark || null,
        createdById: user.id,
      },
    });

    // 2. Update equipment currentHourMeter
    const updatedEquipment = await tx.equipment.update({
      where: { id: equipmentId },
      data: {
        currentHourMeter: hourMeter,
      },
    });

    // 3. Audit Log
    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "Equipment",
      entityId: equipmentId,
      field: "currentHourMeter",
      oldValue: String(equipment.currentHourMeter),
      newValue: String(hourMeter),
      reason: remark || `Update Hour Meter (${source || "MANUAL"})`,
      details: `Hour meter diperbarui dari ${equipment.currentHourMeter} Jam ke ${hourMeter} Jam`,
    });

    return { log, updatedEquipment };
  });

  revalidatePath("/hour-meter");
  revalidatePath(`/equipment/${equipmentId}`);
  revalidatePath("/dashboard");

  return { success: true, log: result.log };
}

export async function deleteHourMeter(id: string) {
  const admin = await requireRole(["ADMIN"]);

  const existing = await db.hourMeterLog.findUnique({
    where: { id },
    select: { id: true, equipmentId: true, deletedAt: true },
  });

  if (!existing || existing.deletedAt) {
    return { success: false, error: "Log Hour Meter tidak ditemukan atau sudah dihapus." };
  }

  try {
    await db.hourMeterLog.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await createAuditLog({
      userId: admin.id,
      action: "DELETE",
      entity: "HourMeterLog",
      entityId: id,
      reason: "Penghapusan oleh Admin",
      details: `Log Hour Meter dihapus.`,
    });

    revalidatePath("/hour-meter");
    revalidatePath(`/equipment/${existing.equipmentId}`);
    
    return { success: true };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menghapus log Hour Meter.");
    return { success: false, error: msg };
  }
}

