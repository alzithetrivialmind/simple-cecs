import { getEquipmentList } from "@/server/actions/equipment";
import { EquipmentListClient } from "@/components/equipment/equipment-list-client";
import { getCurrentUser, requireAuthPage } from "@/lib/auth-guard";

export default async function EquipmentPage() {
  await requireAuthPage();
  const user = await getCurrentUser();
  const { items, departments, locations } = await getEquipmentList({
    all: true,
  });

  return (
    <EquipmentListClient
      initialItems={items}
      departments={departments}
      locations={locations}
      userRole={user?.role}
    />
  );
}
