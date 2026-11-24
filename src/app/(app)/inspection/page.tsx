import { getInspections } from "@/server/actions/inspection";
import { db } from "@/lib/db";
import { InspectionListClient } from "@/components/inspection/inspection-list-client";
import { PageHeader } from "@/components/shared/page-header";
import { InspectionResult } from "@prisma/client";
import { requireAuthPage } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

interface InspectionPageProps {
  searchParams: Promise<{
    search?: string;
    result?: string;
    equipmentId?: string;
  }>;
}

export default async function InspectionPage({ searchParams }: InspectionPageProps) {
  const user = await requireAuthPage();
  const sp = await searchParams;
  const validResult = Object.values(InspectionResult).includes(sp.result as InspectionResult)
    ? (sp.result as InspectionResult)
    : undefined;

  const [inspections, inspectionTypes] = await Promise.all([
    getInspections({
      search: sp.search,
      result: validResult,
      equipmentId: sp.equipmentId,
    }),
    db.inspectionType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inspeksi & sertifikat"
      />

      <InspectionListClient
        inspections={inspections}
        inspectionTypes={inspectionTypes}
        userRole={user.role}
      />
    </div>
  );
}
