import { db } from "@/lib/db";
import { requireRolePage } from "@/lib/auth-guard";
import { EquipmentForm } from "@/components/equipment/equipment-form";

export default async function NewEquipmentPage() {
  await requireRolePage(["ADMIN", "SUPERVISOR"]);

  const [departments, locations] = await Promise.all([
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.location.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <EquipmentForm
      departments={departments}
      locations={locations}
      isEdit={false}
    />
  );
}
