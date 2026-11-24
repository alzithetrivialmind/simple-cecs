import { requireAuthPage } from "@/lib/auth-guard";
import { getDashboardData } from "@/server/actions/dashboard";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Page-safe: redirect ke /login jika sesi tidak ada,
  // alih-alih throw "Application error"
  const user = await requireAuthPage();

  const data = await getDashboardData();
  return <DashboardClient data={data} userRole={user.role} />;
}

