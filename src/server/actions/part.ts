"use server";

import { db } from "@/lib/db";
import { toUserMessage } from "@/lib/errors";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { createAuditLog } from "@/lib/audit";
import { rankTopUnits } from "@/server/services/part-usage";
import {
  partSchema,
  PartInput,
  recordPartUsageSchema,
  RecordPartUsageInput,
} from "@/lib/validations/part";
import { EquipmentCategory, PartSystem, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface GetPartsParams {
  system?: PartSystem | "ALL";
  category?: EquipmentCategory | "ALL";
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getParts(params?: GetPartsParams) {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const where: Prisma.PartWhereInput = {
    deletedAt: null,
    ...(params?.system && params.system !== "ALL" ? { system: params.system } : {}),
  };

  if (params?.category && params.category !== "ALL") {
    where.compatibility = {
      some: {
        category: params.category,
      },
    };
  }

  if (params?.search) {
    const s = params.search.toLowerCase();
    where.OR = [
      { partNumber: { contains: s, mode: "insensitive" } },
      { description: { contains: s, mode: "insensitive" } },
      { altPartNumber: { contains: s, mode: "insensitive" } },
      { manufacturer: { contains: s, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    db.part.count({ where }),
    db.part.findMany({
      where,
      take: params?.limit ?? 50,
      skip: params?.offset ?? 0,
      orderBy: { partNumber: "asc" },
      include: {
        compatibility: true,
        _count: {
          select: { usages: { where: { deletedAt: null } } },
        },
      },
    }),
  ]);

  return { total, items };
}

export async function getPartById(id: string) {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const part = await db.part.findFirst({
    where: { id, deletedAt: null },
    include: {
      compatibility: true,
      usages: {
        where: { deletedAt: null },
        take: 50,
        orderBy: { usedAt: "desc" },
        include: {
          workOrder: {
            select: {
              id: true,
              code: true,
              type: true,
              status: true,
              equipment: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!part) return null;

  const [allUsages, totals, compatEquipment] = await Promise.all([
    db.partUsage.findMany({
      where: { partId: id, deletedAt: null },
      select: {
        qty: true,
        usedAt: true,
        workOrder: { select: { equipment: { select: { id: true, code: true, name: true } } } },
      },
    }),
    db.partUsage.aggregate({
      where: { partId: id, deletedAt: null },
      _count: { _all: true },
      _sum: { qty: true },
    }),
    db.equipment.findMany({
      where: {
        id: {
          in: part.compatibility
            .map((c) => c.equipmentId)
            .filter((eqId): eqId is string => !!eqId),
        },
      },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const topUnits = rankTopUnits(
    allUsages.map((u) => ({ qty: u.qty, usedAt: u.usedAt, equipment: u.workOrder.equipment }))
  );

  return {
    ...part,
    compatibleEquipment: compatEquipment,
    topUnits,
    usageCount: totals._count._all,
    totalQty: totals._sum.qty ?? 0,
  };
}

export async function savePart(data: PartInput) {
  const user = await requireRole(["ADMIN", "SUPERVISOR"]);

  const validation = partSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input part tidak valid",
    };
  }

  const {
    id,
    partNumber,
    description,
    manufacturer,
    altPartNumber,
    system,
    unit,
    compatibleCategories,
    compatibleEquipmentIds,
  } = validation.data;

  // Check unique partNumber
  const existing = await db.part.findUnique({
    where: { partNumber },
  });

  if (existing && existing.id !== id) {
    return {
      success: false,
      error: `Nomor part "${partNumber}" sudah digunakan oleh suku cadang lain (${existing.description}).`,
    };
  }

  try {
    const part = await db.$transaction(async (tx) => {
      let currentPart;
      if (id) {
        currentPart = await tx.part.update({
          where: { id },
          data: {
            partNumber,
            description,
            manufacturer: manufacturer || null,
            altPartNumber: altPartNumber || null,
            system,
            unit,
          },
        });

        // Reset existing compatibility
        await tx.partCompatibility.deleteMany({
          where: { partId: id },
        });
      } else {
        currentPart = await tx.part.create({
          data: {
            partNumber,
            description,
            manufacturer: manufacturer || null,
            altPartNumber: altPartNumber || null,
            system,
            unit,
          },
        });
      }

      // Re-create compatibility entries
      const compatData: Prisma.PartCompatibilityCreateManyInput[] = [];

      // Category level compatibility
      if (compatibleCategories && compatibleCategories.length > 0) {
        for (const cat of compatibleCategories) {
          compatData.push({
            partId: currentPart.id,
            category: cat,
            equipmentId: null,
          });
        }
      }

      // Unit specific compatibility
      if (compatibleEquipmentIds && compatibleEquipmentIds.length > 0) {
        for (const eqId of compatibleEquipmentIds) {
          compatData.push({
            partId: currentPart.id,
            category: null,
            equipmentId: eqId,
          });
        }
      }

      if (compatData.length > 0) {
        await tx.partCompatibility.createMany({
          data: compatData,
          skipDuplicates: true,
        });
      }

      return currentPart;
    });

    await createAuditLog({
      userId: user.id,
      action: id ? "UPDATE" : "CREATE",
      entity: "Part",
      entityId: part.id,
      newValue: `Spare part ${part.partNumber} - ${part.description} (${part.system})`,
    });

    revalidatePath("/spare-part");
    revalidatePath(`/spare-part/${part.id}`);
    revalidatePath("/work-order");

    return { success: true, partId: part.id };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menyimpan spare part.");
    return { success: false, error: msg };
  }
}

export async function deletePart(id: string) {
  const user = await requireRole(["ADMIN"]);

  const part = await db.part.findUnique({
    where: { id },
    include: { _count: { select: { usages: { where: { deletedAt: null } } } } },
  });

  if (!part) {
    return { success: false, error: "Spare part tidak ditemukan." };
  }

  await db.part.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    userId: user.id,
    action: "DELETE",
    entity: "Part",
    entityId: id,
    oldValue: `${part.partNumber} - ${part.description}`,
  });

  revalidatePath("/spare-part");
  return { success: true };
}

export async function recordPartUsage(data: RecordPartUsageInput) {
  await requireAuth();

  const validation = recordPartUsageSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input pemakaian part tidak valid",
    };
  }

  const { workOrderId, partId, qty } = validation.data;

  const [wo, part] = await Promise.all([
    db.workOrder.findUnique({
      where: { id: workOrderId },
      include: { equipment: { select: { id: true, code: true, name: true } } },
    }),
    db.part.findUnique({
      where: { id: partId },
      select: { id: true, partNumber: true, description: true, unit: true },
    }),
  ]);

  if (!wo) return { success: false, error: "Work order tidak ditemukan." };
  if (!part) return { success: false, error: "Spare part tidak ditemukan." };

  const usage = await db.partUsage.create({
    data: {
      workOrderId,
      partId,
      qty,
      usedAt: new Date(),
    },
  });

  revalidatePath(`/work-order/${workOrderId}`);
  revalidatePath(`/spare-part/${partId}`);
  revalidatePath("/report");

  return { success: true, usageId: usage.id };
}

export async function deletePartUsage(usageId: string, workOrderId: string) {
  const user = await requireRole(["ADMIN"]);

  const usage = await db.partUsage.findFirst({
    where: { id: usageId, workOrderId, deletedAt: null },
    include: { part: { select: { partNumber: true } } },
  });

  if (!usage) {
    return { success: false, error: "Pemakaian spare part tidak ditemukan." };
  }

  await db.partUsage.update({
    where: { id: usageId },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    userId: user.id,
    action: "DELETE",
    entity: "PartUsage",
    entityId: usageId,
    oldValue: `${usage.part.partNumber} x${usage.qty} pada WO ${workOrderId}`,
  });

  revalidatePath(`/work-order/${workOrderId}`);
  revalidatePath(`/spare-part/${usage.partId}`);
  revalidatePath("/report");
  return { success: true };
}

export async function searchCompatibleParts(category?: EquipmentCategory, equipmentId?: string, query?: string) {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const where: Prisma.PartWhereInput = {
    deletedAt: null,
  };

  if (query && query.trim()) {
    const s = query.toLowerCase();
    where.OR = [
      { partNumber: { contains: s, mode: "insensitive" } },
      { description: { contains: s, mode: "insensitive" } },
      { altPartNumber: { contains: s, mode: "insensitive" } },
    ];
  }

  if (category || equipmentId) {
    where.compatibility = {
      some: {
        OR: [
          ...(category ? [{ category }] : []),
          ...(equipmentId ? [{ equipmentId }] : []),
        ],
      },
    };
  }

  return db.part.findMany({
    where,
    take: 30,
    orderBy: { partNumber: "asc" },
    select: {
      id: true,
      partNumber: true,
      description: true,
      manufacturer: true,
      system: true,
      unit: true,
    },
  });
}
