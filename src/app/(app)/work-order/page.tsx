import { db } from "@/lib/db";
import { getCurrentUser, requireAuthPage } from "@/lib/auth-guard";
import { getWorkOrders } from "@/server/actions/work-order";
import { WorkOrderListClient } from "@/components/work-order/work-order-list-client";

export const metadata = {
  title: "Perintah Kerja (Work Order) — CECS",
};

export default async function WorkOrderPage() {
  await requireAuthPage();
  const [user, workOrders, technicians] = await Promise.all([
    getCurrentUser(),
    getWorkOrders({ limit: 100 }),
    db.user.findMany({
      where: {
        deletedAt: null,
        role: { in: ["TECHNICIAN", "SUPERVISOR", "ADMIN"] },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, nik: true },
    }),
  ]);

  return (
    <WorkOrderListClient
      initialItems={workOrders}
      technicians={technicians}
      userRole={user?.role}
    />
  );
}

