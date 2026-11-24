import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, requireAuthPage } from "@/lib/auth-guard";
import { getWorkOrderById } from "@/server/actions/work-order";
import { recordPageView } from "@/server/actions/audit-log";
import { WorkOrderDetailClient } from "@/components/work-order/work-order-detail-client";

export const metadata = {
  title: "Detail Perintah Kerja — CECS",
};

interface WorkOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkOrderDetailPage({
  params,
}: WorkOrderDetailPageProps) {
  const { id } = await params;
  await requireAuthPage();

  const [user, workOrder, technicians, partsList] = await Promise.all([
    getCurrentUser(),
    getWorkOrderById(id),
    db.user.findMany({
      where: {
        deletedAt: null,
        role: { in: ["TECHNICIAN", "SUPERVISOR", "ADMIN"] },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, nik: true, role: true, avatarUrl: true },
    }),
    db.part.findMany({
      where: { deletedAt: null },
      orderBy: { partNumber: "asc" },
      select: { id: true, partNumber: true, description: true, unit: true },
    }),
  ]);

  if (!workOrder) {
    notFound();
  }

  // Record audit log for page view (si a buka apa)
  await recordPageView(
    "WorkOrder",
    workOrder.code,
    `Membuka data Work Order: #${workOrder.code} (${workOrder.equipment?.code || ""})`
  );

  return (
    <WorkOrderDetailClient
      workOrder={workOrder}
      technicians={technicians}
      partsList={partsList}
      userRole={user?.role}
    />
  );
}
