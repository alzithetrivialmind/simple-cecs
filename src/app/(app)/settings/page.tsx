import { requireAuthPage } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { UserProfileClient } from "@/components/settings/user-profile-client";
import { recordPageView } from "@/server/actions/audit-log";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Pengaturan Akun & Profil | CECS",
};

export default async function SettingsPage() {
  const authUser = await requireAuthPage();

  const user = await db.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      name: true,
      nik: true,
      email: true,
      role: true,
      avatarUrl: true,
      createdAt: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  // Audit page view
  await recordPageView("Settings", user.id, "Membuka halaman Pengaturan Akun & Profil");

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <UserProfileClient user={user} />
    </div>
  );
}
