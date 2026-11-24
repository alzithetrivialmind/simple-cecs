"use server";

import { db } from "@/lib/db";
import { toUserMessage } from "@/lib/errors";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { generateWorkOrderCode } from "@/lib/numbering";
import { calculatePmStatus, recalcAllPmPlans } from "@/server/services/pm-status";
import { createAuditLog } from "@/lib/audit";
import {
  pmPlanSchema,
  PmPlanInput,
  pmChecklistTemplateSchema,
  PmChecklistTemplateInput,
  executePmSchema,
  ExecutePmInput,
} from "@/lib/validations/pm";
import {
  EquipmentCategory,
  PmBasis,
  PmStatus,
  Prisma,
  WorkOrderStatus,
  WorkOrderType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface GetPmScheduleParams {
  status?: PmStatus | "ALL";
  basis?: PmBasis | "ALL";
  equipmentId?: string;
  search?: string;
}

export async function getPmSchedule(params?: GetPmScheduleParams) {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  // First, auto-recalculate to guarantee fresh status
  await recalcAllPmPlans();

  const where: Prisma.PmPlanWhereInput = {
    isActive: true,
    deletedAt: null,
    equipment: {
      deletedAt: null,
    },
    ...(params?.status && params.status !== "ALL" ? { status: params.status } : {}),
    ...(params?.basis && params.basis !== "ALL" ? { basis: params.basis } : {}),
    ...(params?.equipmentId ? { equipmentId: params.equipmentId } : {}),
  };

  if (params?.search) {
    const s = params.search.toLowerCase();
    where.OR = [
      { equipment: { name: { contains: s, mode: "insensitive" } } },
      { equipment: { code: { contains: s, mode: "insensitive" } } },
      { pmType: { name: { contains: s, mode: "insensitive" } } },
    ];
  }

  return db.pmPlan.findMany({
    where,
    orderBy: [
      { status: "asc" }, // OVERDUE first, then DUE, then UPCOMING
      { nextDueHour: "asc" },
      { nextDueDate: "asc" },
    ],
    include: {
      equipment: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          status: true,
          currentHourMeter: true,
          location: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      },
      pmType: {
        select: {
          id: true,
          name: true,
        },
      },
      executions: {
        take: 1,
        orderBy: { executedAt: "desc" },
        select: {
          id: true,
          hourMeter: true,
          executedAt: true,
        },
      },
    },
  });
}

export async function getPmPlanById(id: string) {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const plan = await db.pmPlan.findUnique({
    where: { id },
    include: {
      equipment: {
        include: {
          department: true,
          location: true,
        },
      },
      pmType: true,
      executions: {
        orderBy: { executedAt: "desc" },
        include: {
          workOrder: {
            select: { id: true, code: true, status: true },
          },
        },
      },
    },
  });

  if (!plan) return null;

  // Find corresponding checklist template based on equipment category and pmTypeId
  const template = await db.pmChecklistTemplate.findFirst({
    where: {
      category: plan.equipment.category,
      pmTypeId: plan.pmTypeId,
      isActive: true,
    },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return {
    ...plan,
    checklistTemplate: template,
  };
}

export async function createPmPlan(data: PmPlanInput) {
  const user = await requireRole(["ADMIN", "SUPERVISOR"]);

  const validation = pmPlanSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const {
    equipmentId,
    pmTypeId,
    basis,
    intervalHour,
    intervalDays,
    lastDoneHour,
    lastDoneDate,
  } = validation.data;

  // Check unique combination
  const existing = await db.pmPlan.findUnique({
    where: {
      equipmentId_pmTypeId: {
        equipmentId,
        pmTypeId,
      },
    },
  });

  if (existing) {
    return {
      success: false,
      error: "Jadwal PM untuk unit dan tipe PM ini sudah pernah dibuat.",
    };
  }

  const equipment = await db.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, code: true, currentHourMeter: true, deletedAt: true },
  });

  if (!equipment || equipment.deletedAt) {
    return { success: false, error: "Unit equipment tidak ditemukan." };
  }

  const calc = calculatePmStatus(
    {
      basis,
      intervalHour,
      intervalDays,
      lastDoneHour,
      lastDoneDate,
      createdAt: new Date(),
    },
    equipment.currentHourMeter,
    new Date()
  );

  const plan = await db.pmPlan.create({
    data: {
      equipmentId,
      pmTypeId,
      basis,
      intervalHour: intervalHour || null,
      intervalDays: intervalDays || null,
      lastDoneHour: lastDoneHour || null,
      lastDoneDate: lastDoneDate || null,
      nextDueHour: calc.nextDueHour,
      nextDueDate: calc.nextDueDate,
      status: calc.status,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    entity: "PmPlan",
    entityId: plan.id,
    newValue: `PM Plan dibuat untuk unit ${equipment.code} (basis ${basis})`,
  });

  revalidatePath("/preventive");
  revalidatePath(`/equipment/${equipmentId}`);
  revalidatePath("/dashboard");

  return { success: true, planId: plan.id };
}

export async function executePmPlan(data: ExecutePmInput) {
  const user = await requireRole(["ADMIN", "SUPERVISOR", "TECHNICIAN"]);

  const validation = executePmSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input checklist tidak valid",
    };
  }

  const { pmPlanId, technicianId, hourMeter, executedAt, results, generalNote } =
    validation.data;

  const plan = await db.pmPlan.findUnique({
    where: { id: pmPlanId },
    include: {
      equipment: true,
      pmType: true,
    },
  });

  if (!plan || !plan.isActive || plan.equipment.deletedAt) {
    return { success: false, error: "Jadwal PM tidak ditemukan atau tidak aktif." };
  }

  // VALIDATION: Hour meter cannot decrease
  if (hourMeter < plan.equipment.currentHourMeter) {
    return {
      success: false,
      error: `Hour meter (${hourMeter} Jam) tidak boleh lebih kecil dari data saat ini (${plan.equipment.currentHourMeter} Jam).`,
    };
  }

  const executionDate = executedAt || new Date();

  try {
    const result = await db.$transaction(async (tx) => {
      // 1. Generate WO Code
      const woCode = await generateWorkOrderCode(tx);

      // 2. Create PREVENTIVE WorkOrder (status: CLOSED langsung setelah eksekusi lengkap)
      const workOrder = await tx.workOrder.create({
        data: {
          code: woCode,
          equipmentId: plan.equipmentId,
          pmPlanId: plan.id,
          type: WorkOrderType.PREVENTIVE,
          status: WorkOrderStatus.CLOSED,
          assignedToId: technicianId || user.id,
          startedAt: executionDate,
          finishedAt: executionDate,
          closedAt: executionDate,
          closedById: user.id,
          downtimeMinutes: 0,
        },
      });

      // 3. Create RepairResult for summary
      await tx.repairResult.create({
        data: {
          workOrderId: workOrder.id,
          correctiveAction: `Eksekusi PM ${plan.pmType.name} selesai. Seluruh checklist diverifikasi.`,
          remark: generalNote || null,
        },
      });

      // 4. Create Status History
      await tx.workOrderStatusHistory.create({
        data: {
          workOrderId: workOrder.id,
          fromStatus: null,
          toStatus: WorkOrderStatus.CLOSED,
          changedById: user.id,
          note: `PM ${plan.pmType.name} berhasil dieksekusi oleh ${user.name}`,
        },
      });

      // 5. Create PmExecution
      const execution = await tx.pmExecution.create({
        data: {
          workOrderId: workOrder.id,
          pmPlanId: plan.id,
          hourMeter,
          results,
          executedAt: executionDate,
        },
      });

      // 6. Record HourMeterLog
      await tx.hourMeterLog.create({
        data: {
          equipmentId: plan.equipmentId,
          readingDate: executionDate,
          hourMeter,
          source: "PM",
          remark: `Eksekusi PM ${plan.pmType.name} (#${woCode})`,
          createdById: user.id,
        },
      });

      // 7. Update Equipment currentHourMeter if greater
      if (hourMeter > plan.equipment.currentHourMeter) {
        await tx.equipment.update({
          where: { id: plan.equipmentId },
          data: { currentHourMeter: hourMeter },
        });
      }

      // 8. Calculate Next Due point
      const newLastDoneHour = plan.basis === PmBasis.HOUR_METER ? hourMeter : plan.lastDoneHour;
      const newLastDoneDate = executionDate;

      const calc = calculatePmStatus(
        {
          basis: plan.basis,
          intervalHour: plan.intervalHour,
          intervalDays: plan.intervalDays,
          lastDoneHour: newLastDoneHour,
          lastDoneDate: newLastDoneDate,
          createdAt: plan.equipment.createdAt,
        },
        hourMeter,
        new Date()
      );

      // 9. Update PmPlan
      await tx.pmPlan.update({
        where: { id: plan.id },
        data: {
          lastDoneHour: newLastDoneHour,
          lastDoneDate: newLastDoneDate,
          nextDueHour: calc.nextDueHour,
          nextDueDate: calc.nextDueDate,
          status: calc.status,
        },
      });

      // 10. Audit Log
      await createAuditLog({
        userId: user.id,
        action: "CREATE",
        entity: "PmExecution",
        entityId: execution.id,
        newValue: `PM ${plan.pmType.name} dieksekusi untuk ${plan.equipment.code}. WO #${woCode}.`,
      });

      return { workOrder, execution };
    });

    revalidatePath("/preventive");
    revalidatePath(`/preventive/${plan.id}`);
    revalidatePath("/work-order");
    revalidatePath(`/work-order/${result.workOrder.id}`);
    revalidatePath("/equipment");
    revalidatePath(`/equipment/${plan.equipmentId}`);
    revalidatePath("/hour-meter");
    revalidatePath("/dashboard");

    return {
      success: true,
      workOrderId: result.workOrder.id,
      workOrderCode: result.workOrder.code,
    };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal mengeksekusi PM.");
    return { success: false, error: msg };
  }
}

export async function getPmChecklistTemplates(category?: EquipmentCategory) {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const where = category ? { category, isActive: true } : { isActive: true };

  return db.pmChecklistTemplate.findMany({
    where,
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      pmType: { select: { id: true, name: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function savePmChecklistTemplate(data: PmChecklistTemplateInput) {
  await requireRole(["ADMIN", "SUPERVISOR"]);

  const validation = pmChecklistTemplateSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input template tidak valid",
    };
  }

  const { id, name, category, pmTypeId, isActive, items } = validation.data;

  try {
    if (id) {
      // Update template and recreate items
      await db.$transaction(async (tx) => {
        await tx.pmChecklistTemplate.update({
          where: { id },
          data: { name, category, pmTypeId, isActive },
        });

        await tx.pmChecklistItem.deleteMany({
          where: { templateId: id },
        });

        await tx.pmChecklistItem.createMany({
          data: items.map((item, idx) => ({
            templateId: id,
            label: item.label,
            sortOrder: idx,
          })),
        });
      });
    } else {
      // Create new template
      await db.$transaction(async (tx) => {
        const t = await tx.pmChecklistTemplate.create({
          data: {
            name,
            category,
            pmTypeId,
            isActive,
          },
        });

        await tx.pmChecklistItem.createMany({
          data: items.map((item, idx) => ({
            templateId: t.id,
            label: item.label,
            sortOrder: idx,
          })),
        });
      });
    }

    revalidatePath("/preventive/templates");
    revalidatePath("/preventive");

    return { success: true };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menyimpan template checklist.");
    return { success: false, error: msg };
  }
}

export async function deletePmPlan(id: string) {
  const admin = await requireRole(["ADMIN"]);

  const existing = await db.pmPlan.findUnique({
    where: { id },
    select: { id: true, equipmentId: true, deletedAt: true },
  });

  if (!existing || existing.deletedAt) {
    return { success: false, error: "PM Plan tidak ditemukan atau sudah dihapus." };
  }

  try {
    await db.pmPlan.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await createAuditLog({
      userId: admin.id,
      action: "DELETE",
      entity: "PmPlan",
      entityId: id,
      reason: "Penghapusan oleh Admin",
      details: `PM Plan dihapus.`,
    });

    revalidatePath("/preventive");
    revalidatePath(`/equipment/${existing.equipmentId}`);
    
    return { success: true };
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menghapus PM Plan.");
    return { success: false, error: msg };
  }
}

