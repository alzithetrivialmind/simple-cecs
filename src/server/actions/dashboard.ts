"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { EquipmentStatus, PmStatus, WorkOrderStatus } from "@prisma/client";

export async function getDashboardData() {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  // Awal bulan 11 bulan lalu (12 bulan termasuk bulan ini)
  const chartStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const liveEquipment = { deletedAt: null };

  const [
    equipments,
    activeBreakdowns,
    openWorkOrders,
    pmOverdueList,
    pmDueList,
    expiringCertificates,
    recentWorkOrders,
    totalPmPlans,
    upcomingPmPlans,
    breakdownsForChart,
    closedWorkOrders,
  ] = await Promise.all([
    db.equipment.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        status: true,
        currentHourMeter: true,
        department: { select: { name: true } },
        location: { select: { name: true } },
      },
    }),
    db.breakdownRequest.findMany({
      where: {
        deletedAt: null,
        equipment: liveEquipment,
        status: "SUBMITTED",
      },
      include: {
        equipment: { select: { id: true, code: true, name: true, category: true } },
        reportedBy: { select: { name: true, avatarUrl: true } },
      },
      orderBy: { reportedAt: "desc" },
    }),
    db.workOrder.findMany({
      where: {
        deletedAt: null,
        equipment: liveEquipment,
        status: { in: [WorkOrderStatus.OPEN, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.WAITING_PART] },
      },
      include: {
        equipment: { select: { id: true, code: true, name: true } },
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.pmPlan.findMany({
      where: { status: PmStatus.OVERDUE, isActive: true, deletedAt: null, equipment: liveEquipment },
      include: {
        equipment: { select: { id: true, code: true, name: true, category: true, currentHourMeter: true } },
        pmType: { select: { name: true } },
      },
      orderBy: { nextDueHour: "asc" },
    }),
    db.pmPlan.findMany({
      where: { status: PmStatus.DUE, isActive: true, deletedAt: null, equipment: liveEquipment },
      include: {
        equipment: { select: { id: true, code: true, name: true, category: true, currentHourMeter: true } },
        pmType: { select: { name: true } },
      },
      orderBy: { nextDueHour: "asc" },
    }),
    db.inspection.findMany({
      where: {
        deletedAt: null,
        equipment: liveEquipment,
        validUntil: {
          not: null,
          lte: in30Days,
        },
      },
      include: {
        equipment: { select: { id: true, code: true, name: true } },
        inspectionType: { select: { name: true } },
      },
      orderBy: { validUntil: "asc" },
    }),
    db.workOrder.findMany({
      where: { deletedAt: null, equipment: liveEquipment },
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        equipment: { select: { id: true, code: true, name: true, category: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    db.pmPlan.count({ where: { isActive: true, deletedAt: null, equipment: liveEquipment } }),
    db.pmPlan.count({ where: { isActive: true, deletedAt: null, status: PmStatus.UPCOMING, equipment: liveEquipment } }),
    db.breakdownRequest.findMany({
      where: { deletedAt: null, equipment: liveEquipment, reportedAt: { gte: chartStart } },
      select: { reportedAt: true },
    }),
    db.workOrder.findMany({
      where: {
        deletedAt: null,
        equipment: liveEquipment,
        status: WorkOrderStatus.CLOSED,
        closedAt: { gte: chartStart },
        downtimeMinutes: { gt: 0 },
      },
      select: {
        downtimeMinutes: true,
        equipment: { select: { id: true, code: true, name: true } },
      },
    }),
  ]);

  const totalUnits = equipments.length;
  const readyUnits = equipments.filter((e) => e.status === EquipmentStatus.READY).length;
  const inUseUnits = equipments.filter((e) => e.status === EquipmentStatus.IN_USE).length;
  const breakdownUnits = equipments.filter((e) => e.status === EquipmentStatus.BREAKDOWN).length;
  const underRepairUnits = equipments.filter((e) => e.status === EquipmentStatus.UNDER_REPAIR).length;
  const standbyUnits = equipments.filter((e) => e.status === EquipmentStatus.STANDBY).length;

  const readyRate = totalUnits > 0 ? Number((((readyUnits + inUseUnits) / totalUnits) * 100).toFixed(1)) : 100;
  const totalFleetHours = equipments.reduce((sum, e) => sum + e.currentHourMeter, 0);

  // Group by category
  const categoryStats: Record<string, { total: number; ready: number }> = {};
  for (const eq of equipments) {
    if (!categoryStats[eq.category]) {
      categoryStats[eq.category] = { total: 0, ready: 0 };
    }
    categoryStats[eq.category].total += 1;
    if (eq.status === EquipmentStatus.READY || eq.status === EquipmentStatus.IN_USE) {
      categoryStats[eq.category].ready += 1;
    }
  }

  // Breakdown per bulan, dikelompokkan menurut kalender WIB
  const monthKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(d);
  const monthLabel = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", month: "short" });
  const breakdownsByMonth: { key: string; label: string; count: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(chartStart.getFullYear(), chartStart.getMonth() + i, 15);
    breakdownsByMonth.push({ key: monthKey(d), label: monthLabel.format(d), count: 0 });
  }
  for (const b of breakdownsForChart) {
    const slot = breakdownsByMonth.find((m) => m.key === monthKey(b.reportedAt));
    if (slot) slot.count += 1;
  }

  // 10 unit dengan downtime terbesar dalam 12 bulan
  const downtimeByUnit = new Map<string, { id: string; code: string; name: string; minutes: number }>();
  for (const wo of closedWorkOrders) {
    const cur = downtimeByUnit.get(wo.equipment.id) ?? { ...wo.equipment, minutes: 0 };
    cur.minutes += wo.downtimeMinutes ?? 0;
    downtimeByUnit.set(wo.equipment.id, cur);
  }
  const topDowntime = [...downtimeByUnit.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 10);

  return {
    breakdownsByMonth,
    topDowntime,
    metrics: {
      totalUnits,
      readyUnits,
      breakdownUnits,
      underRepairUnits,
      standbyUnits,
      readyRate,
      totalFleetHours,
      activeBreakdownCount: activeBreakdowns.length,
      openWorkOrderCount: openWorkOrders.length,
      pmTotalCount: totalPmPlans,
      pmUpcomingCount: upcomingPmPlans,
      pmOverdueCount: pmOverdueList.length,
      pmDueCount: pmDueList.length,
      expiringCertCount: expiringCertificates.length,
    },
    categoryStats,
    equipments,
    activeBreakdowns,
    openWorkOrders,
    pmOverdueList,
    pmDueList,
    expiringCertificates,
    recentWorkOrders,
  };
}

export interface TimelineEvent {
  id: string;
  type: "HOUR_METER" | "BREAKDOWN" | "WORK_ORDER" | "PM_EXECUTION" | "INSPECTION";
  date: Date;
  title: string;
  description: string;
  badgeText: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  linkUrl?: string;
  user?: string;
}

export async function getEquipmentTimeline(equipmentId: string): Promise<TimelineEvent[]> {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const [hmLogs, breakdowns, workOrders, inspections] = await Promise.all([
    db.hourMeterLog.findMany({
      where: { equipmentId },
      take: 20,
      orderBy: { readingDate: "desc" },
      include: { createdBy: { select: { name: true } } },
    }),
    db.breakdownRequest.findMany({
      where: { equipmentId, deletedAt: null },
      take: 20,
      orderBy: { reportedAt: "desc" },
      include: { reportedBy: { select: { name: true } } },
    }),
    db.workOrder.findMany({
      where: { equipmentId },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        assignedTo: { select: { name: true } },
        pmPlan: { include: { pmType: true } },
      },
    }),
    db.inspection.findMany({
      where: { equipmentId, deletedAt: null },
      take: 20,
      orderBy: { inspectionDate: "desc" },
      include: {
        inspector: { select: { name: true } },
        inspectionType: { select: { name: true } },
      },
    }),
  ]);

  const events: TimelineEvent[] = [];

  for (const hm of hmLogs) {
    events.push({
      id: `hm-${hm.id}`,
      type: "HOUR_METER",
      date: hm.readingDate,
      title: `Catatan Jam Operasi (${hm.hourMeter.toLocaleString("id-ID")} Jam)`,
      description: hm.remark || `Pencatatan hour meter via sumber ${hm.source}`,
      badgeText: `HM: ${hm.source}`,
      badgeVariant: "secondary",
      user: hm.createdBy.name,
    });
  }

  for (const bd of breakdowns) {
    events.push({
      id: `bd-${bd.id}`,
      type: "BREAKDOWN",
      date: bd.reportedAt,
      title: `Laporan Kerusakan #${bd.code}`,
      description: bd.problem,
      badgeText: `Prioritas ${bd.priority}`,
      badgeVariant: bd.priority === "CRITICAL" || bd.priority === "HIGH" ? "destructive" : "default",
      user: bd.reportedBy.name,
    });
  }

  for (const wo of workOrders) {
    events.push({
      id: `wo-${wo.id}`,
      type: "WORK_ORDER",
      date: wo.createdAt,
      title: `Work Order #${wo.code} (${wo.type})`,
      description: `Status: ${wo.status}${wo.pmPlan ? ` - PM ${wo.pmPlan.pmType.name}` : ""}`,
      badgeText: wo.status,
      badgeVariant: wo.status === "CLOSED" ? "outline" : "default",
      linkUrl: `/work-order/${wo.id}`,
      user: wo.assignedTo?.name,
    });
  }

  for (const ins of inspections) {
    events.push({
      id: `ins-${ins.id}`,
      type: "INSPECTION",
      date: ins.inspectionDate,
      title: `Inspeksi #${ins.code} (${ins.inspectionType.name})`,
      description: `Hasil: ${ins.result}${ins.finding ? ` - Temuan: ${ins.finding}` : ""}`,
      badgeText: ins.result,
      badgeVariant: ins.result === "FAIL" ? "destructive" : "secondary",
      linkUrl: `/inspection/${ins.id}`,
      user: ins.inspector.name,
    });
  }

  // Sort descending by date
  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}
