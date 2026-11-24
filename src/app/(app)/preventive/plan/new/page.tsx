import { db } from "@/lib/db";
import { PmPlanForm } from "@/components/preventive/pm-plan-form";

export const metadata = {
  title: "Atur Jadwal PM — CECS",
};

interface NewPmPlanPageProps {
  searchParams: Promise<{ equipmentId?: string }>;
}

export default async function NewPmPlanPage({
  searchParams,
}: NewPmPlanPageProps) {
  const { equipmentId } = await searchParams;

  const [equipments, pmTypes] = await Promise.all([
    db.equipment.findMany({
      where: { deletedAt: null },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        currentHourMeter: true,
      },
    }),
    db.pmType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="py-2">
      <PmPlanForm
        equipments={equipments}
        pmTypes={pmTypes}
        defaultEquipmentId={equipmentId}
      />
    </div>
  );
}
