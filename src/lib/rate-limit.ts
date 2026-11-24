/**
 * Rate limiting login, disimpan di database.
 *
 * Menggantikan penghitung in-memory sebelumnya yang punya dua kelemahan:
 * hilang setiap container restart (penyerang tinggal memicu restart), dan
 * hanya berkunci pada NIK — sehingga siapa pun bisa mengunci akun orang lain
 * selama 15 menit hanya dengan mengirim 5 password salah.
 *
 * Dua cakupan dengan perlakuan berbeda:
 *
 *   scope "ip"  — KUNCI KERAS. Membatasi penebak dari satu sumber. Aman
 *                 dikunci keras karena yang dirugikan adalah penyerang itu
 *                 sendiri, bukan korban.
 *
 *   scope "nik" — THROTTLE BERTAHAP, tanpa penguncian. Jeda wajib antar
 *                 percobaan tumbuh 2→4→8→16→30 detik dan berhenti di 30
 *                 detik. Ini tetap meredam tebakan terdistribusi dari banyak
 *                 IP (maksimal ~2 percobaan/menit per NIK secara global),
 *                 tapi pengguna sah paling lama menunggu 30 detik — jadi
 *                 tidak bisa dipakai untuk mengunci akun orang.
 */

import { db } from "@/lib/db";

// ── Kebijakan per-IP ────────────────────────────────────────────
/** Kegagalan dari satu IP sebelum dikunci. */
export const IP_MAX_ATTEMPTS = 10;
/** Panjang jendela penghitungan (ms). */
export const IP_WINDOW_MS = 15 * 60 * 1000;
/** Lama penguncian IP (ms). */
export const IP_LOCKOUT_MS = 15 * 60 * 1000;

// ── Kebijakan per-NIK ───────────────────────────────────────────
/** Kegagalan sebelum throttle mulai berlaku. */
export const NIK_THROTTLE_AFTER = 5;
/** Batas atas jeda wajib (detik). Sengaja kecil: ini bukan penguncian. */
export const NIK_MAX_DELAY_S = 30;
/** Panjang jendela penghitungan NIK (ms). */
export const NIK_WINDOW_MS = 15 * 60 * 1000;

export type AttemptScope = "ip" | "nik";

/** Bentuk minimal satu baris LoginAttempt yang dibutuhkan logika di bawah. */
export interface AttemptRecord {
  count: number;
  firstAttemptAt: Date;
  lastAttemptAt: Date;
  lockedUntil: Date | null;
}

export interface RateLimitResult {
  /** Apakah percobaan boleh diteruskan. */
  allowed: boolean;
  /** Detik sampai boleh mencoba lagi (hanya berarti saat allowed=false). */
  retryAfterSeconds: number | null;
  /** Alasan penolakan, untuk audit log. */
  reason?: "ip_locked" | "nik_throttled";
}

const ALLOW: RateLimitResult = { allowed: true, retryAfterSeconds: null };

/** Jeda wajib (detik) untuk NIK pada jumlah kegagalan tertentu. */
export function nikDelaySeconds(count: number): number {
  if (count < NIK_THROTTLE_AFTER) return 0;
  const steps = count - NIK_THROTTLE_AFTER + 1; // 5→1, 6→2, 7→3, ...
  return Math.min(2 ** steps, NIK_MAX_DELAY_S);
}

/**
 * Keputusan untuk cakupan IP. Fungsi murni — tidak menyentuh DB.
 */
export function evaluateIpLimit(
  entry: AttemptRecord | null,
  now: number
): RateLimitResult {
  if (!entry) return ALLOW;

  if (entry.lockedUntil) {
    const until = entry.lockedUntil.getTime();
    if (now < until) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((until - now) / 1000),
        reason: "ip_locked",
      };
    }
    // Penguncian sudah lewat
    return ALLOW;
  }

  // Jendela sudah lewat → penghitung dianggap direset
  if (now - entry.firstAttemptAt.getTime() > IP_WINDOW_MS) return ALLOW;

  if (entry.count >= IP_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(IP_LOCKOUT_MS / 1000),
      reason: "ip_locked",
    };
  }

  return ALLOW;
}

/**
 * Keputusan untuk cakupan NIK. Fungsi murni — tidak menyentuh DB.
 * Tidak pernah mengunci; hanya mewajibkan jeda antar percobaan.
 */
export function evaluateNikThrottle(
  entry: AttemptRecord | null,
  now: number
): RateLimitResult {
  if (!entry) return ALLOW;

  // Jendela sudah lewat → mulai dari nol
  if (now - entry.firstAttemptAt.getTime() > NIK_WINDOW_MS) return ALLOW;

  const delay = nikDelaySeconds(entry.count);
  if (delay === 0) return ALLOW;

  const elapsedMs = now - entry.lastAttemptAt.getTime();
  const remainingMs = delay * 1000 - elapsedMs;
  if (remainingMs > 0) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(remainingMs / 1000),
      reason: "nik_throttled",
    };
  }

  return ALLOW;
}

/**
 * Hitung keadaan baru setelah satu kegagalan. Fungsi murni.
 * Mengembalikan nilai yang akan ditulis ke baris LoginAttempt.
 */
export function nextFailureState(
  entry: AttemptRecord | null,
  now: number,
  scope: AttemptScope
): AttemptRecord {
  const nowDate = new Date(now);
  const windowMs = scope === "ip" ? IP_WINDOW_MS : NIK_WINDOW_MS;

  const windowExpired =
    !entry || now - entry.firstAttemptAt.getTime() > windowMs;
  const lockExpired =
    entry?.lockedUntil != null && now >= entry.lockedUntil.getTime();

  if (windowExpired || lockExpired) {
    return {
      count: 1,
      firstAttemptAt: nowDate,
      lastAttemptAt: nowDate,
      lockedUntil: null,
    };
  }

  const count = entry!.count + 1;
  // Hanya cakupan IP yang boleh mengunci keras.
  const lockedUntil =
    scope === "ip" && count >= IP_MAX_ATTEMPTS
      ? new Date(now + IP_LOCKOUT_MS)
      : null;

  return {
    count,
    firstAttemptAt: entry!.firstAttemptAt,
    lastAttemptAt: nowDate,
    lockedUntil,
  };
}

/** Normalisasi kunci agar konsisten antara pengecekan dan pencatatan. */
function normalizeKey(scope: AttemptScope, value: string): string {
  return scope === "nik" ? value.trim().toUpperCase() : value.trim();
}

async function readEntry(
  scope: AttemptScope,
  key: string
): Promise<AttemptRecord | null> {
  const row = await db.loginAttempt.findUnique({
    where: { scope_key: { scope, key } },
    select: {
      count: true,
      firstAttemptAt: true,
      lastAttemptAt: true,
      lockedUntil: true,
    },
  });
  return row;
}

/**
 * Periksa apakah percobaan login boleh diteruskan.
 * Panggil SEBELUM memverifikasi kredensial.
 *
 * Catatan kegagalan DB: dibiarkan lolos (fail-open). Ini tidak memberi
 * keuntungan apa pun kepada penyerang, karena verifikasi kredensial sendiri
 * juga memerlukan database — kalau DB mati, tidak ada yang bisa login.
 */
export async function checkLoginRateLimit(
  nik: string,
  ip: string
): Promise<RateLimitResult> {
  const now = Date.now();

  try {
    const [ipEntry, nikEntry] = await Promise.all([
      readEntry("ip", normalizeKey("ip", ip)),
      readEntry("nik", normalizeKey("nik", nik)),
    ]);

    // IP diperiksa lebih dulu: penguncian keras lebih tegas daripada throttle.
    const ipResult = evaluateIpLimit(ipEntry, now);
    if (!ipResult.allowed) return ipResult;

    return evaluateNikThrottle(nikEntry, now);
  } catch (err) {
    console.error("Rate limit check failed, allowing attempt:", err);
    return ALLOW;
  }
}

async function upsertFailure(scope: AttemptScope, rawKey: string, now: number) {
  const key = normalizeKey(scope, rawKey);
  const existing = await readEntry(scope, key);
  const next = nextFailureState(existing, now, scope);

  await db.loginAttempt.upsert({
    where: { scope_key: { scope, key } },
    create: { scope, key, ...next },
    update: next,
  });
}

/**
 * Catat satu percobaan login yang gagal.
 * Panggil SESUDAH autentikasi gagal.
 */
export async function recordFailedLogin(nik: string, ip: string): Promise<void> {
  const now = Date.now();
  try {
    await Promise.all([
      upsertFailure("ip", ip, now),
      upsertFailure("nik", nik, now),
    ]);
    await maybeCleanup(now);
  } catch (err) {
    console.error("Failed to record login attempt:", err);
  }
}

/** Bersihkan state setelah login berhasil. */
export async function clearLoginRateLimit(
  nik: string,
  ip: string
): Promise<void> {
  try {
    await db.loginAttempt.deleteMany({
      where: {
        OR: [
          { scope: "ip", key: normalizeKey("ip", ip) },
          { scope: "nik", key: normalizeKey("nik", nik) },
        ],
      },
    });
  } catch (err) {
    console.error("Failed to clear login attempts:", err);
  }
}

/**
 * Hapus baris usang sesekali, agar tabel tidak tumbuh tanpa batas tanpa
 * perlu cron terpisah. Dijalankan pada sebagian kecil pemanggilan saja.
 */
async function maybeCleanup(now: number) {
  if (Math.random() > 0.02) return;
  const cutoff = new Date(now - Math.max(IP_WINDOW_MS, NIK_WINDOW_MS) * 2);
  try {
    await db.loginAttempt.deleteMany({
      where: {
        lastAttemptAt: { lt: cutoff },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date(now) } }],
      },
    });
  } catch {
    // Pembersihan bersifat oportunistik; kegagalan tidak perlu dilaporkan.
  }
}
