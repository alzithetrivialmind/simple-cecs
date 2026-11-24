import { Client } from "minio";

/**
 * Ambil variabel lingkungan wajib, atau gagal dengan pesan jelas.
 *
 * Tidak ada lagi fallback ke "minioadmin": lebih baik gagal terang-terangan
 * daripada diam-diam berjalan memakai kredensial default yang diketahui publik.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} belum diset. Isi di .env.production sebelum menjalankan aplikasi.`
    );
  }
  return value;
}

export const BUCKET_NAME = process.env.MINIO_BUCKET || "cecs-attachments";

const globalForMinio = globalThis as unknown as {
  minioClient: Client | undefined;
};

/**
 * Klien MinIO, dibuat saat pertama kali dipakai.
 *
 * Inisialisasi sengaja ditunda (bukan saat module load) karena `next build`
 * meng-import modul ini untuk menganalisis route, sementara tahap build tidak
 * punya — dan tidak seharusnya punya — kredensial MinIO sungguhan. Dengan
 * lazy init, kredensial hanya diwajibkan saat ada permintaan nyata ke storage.
 */
export function getMinioClient(): Client {
  if (!globalForMinio.minioClient) {
    globalForMinio.minioClient = new Client({
      endPoint: process.env.MINIO_ENDPOINT || "localhost",
      port: parseInt(process.env.MINIO_PORT || "9000", 10),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: requireEnv("MINIO_ACCESS_KEY"),
      secretKey: requireEnv("MINIO_SECRET_KEY"),
    });
  }
  return globalForMinio.minioClient;
}

/**
 * Ensure default bucket exists
 */
export async function ensureBucketExists(bucket = BUCKET_NAME): Promise<void> {
  const client = getMinioClient();
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket);
  }
}

/**
 * Generate a presigned PUT URL for client-side uploads (expires in 15 minutes by default)
 */
export async function getPresignedUploadUrl(
  fileKey: string,
  bucket = BUCKET_NAME,
  expirySeconds = 900
): Promise<string> {
  await ensureBucketExists(bucket);
  return await getMinioClient().presignedPutObject(bucket, fileKey, expirySeconds);
}

/**
 * Generate a presigned GET URL for viewing private files (expires in 1 hour by default)
 */
export async function getPresignedDownloadUrl(
  fileKey: string,
  bucket = BUCKET_NAME,
  expirySeconds = 3600
): Promise<string> {
  return await getMinioClient().presignedGetObject(bucket, fileKey, expirySeconds);
}

/**
 * Upload a Buffer or Stream directly from server
 */
export async function uploadBuffer(
  fileKey: string,
  buffer: Buffer,
  mimeType: string,
  bucket = BUCKET_NAME
): Promise<void> {
  await ensureBucketExists(bucket);
  await getMinioClient().putObject(bucket, fileKey, buffer, buffer.length, {
    "Content-Type": mimeType,
  });
}

/**
 * Delete an object from MinIO storage
 */
export async function deleteFile(
  fileKey: string,
  bucket = BUCKET_NAME
): Promise<void> {
  await getMinioClient().removeObject(bucket, fileKey);
}

/**
 * Get readable stream for an object
 */
export async function getFileStream(fileKey: string, bucket = BUCKET_NAME) {
  return await getMinioClient().getObject(bucket, fileKey);
}
