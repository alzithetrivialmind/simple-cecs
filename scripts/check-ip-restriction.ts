/**
 * Uji pembatasan IP untuk akun berprivilese.
 *
 * Yang dibuktikan di sini bukan sekadar "IP kantor lolos", melainkan
 * jebakan-jebakan yang membuat kontrol semacam ini diam-diam tidak bekerja.
 */

import {
  checkIpAllowed,
  matchesEntry,
  normalizeIp,
  parseAllowlist,
  ipDenialMessage,
} from "../src/lib/ip-allowlist";
import { isIpRestrictedRole, IP_RESTRICTED_ROLES } from "../src/lib/roles";

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass++;
  else { fail++; console.log(`  FAIL ${name}\n       expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
}

const LAN = ["192.168.0.0/24", "127.0.0.1", "::1"];

console.log("\n== peran mana yang dibatasi ==");
check("ADMIN dibatasi", isIpRestrictedRole("ADMIN"), true);
check("SUPERVISOR dibatasi", isIpRestrictedRole("SUPERVISOR"), true);
check("TECHNICIAN BEBAS", isIpRestrictedRole("TECHNICIAN"), false);
check("OPERATOR BEBAS", isIpRestrictedRole("OPERATOR"), false);
check("VIEWER bebas", isIpRestrictedRole("VIEWER"), false);
check("kosong bebas", isIpRestrictedRole(undefined), false);
check("isi konstanta", [...IP_RESTRICTED_ROLES].sort(), ["ADMIN", "SUPERVISOR"]);

console.log("== IP kantor lolos ==");
for (const ip of ["192.168.0.1", "192.168.0.50", "192.168.0.254", "127.0.0.1", "::1"]) {
  check(`${ip} diizinkan`, checkIpAllowed(ip, LAN).allowed, true);
}

console.log("== IP luar ditolak ==");
for (const ip of ["203.0.113.5", "8.8.8.8", "192.168.1.5", "192.169.0.1", "10.0.0.1"]) {
  check(`${ip} ditolak`, checkIpAllowed(ip, LAN).allowed, false);
}
check("alasan ditandai", checkIpAllowed("8.8.8.8", LAN).reason, "not_allowed");

console.log("== JEBAKAN: IP container tidak boleh dianggap lokal ==");
{
  // Kalau reverse proxy tidak meneruskan IP asli, semua permintaan tiba
  // dari alamat bridge Docker. Itu IP privat — allowlist yang ditulis
  // longgar akan meloloskan seluruh internet tanpa tanda apa pun.
  const r = checkIpAllowed("172.18.0.5", LAN);
  check("IP bridge Docker DITOLAK", r.allowed, false);
  check("dilaporkan sebagai salah konfigurasi", r.reason, "proxy_misconfigured");
  check(
    "pesannya mengarahkan ke admin",
    ipDenialMessage(r.reason).includes("Administrator"),
    true
  );

  // Rentang privat lain juga tidak otomatis lolos.
  check("10.x ditolak bila tidak terdaftar", checkIpAllowed("10.1.2.3", LAN).allowed, false);
  check("172.16.x ditolak", checkIpAllowed("172.16.0.1", LAN).allowed, false);
  check("172.31.x ditolak", checkIpAllowed("172.31.255.254", LAN).allowed, false);

  // Tapi bila memang sengaja didaftarkan, ia diperlakukan biasa.
  const explicit = [...LAN, "172.16.0.0/12"];
  check("bridge lolos bila eksplisit", checkIpAllowed("172.18.0.5", explicit).allowed, true);
}

console.log("== JEBAKAN: IP tidak diketahui harus gagal-TERTUTUP ==");
check("'unknown' ditolak", checkIpAllowed("unknown", LAN).allowed, false);
check("alasan unknown_ip", checkIpAllowed("unknown", LAN).reason, "unknown_ip");
check("string kosong ditolak", checkIpAllowed("", LAN).allowed, false);

console.log("== fitur nonaktif bila allowlist kosong ==");
check("kosong -> semua lolos", checkIpAllowed("8.8.8.8", []).allowed, true);
check("ditandai disabled", checkIpAllowed("8.8.8.8", []).reason, "disabled");

console.log("== normalisasi bentuk penulisan ==");
check("IPv4-mapped IPv6", normalizeIp("::ffff:192.168.0.5"), "192.168.0.5");
check("kurung siku dibuang", normalizeIp("[::1]"), "::1");
check("loopback IPv6 panjang", normalizeIp("0:0:0:0:0:0:0:1"), "::1");
check("port IPv4 dibuang", normalizeIp("192.168.0.5:54321"), "192.168.0.5");
check("spasi & kapital", normalizeIp("  ::FFFF:192.168.0.5  "), "192.168.0.5");
{
  // Bentuk penulisan berbeda tidak boleh membuat IP kantor tertolak.
  check("mapped IPv6 tetap lolos", checkIpAllowed("::ffff:192.168.0.77", LAN).allowed, true);
}

console.log("== batas CIDR dihitung benar ==");
check("/24 batas bawah", matchesEntry("192.168.0.0", "192.168.0.0/24"), true);
check("/24 batas atas", matchesEntry("192.168.0.255", "192.168.0.0/24"), true);
check("/24 tepat di luar", matchesEntry("192.168.1.0", "192.168.0.0/24"), false);
check("/32 hanya satu alamat", matchesEntry("10.0.0.1", "10.0.0.1/32"), true);
check("/32 menolak tetangga", matchesEntry("10.0.0.2", "10.0.0.1/32"), false);
check("/16 lebih luas", matchesEntry("192.168.99.1", "192.168.0.0/16"), true);
check("/8", matchesEntry("10.255.255.255", "10.0.0.0/8"), true);
// /1 dan /0 memakai pergeseran bit ekstrem — pastikan tidak meluap.
check("/0 cocok semua", matchesEntry("8.8.8.8", "0.0.0.0/0"), true);
check("/1 separuh ruang", matchesEntry("10.0.0.1", "0.0.0.0/1"), true);
check("/1 menolak separuh lain", matchesEntry("200.0.0.1", "0.0.0.0/1"), false);

console.log("== entri allowlist tidak sah tidak boleh meloloskan ==");
check("prefix > 32 ditolak", matchesEntry("192.168.0.1", "192.168.0.0/33"), false);
check("prefix negatif ditolak", matchesEntry("192.168.0.1", "192.168.0.0/-1"), false);
check("prefix bukan angka", matchesEntry("192.168.0.1", "192.168.0.0/abc"), false);
check("oktet > 255", matchesEntry("192.168.0.1", "192.168.0.999/24"), false);
check("sampah", matchesEntry("192.168.0.1", "bukan-ip"), false);
check("oktet kurang", matchesEntry("192.168.0.1", "192.168.0/24"), false);

console.log("== parsing daftar dari env ==");
check("dipisah koma", parseAllowlist("192.168.0.0/24, 127.0.0.1"), ["192.168.0.0/24", "127.0.0.1"]);
check("entri kosong dibuang", parseAllowlist("192.168.0.0/24,,  ,127.0.0.1"), ["192.168.0.0/24", "127.0.0.1"]);
check("undefined -> kosong", parseAllowlist(undefined), []);
check("string kosong -> kosong", parseAllowlist("   "), []);

console.log(`\n${fail === 0 ? "OK" : "GAGAL"} — lulus: ${pass}, gagal: ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
