"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { PmStatus, WorkOrderStatus } from "@prisma/client";

export interface SystemNotification {
  id: string;
  type: "BREAKDOWN" | "PM_OVERDUE" | "EXPIRING_CERTIFICATE" | "WAITING_PART";
  title: string;
  description: string;
  href: string;
  createdAt: string;
  severity: "critical" | "warning" | "info";
}

export async function getSystemNotifications(): Promise<SystemNotification[]> {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  try {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [activeBreakdowns, overduePm, waitingPartWo, expiringCerts] = await Promise.all([
      // 1. Breakdowns waiting for response
      db.breakdownRequest.findMany({
        where: {
          deletedAt: null,
          status: "SUBMITTED",
        },
        include: {
          equipment: { select: { id: true, code: true, name: true } },
        },
        take: 5,
        orderBy: { reportedAt: "desc" },
      }),
      // 2. Overdue PMs
      db.pmPlan.findMany({
        where: { status: PmStatus.OVERDUE, isActive: true },
        include: {
          equipment: { select: { id: true, code: true, name: true, currentHourMeter: true } },
          pmType: { select: { name: true } },
        },
        take: 5,
        orderBy: { nextDueHour: "asc" },
      }),
      // 3. Work orders waiting for spare parts
      db.workOrder.findMany({
        where: { status: WorkOrderStatus.WAITING_PART, deletedAt: null },
        include: {
          equipment: { select: { id: true, code: true, name: true } },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      // 4. Certificates expiring in <= 30 days
      db.inspection.findMany({
        where: {
          deletedAt: null,
          validUntil: {
            not: null,
            lte: in30Days,
          },
        },
        include: {
          equipment: { select: { id: true, code: true, name: true } },
          inspectionType: { select: { name: true } },
        },
        take: 5,
        orderBy: { validUntil: "asc" },
      }),
    ]);

    const notifications: SystemNotification[] = [];

    for (const bd of activeBreakdowns) {
      notifications.push({
        id: `bd-${bd.id}`,
        type: "BREAKDOWN",
        title: `Kerusakan: ${bd.equipment.code}`,
        description: bd.problem,
        href: `/work-order`,
        createdAt: bd.reportedAt.toISOString(),
        severity: "critical",
      });
    }

    for (const pm of overduePm) {
      notifications.push({
        id: `pm-${pm.id}`,
        type: "PM_OVERDUE",
        title: `PM Telat Servis: ${pm.equipment.code}`,
        description: `${pm.pmType.name} melebihi batas jam kerja unit (${pm.equipment.currentHourMeter.toLocaleString("id-ID")} Jam)`,
        href: `/preventive/execute/${pm.id}`,
        createdAt: pm.nextDueDate ? pm.nextDueDate.toISOString() : new Date().toISOString(),
        severity: "warning",
      });
    }

    for (const wo of waitingPartWo) {
      notifications.push({
        id: `wo-${wo.id}`,
        type: "WAITING_PART",
        title: `WO Menunggu Part: ${wo.code}`,
        description: `Perbaikan unit ${wo.equipment.code} tertahan menunggu suku cadang.`,
        href: `/work-order/${wo.id}`,
        createdAt: wo.createdAt.toISOString(),
        severity: "warning",
      });
    }

    for (const ins of expiringCerts) {
      notifications.push({
        id: `ins-${ins.id}`,
        type: "EXPIRING_CERTIFICATE",
        title: `Sertifikat Kelaikan: ${ins.equipment.code}`,
        description: `${ins.inspectionType.name} akan/sudah kedaluwarsa.`,
        href: `/inspection/${ins.id}`,
        createdAt: ins.createdAt.toISOString(),
        severity: "info",
      });
    }

    return notifications;
  } catch (error) {
    console.error("Error fetching system notifications:", error);
    return [];
  }
}
