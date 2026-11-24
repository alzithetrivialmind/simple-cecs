import { getCurrentUser, requireAuthPage } from "@/lib/auth-guard";
import { getPmSchedule } from "@/server/actions/pm";
import { PmScheduleClient } from "@/components/preventive/pm-schedule-client";

export const metadata = {
  title: "Jadwal Preventive Maintenance — CECS",
};

export default async function PreventivePage() {
  await requireAuthPage();
  const [user, pmSchedule] = await Promise.all([
    getCurrentUser(),
    getPmSchedule(),
  ]);

  return (
    <PmScheduleClient
      initialItems={pmSchedule}
      userRole={user?.role}
    />
  );
}

