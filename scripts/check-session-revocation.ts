/**
 * Uji logika revalidasi token dari src/auth.ts.
 *
 * Logikanya direplikasi persis di sini (tanpa DB/NextAuth) supaya keputusan
 * "sesi masih sah / harus dicabut" bisa diuji sebagai fungsi murni.
 * Yang diuji adalah PROPERTI yang bikin bug lama lolos:
 *   - `iat` di-refresh tiap request → tidak boleh dipakai
 *   - `authAt` stabil → harus dipakai
 */

const REVALIDATION_INTERVAL_S = 60;

type DbUser = {
  isActive: boolean;
  deletedAt: Date | null;
  tokenInvalidBefore: Date | null;
};

type Token = {
  id: string;
  iat: number;
  authAt?: number;
  lastCheckedAt: number;
};

/** Salinan cabang keputusan di callback jwt. null = sesi dicabut. */
function revalidate(token: Token, dbUser: DbUser | null, now: number): Token | null {
  if (now - token.lastCheckedAt <= REVALIDATION_INTERVAL_S) {
    return token; // belum waktunya cek DB
  }
  if (!dbUser || !dbUser.isActive || dbUser.deletedAt) return null;

  if (dbUser.tokenInvalidBefore) {
    const invalidBefore = Math.floor(dbUser.tokenInvalidBefore.getTime() / 1000);
    const authAt = token.authAt;
    if (authAt === undefined || authAt < invalidBefore) return null;
  }
  return { ...token, lastCheckedAt: now };
}

/** Bug LAMA, untuk membuktikan skenario yang dulu lolos. */
function revalidateOld(token: Token, dbUser: DbUser | null, now: number): Token | null {
  if (now - token.lastCheckedAt <= REVALIDATION_INTERVAL_S) return token;
  if (!dbUser || !dbUser.isActive || dbUser.deletedAt) return null;
  if (dbUser.tokenInvalidBefore && token.iat) {
    const invalidBefore = Math.floor(dbUser.tokenInvalidBefore.getTime() / 1000);
    if (token.iat < invalidBefore) return null;
  }
  return { ...token, lastCheckedAt: now };
}

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass++;
  else { fail++; console.log(`  FAIL ${name}\n       expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
}

const T0 = 1_700_000_000;
const active: DbUser = { isActive: true, deletedAt: null, tokenInvalidBefore: null };

console.log("\n== deaktivasi & penghapusan ==");
{
  const tok: Token = { id: "u1", iat: T0, authAt: T0, lastCheckedAt: T0 };
  const later = T0 + 120;
  check("user dinonaktifkan -> dicabut", revalidate(tok, { ...active, isActive: false }, later), null);
  check("user dihapus (soft) -> dicabut", revalidate(tok, { ...active, deletedAt: new Date() }, later), null);
  check("user hilang dari DB -> dicabut", revalidate(tok, null, later), null);
  check("user aktif -> tetap sah", revalidate(tok, active, later)?.id, "u1");
}

console.log("== gerbang interval ==");
{
  const tok: Token = { id: "u1", iat: T0, authAt: T0, lastCheckedAt: T0 };
  // Dalam 60 detik pertama DB tidak dicek, jadi sesi masih jalan.
  check("dalam interval -> belum cek DB", revalidate(tok, { ...active, isActive: false }, T0 + 30)?.id, "u1");
  // Lewat interval, barulah dicabut. Ini batas atas jeda force-logout.
  check("lewat interval -> dicabut", revalidate(tok, { ...active, isActive: false }, T0 + 61), null);
}

console.log("== force-logout: SKENARIO YANG DULU BOCOR ==");
{
  // Admin menekan force-logout pada T0.
  const invalidBefore = new Date(T0 * 1000);
  const db: DbUser = { ...active, tokenInvalidBefore: invalidBefore };

  // Sesi dimulai jauh sebelum force-logout...
  const authAt = T0 - 3600;
  // ...tapi `iat` sudah di-refresh berkali-kali oleh Auth.js dan sekarang
  // bernilai SETELAH T0. Inilah yang bikin cek lama gagal.
  const tok: Token = { id: "u1", iat: T0 + 55, authAt, lastCheckedAt: T0 - 5 };
  const now = T0 + 60;

  check("LAMA: iat ter-refresh -> gagal mencabut (bug)", revalidateOld(tok, db, now)?.id, "u1");
  check("BARU: authAt stabil -> berhasil mencabut", revalidate(tok, db, now), null);
}

console.log("== force-logout: kasus lain ==");
{
  const invalidBefore = new Date(T0 * 1000);
  const db: DbUser = { ...active, tokenInvalidBefore: invalidBefore };

  // Login ULANG setelah force-logout harus tetap bisa masuk.
  const fresh: Token = { id: "u1", iat: T0 + 10, authAt: T0 + 10, lastCheckedAt: T0 - 100 };
  check("login ulang sesudahnya -> tetap sah", revalidate(fresh, db, T0 + 200)?.id, "u1");

  // Token lama dari sebelum rilis ini belum punya authAt -> default aman: cabut.
  const legacy: Token = { id: "u1", iat: T0 + 55, lastCheckedAt: T0 - 5 };
  check("token legacy tanpa authAt -> dicabut", revalidate(legacy, db, T0 + 60), null);

  // Tanpa force-logout, token legacy tidak boleh ikut tercabut.
  check("legacy tanpa tokenInvalidBefore -> tetap sah", revalidate(legacy, active, T0 + 60)?.id, "u1");

  // Tepat sama detiknya: authAt == invalidBefore dianggap sesudah -> sah.
  const edge: Token = { id: "u1", iat: T0, authAt: T0, lastCheckedAt: T0 - 100 };
  check("authAt == invalidBefore -> sah", revalidate(edge, db, T0 + 200)?.id, "u1");
}

console.log("== lastCheckedAt maju supaya tidak query tiap request ==");
{
  const tok: Token = { id: "u1", iat: T0, authAt: T0, lastCheckedAt: T0 };
  const out = revalidate(tok, active, T0 + 61);
  check("lastCheckedAt diperbarui", out?.lastCheckedAt, T0 + 61);
  check("cek berikutnya di-skip", revalidate(out!, { ...active, isActive: false }, T0 + 70)?.id, "u1");
}

console.log(`\n${fail === 0 ? "OK" : "GAGAL"} — lulus: ${pass}, gagal: ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
