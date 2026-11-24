/**
 * Penentuan IP klien yang tahan pemalsuan.
 *
 * Nginx di depan aplikasi menyetel:
 *   proxy_set_header X-Real-IP       $remote_addr;
 *   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
 *
 * `proxy_set_header` menimpa nilai kiriman klien, sehingga **X-Real-IP selalu
 * tepercaya**. Sebaliknya `$proxy_add_x_forwarded_for` menghasilkan
 * "<nilai kiriman klien>, <peer asli>", jadi pada X-Forwarded-For hanya entri
 * **paling kanan** yang tepercaya — entri kiri sepenuhnya dikarang klien.
 *
 * Mengambil entri paling kiri (pola yang umum keliru) membuat penyerang bisa
 * menulis IP palsu ke audit log dan menghindari rate limit hanya dengan
 * mengirim header `X-Forwarded-For: 1.2.3.4`.
 */

import { headers } from "next/headers";

/** Nilai yang dipakai bila IP tidak bisa ditentukan. */
export const UNKNOWN_IP = "unknown";

/** Ambil IP tepercaya dari kumpulan header yang sudah dibaca. */
export function clientIpFromHeaders(get: (name: string) => string | null): string {
  // 1. X-Real-IP — ditimpa nginx, tidak bisa dipalsukan klien
  const realIp = get("x-real-ip")?.trim();
  if (realIp) return realIp;

  // 2. X-Forwarded-For — hanya entri paling kanan yang berasal dari nginx
  const xff = get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return UNKNOWN_IP;
}

/** Ambil IP klien tepercaya di dalam server action / route handler. */
export async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    return clientIpFromHeaders((name) => h.get(name));
  } catch {
    return UNKNOWN_IP;
  }
}
