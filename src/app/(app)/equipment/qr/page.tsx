import { db } from "@/lib/db";
import { EquipmentQrClient } from "@/components/equipment/equipment-qr-client";
import { getServerNetworkUrl } from "@/lib/network";

export default async function EquipmentQrPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const defaultBaseUrl = getServerNetworkUrl();

  const equipmentList = await db.equipment.findMany({
    where: { deletedAt: null },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      model: true,
      serialNumber: true,
    },
  });

  return (
    <EquipmentQrClient
      initialEquipment={equipmentList}
      selectedId={id}
      defaultBaseUrl={defaultBaseUrl}
    />
  );
}
