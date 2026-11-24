import { requireRolePage } from "@/lib/auth-guard";
import { EquipmentImportClient } from "@/components/equipment/equipment-import-client";

export default async function EquipmentImportPage() {
  await requireRolePage(["ADMIN", "SUPERVISOR"]);

  return <EquipmentImportClient />;
}
