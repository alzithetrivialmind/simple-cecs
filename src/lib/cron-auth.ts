import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Bandingkan dua string rahasia dalam waktu konstan.
 *
 * `!==` biasa berhenti pada byte pertama yang berbeda, sehingga lama
 * perbandingan membocorkan berapa banyak karakter awal yang sudah benar.
 * Panjang string di-hash lebih dulu agar `timingSafeEqual` selalu menerima
 * dua buffer berukuran sama — fungsi itu melempar bila panjangnya berbeda,
 * dan perbedaan panjang itu sendiri sudah membocorkan informasi.
 */
export function safeCompare(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest();
  const hb = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Verifikasi header `x-cron-token` pada route cron.
 *
 * Mengembalikan `null` bila permintaan sah, atau NextResponse berisi error
 * bila tidak — sehingga handler cukup menulis:
 *
 *   const denied = verifyCronRequest(req);
 *   if (denied) return denied;
 */
export function verifyCronRequest(req: NextRequest): NextResponse | null {
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const token = req.headers.get("x-cron-token");
  if (!token || !safeCompare(token, expectedToken)) {
    return NextResponse.json(
      { error: "Unauthorized cron token" },
      { status: 401 }
    );
  }

  return null;
}
