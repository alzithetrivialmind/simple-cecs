import { notFound } from "next/navigation";
import { requireAuthPage } from "@/lib/auth-guard";
import { getPartById } from "@/server/actions/part";
import { PartDetailClient } from "@/components/spare-part/part-detail-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detail Suku Cadang — CECS",
};

interface PartDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PartDetailPage({ params }: PartDetailPageProps) {
  const { id } = await params;
  await requireAuthPage();

  const part = await getPartById(id);
  if (!part) {
    notFound();
  }

  return <PartDetailClient part={part} />;
}
