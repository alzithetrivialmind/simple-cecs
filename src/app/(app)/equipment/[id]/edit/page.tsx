import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRolePage } from "@/lib/auth-guard";
import { EquipmentForm } from "@/components/equipment/equipment-form";

export default async function EditEquipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRolePage(["ADMIN", "SUPERVISOR"]);
  const { id } = await params;

  const [equipment, departments, locations] = await Promise.all([
    db.equipment.findFirst({
      where: { id, deletedAt: null },
    }),
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.location.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!equipment) {
    notFound();
  }

  return (
    <EquipmentForm
      initialData={equipment}
      departments={departments}
      locations={locations}
      isEdit={true}
    />
  );
}
