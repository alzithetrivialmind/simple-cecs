import { db } from "@/lib/db";
import { requireRolePage } from "@/lib/auth-guard";
import { INPUT_ROLES } from "@/lib/roles";
import { BreakdownForm } from "@/components/breakdown/breakdown-form";

export const metadata = {
  title: "Lapor Kerusakan (Breakdown) — CECS",
};

interface NewBreakdownPageProps {
  searchParams: Promise<{ equipmentId?: string }>;
}

export default async function NewBreakdownPage({
  searchParams,
}: NewBreakdownPageProps) {
  await requireRolePage(INPUT_ROLES);
  const { equipmentId } = await searchParams;

  const equipments = await db.equipment.findMany({
    where: { deletedAt: null },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      currentHourMeter: true,
    },
  });

  return (
    <div className="py-2">
      <BreakdownForm
        equipments={equipments}
        defaultEquipmentId={equipmentId}
      />
    </div>
  );
}

