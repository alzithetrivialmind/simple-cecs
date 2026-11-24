/**
 * Terjemahkan error menjadi pesan yang aman ditampilkan ke pengguna.
 *
 * Mengembalikan `error.message` apa adanya berbahaya: pesan Prisma memuat
 * nama tabel, nama kolom, nama constraint, bahkan potongan query. Semua itu
 * memudahkan pemetaan skema database oleh penyerang, dan juga tidak berguna
 * bagi mekanik di lapangan.
 *
 * Yang tetap diteruskan hanyalah pesan yang memang kita susun sendiri untuk
 * pengguna (UNAUTHORIZED/FORBIDDEN dari auth-guard) dan pelanggaran constraint
 * yang punya padanan kalimat manusiawi. Sisanya dicatat di log server, lalu
 * pengguna menerima pesan umum.
 */

import { Prisma } from "@prisma/client";

/** Awalan pesan yang sengaja kita lempar untuk ditampilkan ke pengguna. */
const PASSTHROUGH_PREFIXES = ["UNAUTHORIZED:", "FORBIDDEN:"];

function prismaMessage(err: Prisma.PrismaClientKnownRequestError): string | null {
  switch (err.code) {
    case "P2002":
      return "Data dengan nilai unik yang sama sudah terdaftar.";
    case "P2003":
      return "Data ini masih terkait dengan data lain, sehingga tidak dapat diproses.";
    case "P2025":
      return "Data yang dituju tidak ditemukan.";
    default:
      return null;
  }
}

/**
 * @param err      Error yang tertangkap.
 * @param fallback Pesan yang ditampilkan bila error tidak dikenali.
 */
export function toUserMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    const prefix = PASSTHROUGH_PREFIXES.find((p) => err.message.startsWith(p));
    if (prefix) {
      // Buang awalan teknisnya; sisanya memang kalimat untuk pengguna.
      return err.message.slice(prefix.length).trim() || fallback;
    }
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = prismaMessage(err);
    // Selalu catat kode aslinya supaya tetap bisa didiagnosis dari log.
    console.error(`Prisma error ${err.code}:`, err.message);
    if (mapped) return mapped;
    return fallback;
  }

  // Detail sebenarnya hanya boleh tinggal di log server.
  console.error("Unhandled error:", err);
  return fallback;
}
