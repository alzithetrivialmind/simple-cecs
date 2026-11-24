import { getAuditLogs, recordPageView } from "@/server/actions/audit-log";
import { AuditLogClient } from "@/components/admin/audit-log-client";
import { db } from "@/lib/db";
import { requireRolePage } from "@/lib/auth-guard";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    action?: string;
    entity?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  }>;
}

export const metadata = {
  title: "Audit Trail & Log Aktivitas | CECS",
};

export default async function AdminLogsPage({ searchParams }: PageProps) {
  await requireRolePage(["ADMIN"]);

  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;

  const [{ logs, total, totalPages }, users] = await Promise.all([
    getAuditLogs({
      search: params.search,
      action: params.action,
      entity: params.entity,
      userId: params.userId,
      startDate: params.startDate,
      endDate: params.endDate,
      page,
      limit: 25,
    }),
    db.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        nik: true,
        role: true,
      },
      orderBy: { name: "asc" },
    }),
    // Record that supervisor/admin opened the Audit Log page
    recordPageView("AuditLog", undefined, "Membuka halaman Audit Trail & Log Aktivitas"),
  ]);

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <AuditLogClient
        initialLogs={logs}
        total={total}
        currentPage={page}
        totalPages={totalPages}
        users={users}
      />
    </div>
  );
}
