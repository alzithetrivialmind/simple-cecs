"use server";

import { db } from "@/lib/db";
import { toUserMessage } from "@/lib/errors";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { createAuditLog } from "@/lib/audit";
import {
  startUsageSessionSchema,
  StartUsageSessionInput,
  finishUsageSessionSchema,
  FinishUsageSessionInput,
} from "@/lib/validations/usage-session";
import { EquipmentStatus, UsageStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { syncEquipmentStatus } from "@/server/services/equipment-status";
import { recalcAllPmPlans } from "@/server/services/pm-status";

export async function startEquipmentUsage(data: StartUsageSessionInput) {
  const user = await requireAuth();

  const validation = startUsageSessionSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { equipmentId, startPhotoUrl, startHourMeter, remarks } = validation.data;

  const equipment = await db.equipment.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      currentHourMeter: true,
      deletedAt: true,
    },
  });

  if (!equipment || equipment.deletedAt) {
    return { success: false, error: "Unit equipment tidak ditemukan." };
  }

  if (
    equipment.status === EquipmentStatus.BREAKDOWN ||
    equipment.status === EquipmentStatus.UNDER_REPAIR ||
    equipment.status === EquipmentStatus.SCRAPPED
  ) {
    return {
      success: false,
      error: `Unit ${equipment.code} sedang berstatus ${equipment.status} dan tidak dapat digunakan saat ini.`,
    };
  }

  // VALIDATION: Hour meter cannot decrease
  if (startHourMeter !== undefined && startHourMeter !== null && !isNaN(startHourMeter)) {
    if (startHourMeter < equipment.currentHourMeter) {
      return {
        success: false,
        error: `Hour meter awal (${startHourMeter} Jam) tidak boleh lebih kecil dari Hour meter saat ini (${equipment.currentHourMeter} Jam).`,
      };
    }
  }

  // Periksa apakah user ini sudah punya sesi aktif pada unit ini
  const existingActive = await db.equipmentUsageSession.findFirst({
    where: {
      equipmentId,
      operatorId: user.id,
      status: UsageStatus.ACTIVE,
    },
    include: {
      operator: {
        select: { id: true, name: true, nik: true, avatarUrl: true },
      },
      equipment: {
        select: { id: true, code: true, name: true },
      },
    },
  });

  if (existingActive) {
    return {
      success: true,
      session: existingActive,
      message: "Sesi pemakaian unit sudah berjalan.",
    };
  }

  try {
    const formattedRemarks = startHourMeter !== undefined && startHourMeter !== null && !isNaN(startHourMeter)
      ? `[HM Awal: ${startHourMeter} Jam]${remarks ? ` ${remarks}` : ""}`
      : remarks || null;

    const session = await db.$transaction(async (tx) => {
      const sess = await tx.equipmentUsageSession.create({
        data: {
          equipmentId,
          operatorId: user.id,
          startAt: new Date(),
          startPhotoUrl,
          remarks: formattedRemarks,
          status: UsageStatus.ACTIVE,
        },
        include: {
          operator: {
            select: { id: true, name: true, nik: true, avatarUrl: true },
          },
          equipment: {
            select: { id: true, code: true, name: true },
          },
        },
      });

      // If startHourMeter provided, record log and advance equipment currentHourMeter if needed
      if (startHourMeter !== undefined && startHourMeter !== null && !isNaN(startHourMeter)) {
        await tx.hourMeterLog.create({
          data: {
            equipmentId,
            readingDate: new Date(),
            hourMeter: startHourMeter,
            source: "USAGE",
            remark: `Mulai sesi pemakaian operator ${user.name} (${user.nik})`,
            createdById: user.id,
          },
        });

        if (startHourMeter > equipment.currentHourMeter) {
          await tx.equipment.update({
            where: { id: equipmentId },
            data: { currentHourMeter: startHourMeter },
          });

          await createAuditLog({
            userId: user.id,
            action: "UPDATE",
            entity: "Equipment",
            entityId: equipmentId,
            field: "currentHourMeter",
            oldValue: String(equipment.currentHourMeter),
            newValue: String(startHourMeter),
            reason: "Pembaruan Hour Meter Awal Pemakaian",
            details: `Hour meter awal diverifikasi oleh operator ${user.name} dari ${equipment.currentHourMeter} Jam ke ${startHourMeter} Jam`,
          });
        }
      }

      return sess;
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "EquipmentUsageSession",
      entityId: session.id,
      reason: "Mulai Pemakaian Alat Lapangan",
      details: `Operator ${user.name} (${user.nik}) mulai mengoperasikan unit ${equipment.code} dengan foto bukti meteran awal${startHourMeter ? `, HM Awal: ${startHourMeter} Jam` : ""}`,
    });

    // Record attachment for equipment gallery
    const startFileKey = startPhotoUrl.replace(/^\/api\/files\//, "");
    await db.attachment.create({
      data: {
        entityType: "EQUIPMENT",
        entityId: equipmentId,
        kind: "PHOTO",
        fileKey: startFileKey,
        fileName: `Meteran Awal - ${user.name} (${new Date().toLocaleDateString("id-ID")}).jpg`,
        mimeType: "image/jpeg",
        sizeBytes: 0,
        uploadedById: user.id,
      },
    }).catch(() => {});

    // If hour meter advanced, recalculate PM
    if (startHourMeter && startHourMeter > equipment.currentHourMeter) {
      await recalcAllPmPlans().catch(() => {});
    }

    // Synchronize equipment status to IN_USE
    await syncEquipmentStatus(equipmentId);

    revalidatePath(`/equipment/${equipmentId}`);
    revalidatePath("/equipment");
    revalidatePath("/dashboard");
    revalidatePath("/hour-meter");

    return { success: true, session };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal memulai sesi pemakaian.");
    return { success: false, error: msg };
  }
}

export async function finishEquipmentUsage(data: FinishUsageSessionInput) {
  const user = await requireAuth();

  const validation = finishUsageSessionSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { sessionId, endPhotoUrl, finalHourMeter, remarks } = validation.data;

  const session = await db.equipmentUsageSession.findUnique({
    where: { id: sessionId },
    include: {
      equipment: {
        select: { id: true, code: true, name: true, currentHourMeter: true },
      },
      operator: {
        select: { id: true, name: true, nik: true, avatarUrl: true },
      },
    },
  });

  if (!session) {
    return { success: false, error: "Sesi pemakaian tidak ditemukan." };
  }

  if (session.status !== UsageStatus.ACTIVE) {
    return { success: false, error: "Sesi pemakaian ini sudah selesai sebelumnya." };
  }

  // VALIDATION: Hour meter cannot decrease
  if (finalHourMeter !== undefined && finalHourMeter !== null && !isNaN(finalHourMeter)) {
    if (finalHourMeter < session.equipment.currentHourMeter) {
      return {
        success: false,
        error: `Hour meter akhir (${finalHourMeter} Jam) tidak boleh lebih kecil dari Hour meter saat ini (${session.equipment.currentHourMeter} Jam).`,
      };
    }
  }

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - new Date(session.startAt).getTime());
  const durationMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));

  try {
    const updated = await db.$transaction(async (tx) => {
      // 1. Update session
      const sess = await tx.equipmentUsageSession.update({
        where: { id: sessionId },
        data: {
          endAt: now,
          endPhotoUrl,
          durationMinutes,
          remarks: remarks || session.remarks,
          status: UsageStatus.COMPLETED,
        },
      });

      // 2. If finalHourMeter provided, record HourMeterLog and update Equipment
      if (finalHourMeter !== undefined && finalHourMeter !== null && !isNaN(finalHourMeter)) {
        await tx.hourMeterLog.create({
          data: {
            equipmentId: session.equipmentId,
            readingDate: now,
            hourMeter: finalHourMeter,
            source: "USAGE",
            remark: remarks || `Selesai sesi pemakaian operator ${user.name} (${durationMinutes} menit)`,
            createdById: user.id,
          },
        });

        await tx.equipment.update({
          where: { id: session.equipmentId },
          data: {
            currentHourMeter: finalHourMeter,
          },
        });

        await createAuditLog({
          userId: user.id,
          action: "UPDATE",
          entity: "Equipment",
          entityId: session.equipmentId,
          field: "currentHourMeter",
          oldValue: String(session.equipment.currentHourMeter),
          newValue: String(finalHourMeter),
          reason: "Pembaruan Hour Meter Selesai Pemakaian",
          details: `Hour meter diupdate oleh operator ${user.name} (${user.nik}) dari ${session.equipment.currentHourMeter} Jam ke ${finalHourMeter} Jam saat check-out pemakaian unit ${session.equipment.code}`,
        });
      }

      return sess;
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "EquipmentUsageSession",
      entityId: session.id,
      reason: "Selesai Pemakaian Alat Lapangan",
      details: `Operator ${user.name} selesai mengoperasikan unit ${session.equipment.code}. Durasi tercatat: ${durationMinutes} menit, dengan foto bukti meteran akhir${finalHourMeter ? `, Hour Meter baru: ${finalHourMeter} Jam` : ""}.`,
    });

    // Record attachment for equipment gallery
    if (endPhotoUrl) {
      const endFileKey = endPhotoUrl.replace(/^\/api\/files\//, "");
      await db.attachment.create({
        data: {
          entityType: "EQUIPMENT",
          entityId: session.equipmentId,
          kind: "PHOTO",
          fileKey: endFileKey,
          fileName: `Meteran Selesai - ${user.name} (${durationMinutes} mnt).jpg`,
          mimeType: "image/jpeg",
          sizeBytes: 0,
          uploadedById: user.id,
        },
      }).catch(() => {});
    }

    // Recalculate PM plans if hour meter was updated
    if (finalHourMeter !== undefined && finalHourMeter !== null && !isNaN(finalHourMeter)) {
      await recalcAllPmPlans().catch(() => {});
    }

    // Revert equipment status to READY (or STANDBY) if no other issues
    await syncEquipmentStatus(session.equipmentId);

    revalidatePath(`/equipment/${session.equipmentId}`);
    revalidatePath("/equipment");
    revalidatePath("/dashboard");
    revalidatePath("/hour-meter");

    return {
      success: true,
      durationMinutes,
      finalHourMeter,
      session: updated,
    };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menyelesaikan sesi pemakaian.");
    return { success: false, error: msg };
  }
}

export async function getActiveUsageSession(equipmentId: string, operatorId?: string) {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const session = await db.equipmentUsageSession.findFirst({
    where: {
      equipmentId,
      status: UsageStatus.ACTIVE,
      ...(operatorId ? { operatorId } : {}),
    },
    include: {
      operator: {
        select: { id: true, name: true, nik: true, avatarUrl: true },
      },
    },
    orderBy: { startAt: "desc" },
  });

  // Automatically keep equipment status aligned if active session exists
  if (session) {
    await syncEquipmentStatus(equipmentId).catch(() => {});
  }

  return session;
}

export async function getEquipmentUsageHistory(equipmentId: string, limit = 5) {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  return db.equipmentUsageSession.findMany({
    where: {
      equipmentId,
      status: UsageStatus.COMPLETED,
    },
    take: limit,
    orderBy: { endAt: "desc" },
    include: {
      operator: {
        select: { id: true, name: true, nik: true, avatarUrl: true },
      },
    },
  });
}

export async function deleteUsageSession(id: string) {
  const admin = await requireRole(["ADMIN"]);

  const existing = await db.equipmentUsageSession.findUnique({
    where: { id },
    select: { id: true, equipmentId: true, deletedAt: true },
  });

  if (!existing || existing.deletedAt) {
    return { success: false, error: "Sesi penggunaan tidak ditemukan atau sudah dihapus." };
  }

  try {
    await db.equipmentUsageSession.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await createAuditLog({
      userId: admin.id,
      action: "DELETE",
      entity: "EquipmentUsageSession",
      entityId: id,
      reason: "Penghapusan oleh Admin",
      details: `Sesi penggunaan dihapus.`,
    });

    revalidatePath(`/equipment/${existing.equipmentId}`);
    
    return { success: true };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menghapus sesi penggunaan.");
    return { success: false, error: msg };
  }
}

