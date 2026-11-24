import {
  getDowntimeReport,
  getPmComplianceReport,
  getPartUsageReport,
} from "@/server/actions/report";
import { ReportClient } from "@/components/report/report-client";
import { PageHeader } from "@/components/shared/page-header";
import { requireAuthPage } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  await requireAuthPage();
  const [downtimeData, pmData, partUsageData] = await Promise.all([
    getDowntimeReport(),
    getPmComplianceReport(),
    getPartUsageReport(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan"
      />

      <ReportClient
        downtimeData={downtimeData}
        pmData={pmData}
        partUsageData={partUsageData}
      />
    </div>
  );
}
