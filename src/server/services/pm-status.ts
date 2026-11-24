import { db } from "@/lib/db";
import { PmBasis, PmStatus, Prisma } from "@prisma/client";

export interface PmPlanCalculationInput {
  basis: PmBasis;
  intervalHour?: number | null;
  intervalDays?: number | null;
  lastDoneHour?: number | null;
  lastDoneDate?: Date | null;
  createdAt?: Date | null;
}

export interface PmCalculationResult {
  status: PmStatus;
  nextDueHour: number | null;
  nextDueDate: Date | null;
  remainingHours: number | null;
  remainingDays: number | null;
}

/**
 * Pure calculation function to determine PM status, next due point, and remaining threshold.
 */
export function calculatePmStatus(
  plan: PmPlanCalculationInput,
  currentHourMeter: number = 0,
  referenceDate: Date = new Date()
): PmCalculationResult {
  if (plan.basis === PmBasis.HOUR_METER) {
    const interval = plan.intervalHour || 250;
    const baseHour = plan.lastDoneHour ?? 0;
    const nextDueHour = baseHour + interval;
    const remainingHours = nextDueHour - currentHourMeter;

    let status: PmStatus = PmStatus.UPCOMING;
    if (currentHourMeter >= nextDueHour) {
      status = PmStatus.OVERDUE;
    } else if (remainingHours < 0.1 * interval) {
      // PRD: DUE jika sisa kurang dari 10 persen interval
      status = PmStatus.DUE;
    }

    return {
      status,
      nextDueHour,
      nextDueDate: null,
      remainingHours,
      remainingDays: null,
    };
  } else {
    // Basis CALENDAR
    const interval = plan.intervalDays || 90;
    const baseDate = plan.lastDoneDate
      ? new Date(plan.lastDoneDate)
      : plan.createdAt
      ? new Date(plan.createdAt)
      : new Date();
    const nextDueDate = new Date(baseDate.getTime() + interval * 24 * 60 * 60 * 1000);

    const dayMs = 24 * 60 * 60 * 1000;
    const diffMs = nextDueDate.getTime() - referenceDate.getTime();
    const remainingDays = Math.ceil(diffMs / dayMs);

    let status: PmStatus = PmStatus.UPCOMING;
    if (diffMs < 0) {
      // PRD: OVERDUE jika hari ini melewati nextDueDate
      status = PmStatus.OVERDUE;
    } else if (diffMs < 7 * dayMs) {
      // PRD: DUE jika sisa kurang dari 7 hari
      status = PmStatus.DUE;
    }

    return {
      status,
      nextDueHour: null,
      nextDueDate,
      remainingHours: null,
      remainingDays,
    };
  }
}

/**
 * Recalculate and persist PM status for all active PM Plans in the database.
 */
export async function recalcAllPmPlans(tx?: Prisma.TransactionClient) {
  const client = tx ?? db;

  const plans = await client.pmPlan.findMany({
    where: { isActive: true },
    include: {
      equipment: {
        select: { id: true, currentHourMeter: true, deletedAt: true, createdAt: true },
      },
    },
  });

  const now = new Date();
  let updatedCount = 0;
  const counts = { upcoming: 0, due: 0, overdue: 0 };

  for (const plan of plans) {
    if (plan.equipment.deletedAt) continue;

    const calc = calculatePmStatus(
      {
        basis: plan.basis,
        intervalHour: plan.intervalHour,
        intervalDays: plan.intervalDays,
        lastDoneHour: plan.lastDoneHour,
        lastDoneDate: plan.lastDoneDate,
        createdAt: plan.equipment.createdAt,
      },
      plan.equipment.currentHourMeter,
      now
    );

    if (calc.status === PmStatus.OVERDUE) counts.overdue++;
    else if (calc.status === PmStatus.DUE) counts.due++;
    else counts.upcoming++;

    if (
      plan.status !== calc.status ||
      plan.nextDueHour !== calc.nextDueHour ||
      plan.nextDueDate?.getTime() !== calc.nextDueDate?.getTime()
    ) {
      await client.pmPlan.update({
        where: { id: plan.id },
        data: {
          status: calc.status,
          nextDueHour: calc.nextDueHour,
          nextDueDate: calc.nextDueDate,
        },
      });
      updatedCount++;
    }
  }

  return {
    totalChecked: plans.length,
    updatedCount,
    counts,
  };
}
