import { getCurrentUser, requireAuthPage } from "@/lib/auth-guard";
import { getHourMeterLogs } from "@/server/actions/hour-meter";
import { HourMeterListClient } from "@/components/hour-meter/hour-meter-list-client";

export const metadata = {
  title: "Log Hour Meter — CECS",
};

export default async function HourMeterPage() {
  await requireAuthPage();
  const [user, data] = await Promise.all([
    getCurrentUser(),
    getHourMeterLogs({ limit: 100 }),
  ]);

  return (
    <HourMeterListClient
      initialLogs={data.logs}
      userRole={user?.role}
    />
  );
}

