import { notFound } from "next/navigation";
import { getInspectionById } from "@/server/actions/inspection";
import { InspectionDetailClient } from "@/components/inspection/inspection-detail-client";
import { getCurrentUser, requireAuthPage } from "@/lib/auth-guard";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InspectionDetailPage({ params }: PageProps) {
  const { id } = await params;
  await requireAuthPage();
  const inspection = await getInspectionById(id);
  const user = await getCurrentUser();

  if (!inspection) {
    notFound();
  }

  return <InspectionDetailClient inspection={inspection} userRole={user?.role} />;
}
