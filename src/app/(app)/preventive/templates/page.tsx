import { getPmChecklistTemplates } from "@/server/actions/pm";
import { db } from "@/lib/db";
import { requireAuthPage } from "@/lib/auth-guard";
import { PmTemplateClient } from "@/components/preventive/pm-template-client";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function PmTemplatesPage() {
  await requireAuthPage();
  const [templates, pmTypes] = await Promise.all([
    getPmChecklistTemplates(),
    db.pmType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/preventive">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <PageHeader
            title="Template checklist PM"
          />
        </div>
      </div>

      <PmTemplateClient
        initialTemplates={templates}
        pmTypes={pmTypes}
      />
    </div>
  );
}
