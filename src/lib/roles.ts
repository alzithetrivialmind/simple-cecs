/**
 * Kebijakan akses berbasis peran — satu sumber kebenaran.
 *
 * Aturan operasional CECS:
 *   TECHNICIAN & OPERATOR  → hanya bagian input (lapor, catat, kerjakan)
 *   SUPERVISOR & ADMIN     → manajemen, laporan, dan ekspor data
 *
 * Modul ini sengaja tidak mengimpor apa pun yang server-only, supaya bisa
 * dipakai bersama oleh server action, middleware, dan komponen navigasi.
 * `Role` diimpor sebagai tipe saja agar Prisma Client tidak ikut ter-bundle
 * ke sisi klien.
 */

import type { Role } from "@prisma/client";

/** Peran yang boleh membuka laporan, analitik, dan ekspor data. */
export const REPORT_ROLES = ["ADMIN", "SUPERVISOR"] as const satisfies readonly Role[];

/** Peran yang boleh mengelola data master dan pengguna. */
export const ADMIN_ROLES = ["ADMIN"] as const satisfies readonly Role[];

/**
 * Peran yang hanya boleh dipakai dari jaringan kantor (lihat @/lib/ip-allowlist).
 *
 * Sengaja didefinisikan terpisah dari REPORT_ROLES meskipun isinya kebetulan
 * sama: keduanya menjawab pertanyaan berbeda ("siapa boleh lihat laporan" vs
 * "siapa dibatasi lokasinya"), sehingga mengubah salah satu tidak boleh
 * diam-diam mengubah yang lain.
 */
export const IP_RESTRICTED_ROLES = [
  "ADMIN",
  "SUPERVISOR",
] as const satisfies readonly Role[];

/** Apakah peran ini tunduk pada pembatasan IP jaringan kantor. */
export function isIpRestrictedRole(role?: string | null): boolean {
  return !!role && (IP_RESTRICTED_ROLES as readonly string[]).includes(role);
}

/**
 * Apakah peran ini boleh melihat laporan/ekspor. Dipakai juga oleh navigasi.
 *
 * Menerima `string` agar bisa dipanggil dari komponen yang menerima peran
 * sebagai prop string biasa, tanpa harus meneruskan tipe Prisma ke klien.
 */
export function canAccessReports(role?: string | null): boolean {
  return !!role && (REPORT_ROLES as readonly string[]).includes(role);
}

/** Prefix path yang hanya boleh diakses oleh REPORT_ROLES. */
export const REPORT_PATHS = ["/report"] as const;

/** Apakah pathname termasuk area laporan yang dibatasi. */
export function isReportPath(pathname: string): boolean {
  return REPORT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
