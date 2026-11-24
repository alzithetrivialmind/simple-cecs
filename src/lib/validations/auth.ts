import { z } from "zod";

/**
 * Gerbang login.
 *
 * Sengaja TIDAK memvalidasi kekuatan kata sandi. Kebijakan kekuatan berlaku
 * saat kata sandi ditetapkan (lihat @/lib/validations/password); menegakkannya
 * di sini hanya akan mengunci pengguna yang kata sandinya dibuat sebelum
 * kebijakan berlaku, dan membocorkan aturan kata sandi ke penyerang.
 */
export const loginSchema = z.object({
  nik: z
    .string()
    .min(1, "NIK wajib diisi")
    .max(20, "NIK maksimal 20 karakter")
    .trim()
    .toUpperCase(),
  password: z
    .string()
    .min(1, "Password wajib diisi")
    .max(128, "Password terlalu panjang"),
});

export type LoginInput = z.infer<typeof loginSchema>;
