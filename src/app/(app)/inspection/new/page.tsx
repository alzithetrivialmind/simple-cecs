import { db } from "@/lib/db";
import { requireRolePage } from "@/lib/auth-guard";
import { INPUT_ROLES } from "@/lib/roles";
import { InspectionForm } from "@/components/inspection/inspection-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface NewInspectionPageProps {
  searchParams: Promise<{
    equipmentId?: string;
  }>;
}

export default async function NewInspectionPage({
  searchParams,
}: NewInspectionPageProps) {
  const user = await requireRolePage(INPUT_ROLES);
  const sp = await searchParams;

  const [equipments, inspectionTypes, inspectors] = await Promise.all([
    db.equipment.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        currentHourMeter: true,
      },
      orderBy: { code: "asc" },
    }),
    db.inspectionType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        nik: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/inspection">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <PageHeader
          title="Inspeksi baru"
        />
      </div>

      <InspectionForm
        equipments={equipments}
        inspectionTypes={inspectionTypes}
        inspectors={inspectors}
        currentUserId={user.id}
        defaultEquipmentId={sp.equipmentId}
      />
    </div>
  );
}
