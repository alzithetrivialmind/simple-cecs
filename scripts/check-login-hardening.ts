/**
 * Uji pengerasan alur login:
 *   - rate limit dua cakupan (IP dikunci keras, NIK hanya di-throttle)
 *   - penentuan IP klien yang tahan pemalsuan
 *   - perbandingan token cron waktu-konstan
 *   - kebijakan kata sandi
 */

import {
  evaluateIpLimit,
  evaluateNikThrottle,
  nextFailureState,
  nikDelaySeconds,
  IP_MAX_ATTEMPTS,
  IP_WINDOW_MS,
  NIK_MAX_DELAY_S,
  type AttemptRecord,
} from "../src/lib/rate-limit";
import { clientIpFromHeaders, UNKNOWN_IP } from "../src/lib/client-ip";
import { safeCompare } from "../src/lib/cron-auth";
import { passwordSchema } from "../src/lib/validations/password";
import { loginSchema } from "../src/lib/validations/auth";

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass++;
  else { fail++; console.log(`  FAIL ${name}\n       expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
}

const T = 1_700_000_000_000; // ms
const rec = (o: Partial<AttemptRecord> = {}): AttemptRecord => ({
  count: 1,
  firstAttemptAt: new Date(T),
  lastAttemptAt: new Date(T),
  lockedUntil: null,
  ...o,
});

console.log("\n== IP: kunci keras ==");
check("tanpa riwayat -> boleh", evaluateIpLimit(null, T).allowed, true);
check("di bawah batas -> boleh", evaluateIpLimit(rec({ count: 9 }), T).allowed, true);
check(
  "mencapai batas -> ditolak",
  evaluateIpLimit(rec({ count: IP_MAX_ATTEMPTS }), T).allowed,
  false
);
check(
  "sedang terkunci -> ditolak",
  evaluateIpLimit(rec({ count: 10, lockedUntil: new Date(T + 60_000) }), T).allowed,
  false
);
check(
  "sisa waktu dilaporkan",
  evaluateIpLimit(rec({ count: 10, lockedUntil: new Date(T + 60_000) }), T).retryAfterSeconds,
  60
);
check(
  "kunci kedaluwarsa -> boleh lagi",
  evaluateIpLimit(rec({ count: 10, lockedUntil: new Date(T - 1) }), T).allowed,
  true
);
check(
  "jendela lewat -> penghitung direset",
  evaluateIpLimit(rec({ count: 99, firstAttemptAt: new Date(T - IP_WINDOW_MS - 1) }), T).allowed,
  true
);

console.log("== NIK: throttle, TIDAK PERNAH mengunci ==");
check("jeda sebelum ambang = 0", nikDelaySeconds(4), 0);
check("jeda di ambang = 2 detik", nikDelaySeconds(5), 2);
check("tumbuh 2^n", [6, 7, 8].map(nikDelaySeconds), [4, 8, 16]);
check("dibatasi maksimum", nikDelaySeconds(50), NIK_MAX_DELAY_S);
{
  // Properti inti — inilah yang mencegah penguncian akun oleh pihak lain.
  const worst = Math.max(...Array.from({ length: 500 }, (_, i) => nikDelaySeconds(i)));
  check("penundaan terburuk <= 30 detik", worst <= NIK_MAX_DELAY_S, true);

  // Berapa pun banyaknya kegagalan, NIK tidak pernah dikunci keras.
  const many = nextFailureState(rec({ count: 999 }), T, "nik");
  check("state NIK tidak pernah punya lockedUntil", many.lockedUntil, null);

  // Setelah jeda terlewati, pengguna sah langsung bisa mencoba lagi.
  const throttled = rec({ count: 9, lastAttemptAt: new Date(T - 31_000) });
  check("jeda lewat -> boleh mencoba", evaluateNikThrottle(throttled, T).allowed, true);

  const tooSoon = rec({ count: 9, lastAttemptAt: new Date(T - 1_000) });
  check("terlalu cepat -> ditahan", evaluateNikThrottle(tooSoon, T).allowed, false);
  check("alasan ditandai", evaluateNikThrottle(tooSoon, T).reason, "nik_throttled");
}

console.log("== IP tetap boleh dikunci keras ==");
{
  const st = nextFailureState(rec({ count: IP_MAX_ATTEMPTS - 1 }), T, "ip");
  check("IP dikunci saat batas tercapai", st.lockedUntil !== null, true);
  check("penghitung IP naik", st.count, IP_MAX_ATTEMPTS);
}

console.log("== nextFailureState: reset jendela ==");
{
  const stale = rec({ count: 7, firstAttemptAt: new Date(T - IP_WINDOW_MS - 1) });
  check("jendela lewat -> mulai dari 1", nextFailureState(stale, T, "ip").count, 1);
  check("tanpa riwayat -> mulai dari 1", nextFailureState(null, T, "ip").count, 1);
}

console.log("== IP klien tahan pemalsuan ==");
{
  const h = (m: Record<string, string>) => (n: string) => m[n] ?? null;

  check(
    "X-Real-IP diutamakan",
    clientIpFromHeaders(h({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "1.2.3.4" })),
    "203.0.113.9"
  );
  // Nginx menambahkan peer asli di paling KANAN; entri kiri dikarang klien.
  check(
    "XFF: ambil paling kanan, bukan kiri",
    clientIpFromHeaders(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" })),
    "203.0.113.9"
  );
  check(
    "XFF spoof berlapis tetap aman",
    clientIpFromHeaders(h({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.9" })),
    "203.0.113.9"
  );
  check("XFF tunggal", clientIpFromHeaders(h({ "x-forwarded-for": "203.0.113.9" })), "203.0.113.9");
  check("tanpa header", clientIpFromHeaders(h({})), UNKNOWN_IP);
  check("XFF kosong", clientIpFromHeaders(h({ "x-forwarded-for": "" })), UNKNOWN_IP);
  check("spasi dirapikan", clientIpFromHeaders(h({ "x-real-ip": "  10.0.0.1  " })), "10.0.0.1");
}

console.log("== token cron waktu-konstan ==");
check("token sama -> cocok", safeCompare("rahasia-panjang", "rahasia-panjang"), true);
check("token beda -> tidak", safeCompare("rahasia-panjang", "rahasia-panjanX"), false);
check("panjang beda tidak melempar", safeCompare("pendek", "jauh-lebih-panjang-sekali"), false);
check("kosong vs isi", safeCompare("", "x"), false);
check("kosong vs kosong", safeCompare("", ""), true);

console.log("== kebijakan kata sandi ==");
{
  const ok = (v: string) => passwordSchema.safeParse(v).success;
  check("kuat diterima", ok("Sample2024"), true);
  check("terlalu pendek ditolak", ok("Sam1"), false);
  check("6 karakter ditolak (aturan lama)", ok("Samp1x"), false);
  check("tanpa huruf besar ditolak", ok("sample2024"), false);
  check("tanpa angka ditolak", ok("SamplePassword"), false);
  check("terlalu panjang ditolak", ok("A1" + "x".repeat(200)), false);
}

console.log("== login TIDAK menegakkan kekuatan kata sandi ==");
{
  // Ini yang dulu mengunci pengguna berpassword lama: akun dibuat dengan
  // aturan 6 karakter, lalu gerbang login menolaknya sebelum bcrypt dipanggil.
  const r = loginSchema.safeParse({ nik: "tech001", password: "samp1x" });
  check("password lemah tetap boleh dicoba", r.success, true);
  check("NIK dinormalisasi huruf besar", r.success && r.data.nik, "TECH001");
  check("password kosong ditolak", loginSchema.safeParse({ nik: "A", password: "" }).success, false);
  check("NIK kosong ditolak", loginSchema.safeParse({ nik: "", password: "x" }).success, false);
}

console.log(`\n${fail === 0 ? "OK" : "GAGAL"} — lulus: ${pass}, gagal: ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
