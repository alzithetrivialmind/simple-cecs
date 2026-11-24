import { notFound } from "next/navigation";
import { getPmPlanById } from "@/server/actions/pm";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { requireAuthPage } from "@/lib/auth-guard";
import { PmExecuteForm } from "@/components/preventive/pm-execute-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PmExecutePage({ params }: PageProps) {
  const { id } = await params;
  await requireAuthPage();
  const session = await auth();

  const [plan, technicians] = await Promise.all([
    getPmPlanById(id),
    db.user.findMany({
      where: {
        isActive: true,
        role: { in: ["TECHNICIAN", "SUPERVISOR", "ADMIN"] },
      },
      select: {
        id: true,
        name: true,
        nik: true,
        avatarUrl: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!plan) {
    notFound();
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/preventive">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <PageHeader
          title={`PM ${plan.equipment.code}`}
          meta={plan.pmType.name}
        />
      </div>

      <PmExecuteForm
        plan={plan}
        technicians={technicians}
        currentUserId={session?.user?.id}
      />
    </div>
  );
}
