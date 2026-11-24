/**
 * Pembatasan IP untuk akun berprivilese (ADMIN & SUPERVISOR).
 *
 * Operator dan teknisi tetap bisa masuk dari mana saja — itu inti dari alur
 * scan QR di lapangan. Akun yang bisa mengubah master data, mengelola
 * pengguna, dan membaca laporan dibatasi ke jaringan kantor.
 *
 * ── Jebakan yang dijaga di sini ──────────────────────────────────
 *
 * Kontrol ini hanya sekuat ketepatan IP klien yang terbaca. Bila reverse
 * proxy tidak meneruskan IP asli, SEMUA permintaan tampak berasal dari IP
 * container Docker (rentang 172.16.0.0/12) — yang secara teknis adalah IP
 * privat. Allowlist yang ditulis longgar sebagai "semua rentang privat" akan
 * meloloskan seluruh internet tanpa ada tanda apa pun bahwa kontrolnya sudah
 * tidak bekerja.
 *
 * Karena itu:
 *   1. Rentang bridge Docker TIDAK PERNAH dianggap lokal, kecuali kamu
 *      menuliskannya sendiri secara eksplisit di allowlist.
 *   2. Bila sebuah permintaan datang dari rentang itu, penolakannya diberi
 *      alasan khusus supaya salah konfigurasi proxy terlihat di log, bukan
 *      menyamar sebagai "sudah aman".
 *   3. Fitur ini mati bila ADMIN_IP_ALLOWLIST kosong. Tidak ada default
 *      diam-diam: kunci akun admin harus merupakan keputusan yang disengaja.
 */

/** Rentang bridge Docker. Privat, tapi bukan bukti bahwa klien ada di LAN. */
const DOCKER_BRIDGE_CIDR = "172.16.0.0/12";

export type IpCheckReason =
  | "disabled" // fitur tidak diaktifkan
  | "allowed" // cocok dengan allowlist
  | "not_allowed" // IP di luar allowlist
  | "proxy_misconfigured" // IP = alamat container, bukan klien sungguhan
  | "unknown_ip"; // IP tidak bisa ditentukan sama sekali

export interface IpCheckResult {
  allowed: boolean;
  reason: IpCheckReason;
}

/** Ubah IPv4 menjadi bilangan bulat 32-bit, atau null bila bukan IPv4 sah. */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

/**
 * Normalkan bentuk-bentuk penulisan yang setara.
 *
 * `::ffff:192.168.0.5` (IPv4-mapped IPv6) dan `[::1]` adalah bentuk yang
 * lazim muncul dari proxy dan runtime Node. Tanpa normalisasi, alamat LAN
 * yang sah bisa tertolak hanya karena beda penulisan.
 */
export function normalizeIp(raw: string): string {
  let ip = (raw || "").trim().toLowerCase();

  if (ip.startsWith("[") && ip.endsWith("]")) ip = ip.slice(1, -1);

  // Buang nomor port pada IPv4 (IPv6 memakai kurung siku, sudah ditangani)
  const colonCount = (ip.match(/:/g) || []).length;
  if (colonCount === 1 && ip.includes(".")) ip = ip.split(":")[0];

  // IPv4-mapped IPv6
  if (ip.startsWith("::ffff:")) {
    const tail = ip.slice(7);
    if (ipv4ToInt(tail) !== null) return tail;
  }

  // Bentuk panjang loopback IPv6
  if (ip === "0:0:0:0:0:0:0:1") return "::1";

  return ip;
}

/**
 * Apakah `ip` termasuk dalam satu entri allowlist.
 * Entri boleh berupa CIDR IPv4 (`192.168.0.0/24`) atau alamat tunggal.
 */
export function matchesEntry(ip: string, entry: string): boolean {
  const target = normalizeIp(ip);
  const rule = normalizeIp(entry);
  if (!target || !rule) return false;

  if (!rule.includes("/")) {
    return target === rule;
  }

  const [network, bitsRaw] = rule.split("/");
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;

  const netInt = ipv4ToInt(network);
  const ipInt = ipv4ToInt(target);
  if (netInt === null || ipInt === null) return false;

  if (bits === 0) return true;
  // >>> 0 menjaga hasilnya tetap unsigned; pergeseran bit di JS bertanda.
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (netInt & mask) >>> 0 === ((ipInt & mask) >>> 0);
}

/** Baca dan bersihkan daftar allowlist dari string env. */
export function parseAllowlist(raw: string | undefined | null): string[] {
  return (raw || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/**
 * Evaluasi satu IP terhadap allowlist. Fungsi murni — tidak membaca env.
 *
 * @param ip        IP klien hasil `getClientIp()`.
 * @param allowlist Daftar CIDR/alamat. Kosong berarti fitur nonaktif.
 */
export function checkIpAllowed(
  ip: string,
  allowlist: string[]
): IpCheckResult {
  if (allowlist.length === 0) {
    return { allowed: true, reason: "disabled" };
  }

  const target = normalizeIp(ip);

  if (!target || target === "unknown") {
    // Untuk akun berprivilese, IP yang tidak diketahui diperlakukan sebagai
    // tidak lokal. Gagal-tertutup adalah pilihan yang benar di sini.
    return { allowed: false, reason: "unknown_ip" };
  }

  const matched = allowlist.some((entry) => matchesEntry(target, entry));
  if (matched) {
    return { allowed: true, reason: "allowed" };
  }

  // Alamat container: hampir selalu berarti proxy tidak meneruskan IP asli.
  // Dibedakan supaya salah konfigurasi terlihat jelas di log.
  const dockerListedExplicitly = allowlist.some(
    (e) => normalizeIp(e) === DOCKER_BRIDGE_CIDR
  );
  if (!dockerListedExplicitly && matchesEntry(target, DOCKER_BRIDGE_CIDR)) {
    return { allowed: false, reason: "proxy_misconfigured" };
  }

  return { allowed: false, reason: "not_allowed" };
}

/** Allowlist aktif, dibaca dari environment. */
export function getAdminIpAllowlist(): string[] {
  return parseAllowlist(process.env.ADMIN_IP_ALLOWLIST);
}

/** Apakah pembatasan IP sedang aktif. */
export function isIpRestrictionEnabled(): boolean {
  return getAdminIpAllowlist().length > 0;
}

/** Evaluasi IP terhadap allowlist yang sedang aktif. */
export function checkAdminIp(ip: string): IpCheckResult {
  return checkIpAllowed(ip, getAdminIpAllowlist());
}

/** Pesan yang ditampilkan ke pengguna; sengaja tidak menyebut daftar IP. */
export function ipDenialMessage(reason: IpCheckReason): string {
  switch (reason) {
    case "proxy_misconfigured":
      return "Akun ini hanya dapat digunakan dari jaringan kantor. Bila Anda sedang berada di kantor, hubungi Administrator — konfigurasi jaringan perlu diperiksa.";
    default:
      return "Akun Administrator dan Supervisor hanya dapat digunakan dari jaringan kantor.";
  }
}
