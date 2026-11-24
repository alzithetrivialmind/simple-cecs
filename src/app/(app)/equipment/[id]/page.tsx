import { notFound } from "next/navigation";
import { getEquipmentById } from "@/server/actions/equipment";
import { recordPageView } from "@/server/actions/audit-log";
import { EquipmentDetailClient } from "@/components/equipment/equipment-detail-client";
import { getCurrentUser, requireAuthPage } from "@/lib/auth-guard";
import { getActiveUsageSession } from "@/server/actions/usage-session";
import { getDetailedEquipmentTimeline } from "@/server/actions/timeline";
import { db } from "@/lib/db";
import { WorkOrderStatus } from "@prisma/client";

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Page-safe: redirect ke /login jika sesi tidak ada
  await requireAuthPage();
  const user = await getCurrentUser();
  const equipment = await getEquipmentById(id);

  if (!equipment) {
    notFound();
  }

  // Fetch full chronological equipment timeline events (Usage, Breakdown, WO, HM, Inspections)
  const timelineEvents = await getDetailedEquipmentTimeline(id);

  // Active usage session on this equipment
  const activeSession = await getActiveUsageSession(id);

  // Active work orders for field execution
  const activeWorkOrders = await db.workOrder.findMany({
    where: {
      equipmentId: id,
      deletedAt: null,
      status: {
        notIn: [WorkOrderStatus.CLOSED],
      },
    },
    include: {
      assignedTo: { select: { id: true, name: true, nik: true, avatarUrl: true } },
      breakdownRequest: {
        select: {
          problem: true,
          priority: true,
          reportedBy: { select: { name: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Spare parts list for technician issue
  const partsList = await db.part.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      partNumber: true,
      description: true,
      unit: true,
    },
    orderBy: { partNumber: "asc" },
  });

  // Technicians list for supervisor assignment
  const techniciansList = await db.user.findMany({
    where: {
      role: "TECHNICIAN",
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      nik: true,
      avatarUrl: true,
    },
    orderBy: { name: "asc" },
  });

  // Record audit log for page view (si a buka apa)
  await recordPageView(
    "Equipment",
    equipment.code,
    `Membuka data detail equipment: ${equipment.code} - ${equipment.name}`
  );

  return (
    <EquipmentDetailClient
      equipment={equipment}
      userRole={user?.role}
      currentUser={
        user
          ? {
              id: user.id,
              name: user.name,
              nik: user.nik,
              role: user.role,
            }
          : null
      }
      activeSession={
        activeSession
          ? {
              id: activeSession.id,
              operatorId: activeSession.operatorId,
              startAt: activeSession.startAt,
              startPhotoUrl: activeSession.startPhotoUrl,
              remarks: activeSession.remarks,
              operator: activeSession.operator,
            }
          : null
      }
      activeWorkOrders={activeWorkOrders}
      partsList={partsList}
      techniciansList={techniciansList}
      timelineEvents={timelineEvents}
    />
  );
}
