import { z } from "zod";

/**
 * Kebijakan kata sandi — satu sumber kebenaran.
 *
 * Aturannya ditegakkan pada saat kata sandi DITETAPKAN (buat user, reset oleh
 * admin, ganti mandiri), bukan pada saat login.
 *
 * Sebelumnya `loginSchema` ikut memvalidasi kekuatan password, sementara
 * pembuatan user hanya mensyaratkan 6 karakter. Akibatnya admin bisa membuat
 * akun dengan password 6 karakter yang **tidak akan pernah bisa login**,
 * karena validasi di gerbang login menolaknya lebih dulu dan pesan errornya
 * muncul sebagai "NIK atau password salah".
 *
 * Gerbang login kini hanya memastikan kolomnya terisi; kebenaran kata sandi
 * adalah urusan bcrypt.
 */

export const PASSWORD_MIN_LENGTH = 8;

/** Ketentuan yang ditampilkan di UI agar sejalan dengan validasi. */
export const PASSWORD_RULES = [
  `Minimal ${PASSWORD_MIN_LENGTH} karakter`,
  "Mengandung minimal 1 huruf besar",
  "Mengandung minimal 1 angka",
] as const;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password minimal ${PASSWORD_MIN_LENGTH} karakter`)
  .max(128, "Password maksimal 128 karakter")
  .regex(/[A-Z]/, "Password harus mengandung minimal 1 huruf besar")
  .regex(/[0-9]/, "Password harus mengandung minimal 1 angka");

/**
 * Periksa kekuatan kata sandi di luar konteks Zod.
 * Mengembalikan pesan kesalahan pertama, atau null bila memenuhi syarat.
 */
export function validatePasswordStrength(value: string): string | null {
  const result = passwordSchema.safeParse(value);
  if (result.success) return null;
  return result.error.errors[0]?.message ?? "Password tidak memenuhi syarat";
}
