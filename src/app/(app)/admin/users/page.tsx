import { getUsers } from "@/server/actions/user";
import { UserListClient } from "@/components/admin/user-list-client";
import { requireRolePage } from "@/lib/auth-guard";

export default async function AdminUsersPage() {
  await requireRolePage(["ADMIN"]);
  const { users, departments } = await getUsers({ limit: 100 });

  return <UserListClient initialUsers={users} departments={departments} />;
}
