"use server";

import { db } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/auth-guard";
import { createAuditLog } from "@/lib/audit";
import { Prisma } from "@prisma/client";

export interface GetAuditLogsParams {
  search?: string;
  userId?: string;
  action?: string;
  entity?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export async function getAuditLogs(params?: GetAuditLogsParams) {
  // Hanya ADMIN yang mutlak dapat mengakses log audit
  await requireRole(["ADMIN"]);

  const page = Math.max(1, params?.page ?? 1);
  const limit = Math.max(1, Math.min(100, params?.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {};

  if (params?.userId) {
    where.userId = params.userId;
  }

  if (params?.action && params.action !== "ALL") {
    where.action = params.action;
  }

  if (params?.entity && params.entity !== "ALL") {
    where.entity = params.entity;
  }

  if (params?.startDate || params?.endDate) {
    where.at = {};
    if (params.startDate) {
      where.at.gte = new Date(params.startDate);
    }
    if (params.endDate) {
      const end = new Date(params.endDate);
      end.setHours(23, 59, 59, 999);
      where.at.lte = end;
    }
  }

  if (params?.search?.trim()) {
    const s = params.search.trim();
    where.OR = [
      { entityId: { contains: s, mode: "insensitive" } },
      { reason: { contains: s, mode: "insensitive" } },
      { details: { contains: s, mode: "insensitive" } },
      { field: { contains: s, mode: "insensitive" } },
      { oldValue: { contains: s, mode: "insensitive" } },
      { newValue: { contains: s, mode: "insensitive" } },
      {
        user: {
          OR: [
            { name: { contains: s, mode: "insensitive" } },
            { nik: { contains: s, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { at: "desc" },
      include: {
        user: {
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
    db.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function recordPageView(entity: string, entityId?: string, details?: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    return await createAuditLog({
      userId: user.id,
      action: "VIEW",
      entity,
      entityId,
      details: details ?? `Membuka data ${entity} ${entityId ?? ""}`.trim(),
    });
  } catch (err) {
    console.error("Failed to record page view:", err);
    return null;
  }
}
