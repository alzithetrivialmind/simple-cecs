import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Login — CECS",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
