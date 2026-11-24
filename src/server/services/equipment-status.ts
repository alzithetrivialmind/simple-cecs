import { db } from "@/lib/db";
import { EquipmentStatus, Prisma, UsageStatus, WorkOrderStatus, WorkOrderType } from "@prisma/client";

/**
 * Synchronize equipment status based on its active work orders and usage sessions.
 *
 * Rules:
 * 1. If equipment is SCRAPPED, status will never change.
 * 2. If any active WorkOrder is IN_PROGRESS or WAITING_PART -> UNDER_REPAIR.
 * 3. Else if any active WorkOrder is CORRECTIVE with status OPEN -> BREAKDOWN.
 * 4. Else if there is an active operator usage session -> IN_USE.
 * 5. Else if all active WorkOrders are DONE or CLOSED -> READY (or keep STANDBY if was STANDBY).
 */
export async function syncEquipmentStatus(
  equipmentId: string,
  tx?: Prisma.TransactionClient
): Promise<EquipmentStatus> {
  const client = tx ?? db;

  const equipment = await client.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, status: true },
  });

  if (!equipment) {
    throw new Error(`Equipment dengan ID ${equipmentId} tidak ditemukan.`);
  }

  // Scrapped units do not change status automatically
  if (equipment.status === EquipmentStatus.SCRAPPED) {
    return EquipmentStatus.SCRAPPED;
  }

  // Fetch active work orders (excluding CLOSED)
  const activeWorkOrders = await client.workOrder.findMany({
    where: {
      equipmentId,
      deletedAt: null,
      status: {
        notIn: [WorkOrderStatus.CLOSED],
      },
    },
    select: {
      id: true,
      type: true,
      status: true,
    },
  });

  const hasRepairing = activeWorkOrders.some(
    (wo) =>
      wo.status === WorkOrderStatus.IN_PROGRESS ||
      wo.status === WorkOrderStatus.WAITING_PART
  );

  const hasOpenCorrective = activeWorkOrders.some(
    (wo) =>
      wo.type === WorkOrderType.CORRECTIVE &&
      wo.status === WorkOrderStatus.OPEN
  );

  // Check active operator usage session
  const activeUsage = await client.equipmentUsageSession.findFirst({
    where: {
      equipmentId,
      status: UsageStatus.ACTIVE,
    },
  });

  let newStatus: EquipmentStatus = EquipmentStatus.READY;

  if (hasRepairing) {
    newStatus = EquipmentStatus.UNDER_REPAIR;
  } else if (hasOpenCorrective) {
    newStatus = EquipmentStatus.BREAKDOWN;
  } else if (activeUsage) {
    newStatus = EquipmentStatus.IN_USE;
  } else {
    // Keep STANDBY if previously STANDBY and no issues, otherwise set to READY
    newStatus =
      equipment.status === EquipmentStatus.STANDBY
        ? EquipmentStatus.STANDBY
        : EquipmentStatus.READY;
  }

  if (newStatus !== equipment.status) {
    await client.equipment.update({
      where: { id: equipmentId },
      data: { status: newStatus },
    });
  }

  return newStatus;
}
