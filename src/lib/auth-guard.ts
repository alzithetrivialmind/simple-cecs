import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { isIpRestrictedRole } from "@/lib/roles";
import { checkAdminIp, ipDenialMessage } from "@/lib/ip-allowlist";
import { getClientIp } from "@/lib/client-ip";

export interface AuthenticatedUser {
  id: string;
  name: string;
  nik: string;
  role: Role;
  departmentId?: string | null;
}

/**
 * Get current user from session or null if not authenticated
 *
 * Sengaja TIDAK memeriksa pembatasan IP: fungsi ini dipakai juga oleh layout
 * untuk sekadar menampilkan nama dan avatar, dan melempar dari sana hanya
 * akan merusak render. Penegakan ada di requireAuth/requireRole, yang menjaga
 * setiap aksi dan data.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.role) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name ?? "",
    nik: session.user.nik ?? "",
    role: session.user.role,
    departmentId: session.user.departmentId,
  };
}

/**
 * Tegakkan pembatasan IP jaringan kantor untuk peran berprivilese.
 *
 * Dipanggil pada setiap aksi terjaga, bukan hanya saat login, supaya sesi
 * ADMIN/SUPERVISOR yang sudah terbit pun tidak bisa dipakai dari luar
 * jaringan — termasuk bila cookie sesinya dicuri.
 *
 * Pemeriksaan ini sengaja berada di kode Node runtime, bukan di middleware:
 * middleware berjalan di edge runtime, tempat pembacaan variabel lingkungan
 * saat runtime tidak dijamin. Menegakkannya di sini membuat kontrolnya tidak
 * bergantung pada perilaku itu.
 */
async function assertIpAllowed(user: AuthenticatedUser): Promise<void> {
  if (!isIpRestrictedRole(user.role)) return;

  const ip = await getClientIp();
  const verdict = checkAdminIp(ip);
  if (verdict.allowed) return;

  console.warn(
    `Akses ${user.role} ditolak dari IP ${ip} (alasan: ${verdict.reason}) untuk NIK ${user.nik}`
  );
  throw new Error(`FORBIDDEN: ${ipDenialMessage(verdict.reason)}`);
}

/**
 * Assert that a user is authenticated, throws an error if not.
 *
 * Gunakan di **server action** dan **route handler** — tempat throw
 * tertangkap oleh error-handling framework dan dikembalikan ke client
 * sebagai pesan error, bukan halaman "Application error".
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED: Anda harus login untuk melakukan aksi ini.");
  }

  await assertIpAllowed(user);

  return user;
}

/**
 * Assert that the user is authenticated and has one of the allowed roles.
 * Throws on failure — gunakan di server action dan route handler.
 */
export async function requireRole(
  allowedRoles: readonly Role[]
): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  if (!allowedRoles.includes(user.role)) {
    throw new Error(
      `FORBIDDEN: Peran ${user.role} tidak memiliki izin untuk melakukan aksi ini.`
    );
  }

  return user;
}

// ─────────────────────────────────────────────────────────────────────────
// Page-safe variants: redirect ke /login alih-alih throw.
//
// Gunakan di React Server Component (page.tsx) agar request tanpa sesi
// yang lolos dari middleware (bot, crawler, reverse proxy yang tidak
// meneruskan cookies) dialihkan ke halaman login, bukan menampilkan
// "Application error" generik Next.js.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Page-safe: pastikan user terautentikasi, redirect ke /login jika tidak.
 */
export async function requireAuthPage(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?clearsession=1");
  }

  // IP restriction tetap throw — FORBIDDEN menandakan user login tapi
  // dari jaringan yang salah; ini kondisi luar biasa yang layak jadi error.
  await assertIpAllowed(user);

  return user;
}

/**
 * Page-safe: pastikan user terautentikasi dan punya salah satu role yang
 * diizinkan. Redirect ke /login jika belum login, redirect ke /dashboard
 * jika role tidak sesuai.
 */
export async function requireRolePage(
  allowedRoles: readonly Role[]
): Promise<AuthenticatedUser> {
  const user = await requireAuthPage();

  if (!allowedRoles.includes(user.role)) {
    redirect("/dashboard");
  }

  return user;
}

