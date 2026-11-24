import { db } from "@/lib/db";
import { requireRolePage } from "@/lib/auth-guard";
import { HourMeterForm } from "@/components/hour-meter/hour-meter-form";

export default async function NewHourMeterPage({
  searchParams,
}: {
  searchParams: Promise<{ equipmentId?: string }>;
}) {
  await requireRolePage(["ADMIN", "SUPERVISOR", "TECHNICIAN"]);
  const { equipmentId } = await searchParams;

  const equipmentList = await db.equipment.findMany({
    where: { deletedAt: null },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      currentHourMeter: true,
    },
  });

  return (
    <HourMeterForm
      equipmentList={equipmentList}
      preselectedEquipmentId={equipmentId}
    />
  );
}
