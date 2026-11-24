import { db } from "@/lib/db";
import { WorkOrderForm } from "@/components/work-order/work-order-form";

export const metadata = {
  title: "Buat Work Order Baru — CECS",
};

interface NewWorkOrderPageProps {
  searchParams: Promise<{ equipmentId?: string }>;
}

export default async function NewWorkOrderPage({
  searchParams,
}: NewWorkOrderPageProps) {
  const { equipmentId } = await searchParams;

  const [equipments, technicians] = await Promise.all([
    db.equipment.findMany({
      where: { deletedAt: null },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
      },
    }),
    db.user.findMany({
      where: {
        deletedAt: null,
        role: { in: ["TECHNICIAN", "SUPERVISOR", "ADMIN"] },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        nik: true,
      },
    }),
  ]);

  return (
    <div className="py-2">
      <WorkOrderForm
        equipments={equipments}
        technicians={technicians}
        defaultEquipmentId={equipmentId}
      />
    </div>
  );
}
