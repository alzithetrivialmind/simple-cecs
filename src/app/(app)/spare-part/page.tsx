import { getParts } from "@/server/actions/part";
import { getCurrentUser, requireAuthPage } from "@/lib/auth-guard";
import { PartListClient } from "@/components/spare-part/part-list-client";
import { PageHeader } from "@/components/shared/page-header";
import { PartSystem } from "@prisma/client";

export const dynamic = "force-dynamic";

interface SparePartPageProps {
  searchParams: Promise<{
    search?: string;
    system?: string;
  }>;
}

export default async function SparePartPage({
  searchParams,
}: SparePartPageProps) {
  const sp = await searchParams;
  await requireAuthPage();
  const user = await getCurrentUser();

  const validSystem = Object.values(PartSystem).includes(sp.system as PartSystem)
    ? (sp.system as PartSystem)
    : undefined;

  const { items, total } = await getParts({
    search: sp.search,
    system: validSystem,
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spare part"
      />

      <PartListClient
        initialParts={items}
        totalParts={total}
        userRole={user?.role}
      />
    </div>
  );
}
