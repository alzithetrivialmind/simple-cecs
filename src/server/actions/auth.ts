"use server";

import { signIn, signOut } from "@/auth";
import { loginSchema, LoginInput } from "@/lib/validations/auth";
import { AuthError } from "next-auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth-guard";
import { getClientIp } from "@/lib/client-ip";
import {
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginRateLimit,
} from "@/lib/rate-limit";

export async function loginAction(data: LoginInput) {
  const validation = loginSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { nik, password } = validation.data;
  const ip = await getClientIp();

  // ── Rate limit check ──────────────────────────────────
  const rateLimit = await checkLoginRateLimit(nik, ip);
  if (!rateLimit.allowed) {
    await createAuditLog({
      userId: null,
      action: "LOGIN_BLOCKED",
      entity: "Auth",
      entityId: nik,
      details:
        rateLimit.reason === "ip_locked"
          ? `Login dari IP ${ip} diblokir sementara setelah terlalu banyak percobaan gagal.`
          : `Login untuk NIK ${nik} ditahan sementara (throttle) setelah beberapa percobaan gagal.`,
    });

    return {
      success: false,
      error:
        rateLimit.reason === "ip_locked"
          ? `Terlalu banyak percobaan gagal dari perangkat ini. Coba lagi dalam ${rateLimit.retryAfterSeconds} detik.`
          : `Mohon tunggu ${rateLimit.retryAfterSeconds} detik sebelum mencoba lagi.`,
    };
  }

  // ── Autentikasi ───────────────────────────────────────
  // `redirect: false` supaya signIn mengembalikan nilai alih-alih melempar
  // NEXT_REDIRECT. Dengan redirectTo, seluruh kode sesudahnya tidak pernah
  // tereksekusi — itulah sebabnya audit "LOGIN" dulu terpaksa ditulis
  // SEBELUM password diverifikasi (sehingga percobaan gagal ikut tercatat
  // sebagai login berhasil), dan clearLoginRateLimit tidak pernah berjalan.
  try {
    await signIn("credentials", {
      nik,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      await recordFailedLogin(nik, ip);

      await createAuditLog({
        userId: null,
        action: "FAILED_LOGIN",
        entity: "Auth",
        entityId: nik,
        details: `Percobaan login gagal untuk NIK ${nik} dari IP ${ip}.`,
      });

      switch (error.type) {
        case "CredentialsSignin":
          return { success: false, error: "NIK atau password salah." };
        case "CallbackRouteError":
          return {
            success: false,
            error:
              error.cause?.err?.message || "Gagal melakukan verifikasi akun",
          };
        default:
          return { success: false, error: "Terjadi kesalahan saat masuk" };
      }
    }
    // Error tak terduga (mis. NEXT_REDIRECT internal) harus diteruskan
    throw error;
  }

  // ── Sukses: barulah dicatat ───────────────────────────
  const user = await db.user.findFirst({
    where: { nik: { equals: nik, mode: "insensitive" }, deletedAt: null },
    select: { id: true, name: true, nik: true },
  });

  if (user) {
    await createAuditLog({
      userId: user.id,
      action: "LOGIN",
      entity: "Auth",
      entityId: user.nik,
      details: `Pengguna ${user.name} (${user.nik}) masuk ke sistem dari IP ${ip}`,
    });
  }

  await clearLoginRateLimit(nik, ip);

  // Navigasi dilakukan di client. redirect() di sini melempar NEXT_REDIRECT
  // yang ikut tertangkap try/catch di login form, sehingga toast
  // "Terjadi kesalahan pada sistem" muncul walaupun login berhasil.
  return { success: true as const };
}

export async function logoutAction() {
  try {
    const user = await getCurrentUser();
    if (user) {
      await createAuditLog({
        userId: user.id,
        action: "LOGOUT",
        entity: "Auth",
        entityId: user.nik,
        details: `Pengguna ${user.name} (${user.nik}) keluar dari sistem`,
      });
    }
  } catch (err) {
    console.error("Error logging logout:", err);
  }
  await signOut({ redirectTo: "/login" });
}
