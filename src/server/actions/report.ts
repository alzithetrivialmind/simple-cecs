"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { REPORT_ROLES } from "@/lib/roles";
import { EquipmentCategory, PartSystem, PmStatus, WorkOrderStatus, WorkOrderType } from "@prisma/client";

export interface ReportFilter {
  startDate?: Date;
  endDate?: Date;
  category?: EquipmentCategory;
  departmentId?: string;
  equipmentId?: string;
}

export async function getDowntimeReport(filter?: ReportFilter) {
  // Laporan & analitik: hanya manajemen (SUPERVISOR/ADMIN)
  await requireRole(REPORT_ROLES);

  const now = new Date();
  const startDate = filter?.startDate ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const endDate = filter?.endDate ?? now;

  // Find closed work orders in date range with downtimeMinutes
  const workOrders = await db.workOrder.findMany({
    where: {
      type: { in: [WorkOrderType.CORRECTIVE, WorkOrderType.INSPECTION_FOLLOW_UP] },
      status: WorkOrderStatus.CLOSED,
      closedAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(filter?.equipmentId ? { equipmentId: filter.equipmentId } : {}),
      equipment: {
        deletedAt: null,
        ...(filter?.category ? { category: filter.category } : {}),
        ...(filter?.departmentId ? { departmentId: filter.departmentId } : {}),
      },
    },
    include: {
      equipment: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          currentHourMeter: true,
          department: { select: { id: true, name: true } },
        },
      },
      breakdownRequest: {
        select: { problem: true, priority: true, reportedAt: true },
      },
      diagnosis: {
        select: { rootCause: true, finding: true },
      },
      repairResult: {
        select: { correctiveAction: true },
      },
    },
    orderBy: { closedAt: "desc" },
  });

  // Calculate totals
  const totalIncidents = workOrders.length;
  let totalDowntimeMinutes = 0;
  type EquipmentSummary = (typeof workOrders)[number]["equipment"];
  const downtimeByEquipmentMap = new Map<string, { equipment: EquipmentSummary; count: number; downtimeMinutes: number }>();
  const downtimeByCategoryMap = new Map<string, { category: EquipmentCategory; count: number; downtimeMinutes: number }>();

  for (const wo of workOrders) {
    const dt = wo.downtimeMinutes ?? 0;
    totalDowntimeMinutes += dt;

    // By equipment
    const eqId = wo.equipment.id;
    const existingEq = downtimeByEquipmentMap.get(eqId) ?? {
      equipment: wo.equipment,
      count: 0,
      downtimeMinutes: 0,
    };
    existingEq.count += 1;
    existingEq.downtimeMinutes += dt;
    downtimeByEquipmentMap.set(eqId, existingEq);

    // By category
    const cat = wo.equipment.category;
    const existingCat = downtimeByCategoryMap.get(cat) ?? {
      category: cat,
      count: 0,
      downtimeMinutes: 0,
    };
    existingCat.count += 1;
    existingCat.downtimeMinutes += dt;
    downtimeByCategoryMap.set(cat, existingCat);
  }

  // MTTR (Mean Time to Repair in hours)
  const mttrHours = totalIncidents > 0 ? Number((totalDowntimeMinutes / totalIncidents / 60).toFixed(1)) : 0;

  // MTBF approximation (Operating hours / incidents)
  const totalEquipments = await db.equipment.count({
    where: {
      deletedAt: null,
      ...(filter?.category ? { category: filter.category } : {}),
      ...(filter?.departmentId ? { departmentId: filter.departmentId } : {}),
    },
  });

  const periodDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  // Estimated total available operating hours in period (assuming 8 hours/day/unit)
  const totalAvailableHours = totalEquipments * periodDays * 8;
  const mtbfHours = totalIncidents > 0 ? Math.round(totalAvailableHours / totalIncidents) : totalAvailableHours;

  return {
    period: { startDate, endDate, periodDays },
    totalIncidents,
    totalDowntimeMinutes,
    totalDowntimeHours: Number((totalDowntimeMinutes / 60).toFixed(1)),
    mttrHours,
    mtbfHours,
    workOrders,
    byEquipment: Array.from(downtimeByEquipmentMap.values()).sort((a, b) => b.downtimeMinutes - a.downtimeMinutes),
    byCategory: Array.from(downtimeByCategoryMap.values()).sort((a, b) => b.downtimeMinutes - a.downtimeMinutes),
  };
}

export async function getPmComplianceReport(filter?: ReportFilter) {
  // Laporan & analitik: hanya manajemen (SUPERVISOR/ADMIN)
  await requireRole(REPORT_ROLES);

  const plans = await db.pmPlan.findMany({
    where: {
      isActive: true,
      equipment: {
        deletedAt: null,
        ...(filter?.category ? { category: filter.category } : {}),
        ...(filter?.departmentId ? { departmentId: filter.departmentId } : {}),
      },
    },
    include: {
      equipment: {
        select: { id: true, code: true, name: true, category: true, currentHourMeter: true },
      },
      pmType: { select: { id: true, name: true } },
      executions: {
        take: 5,
        orderBy: { executedAt: "desc" },
      },
    },
  });

  const totalPlans = plans.length;
  const upcomingCount = plans.filter((p) => p.status === PmStatus.UPCOMING).length;
  const dueCount = plans.filter((p) => p.status === PmStatus.DUE).length;
  const overdueCount = plans.filter((p) => p.status === PmStatus.OVERDUE).length;

  const complianceRate = totalPlans > 0 ? Number((((totalPlans - overdueCount) / totalPlans) * 100).toFixed(1)) : 100;

  return {
    totalPlans,
    upcomingCount,
    dueCount,
    overdueCount,
    complianceRate,
    plans,
  };
}

export async function getPartUsageReport(filter?: ReportFilter) {
  // Laporan & analitik: hanya manajemen (SUPERVISOR/ADMIN)
  await requireRole(REPORT_ROLES);

  const now = new Date();
  const startDate = filter?.startDate ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const endDate = filter?.endDate ?? now;

  const usages = await db.partUsage.findMany({
    where: {
      deletedAt: null,
      usedAt: {
        gte: startDate,
        lte: endDate,
      },
      workOrder: {
        equipment: {
          deletedAt: null,
          ...(filter?.category ? { category: filter.category } : {}),
          ...(filter?.departmentId ? { departmentId: filter.departmentId } : {}),
          ...(filter?.equipmentId ? { id: filter.equipmentId } : {}),
        },
      },
    },
    include: {
      part: true,
      workOrder: {
        include: {
          equipment: {
            select: { id: true, code: true, name: true, category: true },
          },
        },
      },
    },
    orderBy: { usedAt: "desc" },
  });

  let totalPartsUsed = 0;
  const bySystemMap = new Map<PartSystem, { system: PartSystem; totalQty: number; count: number }>();
  type PartDetail = (typeof usages)[number]["part"];
  const topPartsMap = new Map<string, { part: PartDetail; totalQty: number }>();

  for (const u of usages) {
    totalPartsUsed += u.qty;

    // By System
    const sys = u.part.system;
    const existingSys = bySystemMap.get(sys) ?? { system: sys, totalQty: 0, count: 0 };
    existingSys.totalQty += u.qty;
    existingSys.count += 1;
    bySystemMap.set(sys, existingSys);

    // Top parts
    const pId = u.part.id;
    const existingP = topPartsMap.get(pId) ?? { part: u.part, totalQty: 0 };
    existingP.totalQty += u.qty;
    topPartsMap.set(pId, existingP);
  }

  return {
    totalUsagesCount: usages.length,
    totalQuantity: totalPartsUsed,
    usages,
    bySystem: Array.from(bySystemMap.values()).sort((a, b) => b.totalQty - a.totalQty),
    topParts: Array.from(topPartsMap.values()).sort((a, b) => b.totalQty - a.totalQty).slice(0, 10),
  };
}
