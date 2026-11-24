/**
 * Guard terpusat untuk unggahan dan penyajian berkas.
 *
 * Dua aturan yang ditegakkan di sini:
 *
 * 1. Tipe berkas selalu berasal dari allowlist server, tidak pernah dari
 *    `file.name` atau `file.type` yang dikirim klien. Nama berkas dari
 *    multipart mentah bisa mengandung `/` atau `..`, dan Content-Type bisa
 *    dipalsukan menjadi `text/html` sehingga berkas tersaji sebagai halaman
 *    same-origin (stored XSS).
 *
 * 2. Kunci objek (`fileKey`) tidak boleh keluar dari direktori dasarnya.
 *    `path.join` tidak menahan `../`, jadi validasi dilakukan eksplisit.
 */

import path from "path";

/** Batas ukuran unggahan (10MB), selaras dengan serverActions.bodySizeLimit. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Satu-satunya sumber kebenaran: MIME yang diizinkan → ekstensi kanoniknya. */
const MIME_TO_EXT = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/pjpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);

/** Kebalikannya, untuk menentukan Content-Type saat menyajikan berkas. */
const EXT_TO_MIME = new Map<string, string>([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["pdf", "application/pdf"],
]);

export interface ResolvedUploadType {
  /** MIME tepercaya hasil allowlist. */
  mime: string;
  /** Ekstensi kanonik hasil allowlist. */
  ext: string;
}

/** Normalisasi MIME: buang parameter (`; charset=`), spasi, dan kapitalisasi. */
function normalizeMime(raw: string | null | undefined): string {
  return (raw || "").toLowerCase().split(";")[0].trim();
}

/**
 * Cocokkan isi berkas dengan tipe yang diklaim.
 *
 * Mencegah berkas HTML/SVG/skrip diselundupkan dengan Content-Type gambar.
 * Pengecekan hanya pada beberapa byte awal sehingga murah.
 */
function magicBytesMatch(buffer: Buffer, ext: string): boolean {
  switch (ext) {
    case "jpg":
      // SOI marker: FF D8 FF
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    case "png":
      // \x89PNG\r\n\x1a\n
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    case "webp":
      // "RIFF" .... "WEBP"
      return (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
      );
    case "pdf":
      // "%PDF-"
      return buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-";
    default:
      return false;
  }
}

/**
 * Tentukan tipe tepercaya dari MIME yang diklaim klien.
 * Mengembalikan `null` bila tipe tidak ada dalam allowlist.
 */
export function resolveUploadType(
  claimedMime: string | null | undefined
): ResolvedUploadType | null {
  const mime = normalizeMime(claimedMime);
  const ext = MIME_TO_EXT.get(mime);
  if (!ext) return null;

  // Selalu kembalikan MIME kanonik (mis. image/pjpeg → image/jpeg)
  return { mime: EXT_TO_MIME.get(ext) ?? mime, ext };
}

export interface ValidatedUpload {
  ok: true;
  mime: string;
  ext: string;
}

export interface RejectedUpload {
  ok: false;
  error: string;
}

/**
 * Validasi lengkap satu unggahan: allowlist tipe, batas ukuran, dan
 * kecocokan magic bytes. Ini gerbang tunggal yang dipakai semua aksi unggah.
 */
export function validateUpload(
  claimedMime: string | null | undefined,
  buffer: Buffer
): ValidatedUpload | RejectedUpload {
  const resolved = resolveUploadType(claimedMime);
  if (!resolved) {
    return {
      ok: false,
      error: "Tipe berkas tidak diizinkan. Gunakan JPG, PNG, WEBP, atau PDF.",
    };
  }

  if (buffer.length === 0) {
    return { ok: false, error: "Berkas kosong." };
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Ukuran berkas melebihi batas 10MB." };
  }

  if (!magicBytesMatch(buffer, resolved.ext)) {
    return {
      ok: false,
      error: "Isi berkas tidak cocok dengan tipenya. Unggah berkas asli.",
    };
  }

  return { ok: true, mime: resolved.mime, ext: resolved.ext };
}

/**
 * Bersihkan nama berkas asli agar aman disimpan dan ditampilkan.
 *
 * Nama ini hanya untuk label di UI — tidak pernah dipakai sebagai kunci
 * penyimpanan. Separator path dan karakter kendali dibuang supaya tidak
 * ada nama seperti `../../etc/passwd` yang tampil di daftar lampiran.
 */
export function safeDisplayName(
  originalName: string | null | undefined,
  ext: string
): string {
  const base = (originalName || "")
    .replace(/[\\/]/g, "_")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/\.+$/, "")
    .trim()
    .slice(0, 120);

  if (!base) return `upload.${ext}`;
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

/**
 * Segmen folder yang boleh dipakai sebagai prefix kunci objek.
 * Mencegah pemanggil menyisipkan `../` lewat argumen `folder`.
 */
const FOLDER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** Bersihkan nama folder; jatuh ke "general" bila tidak valid. */
export function sanitizeFolder(folder: string | null | undefined): string {
  const value = (folder || "").toLowerCase().trim();
  return FOLDER_PATTERN.test(value) ? value : "general";
}

/**
 * Tolak kunci objek yang mencoba keluar dari direktori dasarnya.
 *
 * Dipanggil sebelum kunci menyentuh MinIO maupun filesystem. Menolak
 * traversal (`..`), path absolut, backslash Windows, dan NUL byte.
 */
export function isSafeFileKey(fileKey: string): boolean {
  if (!fileKey || fileKey.length > 512) return false;
  if (fileKey.includes("\0")) return false;
  if (fileKey.includes("\\")) return false;
  if (fileKey.startsWith("/")) return false;
  if (path.isAbsolute(fileKey)) return false;

  // Periksa per segmen agar "..foo" (sah) tidak ikut tertolak,
  // sementara "../foo" dan "a/../b" tertolak.
  const segments = fileKey.split("/");
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") return false;
  }

  return true;
}

/**
 * Selesaikan `fileKey` relatif terhadap `rootDir` dan pastikan hasilnya
 * benar-benar berada di dalam `rootDir`. Mengembalikan `null` bila tidak.
 *
 * Ini lapis kedua setelah `isSafeFileKey` — menangkap kasus yang lolos
 * pemeriksaan string, mis. symlink-style resolution pada platform berbeda.
 */
export function resolveWithinRoot(
  rootDir: string,
  fileKey: string
): string | null {
  if (!isSafeFileKey(fileKey)) return null;

  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, fileKey);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return null;
  }

  return resolved;
}

/**
 * Content-Type untuk penyajian berkas, diturunkan dari ekstensi kunci objek
 * yang kita kontrol sendiri — bukan dari metadata yang tersimpan bersama
 * berkas, karena metadata itu berasal dari klien saat unggah.
 */
export function contentTypeForKey(fileKey: string): string {
  const ext = fileKey.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME.get(ext) ?? "application/octet-stream";
}

/**
 * Header respons untuk berkas tersimpan.
 *
 * `default-src 'none'; sandbox` adalah pengaman terakhir: seandainya suatu
 * berkas HTML lolos semua lapisan di atas, ia tetap tidak bisa menjalankan
 * skrip atau mengakses origin aplikasi. PDF dipaksa diunduh karena viewer
 * PDF bawaan browser punya riwayat celah skrip.
 */
export function fileResponseHeaders(fileKey: string): Record<string, string> {
  const contentType = contentTypeForKey(fileKey);
  const isPdf = contentType === "application/pdf";
  const isImage = contentType.startsWith("image/");

  return {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": isImage ? "inline" : "attachment",
    "Cache-Control": "private, max-age=3600",
    ...(isPdf ? { "X-Frame-Options": "DENY" } : {}),
  };
}
