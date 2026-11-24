"use server";

import { requireAuth } from "@/lib/auth-guard";
import { toUserMessage } from "@/lib/errors";
import { uploadBuffer } from "@/lib/storage";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import {
  validateUpload,
  sanitizeFolder,
  resolveWithinRoot,
} from "@/lib/upload-guard";

export interface UploadResult {
  success: boolean;
  url?: string;
  fileKey?: string;
  error?: string;
}

/**
 * Build a storage key from server-controlled parts only.
 *
 * The extension comes from the MIME allowlist, never from the uploaded
 * file name — a raw multipart request can set a name containing "/" or
 * "..", which would otherwise escape the uploads directory on write.
 */
function buildFileKey(folder: string, ext: string) {
  const safeFolder = sanitizeFolder(folder);
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  return { fileKey: `${safeFolder}/${fileName}`, safeFolder, fileName };
}

/**
 * Mirror to the local uploads directory, best-effort.
 * MinIO is the primary store, so failures here are non-fatal.
 */
async function mirrorLocally(
  safeFolder: string,
  fileName: string,
  buffer: Buffer
) {
  try {
    const uploadsRoot = path.join(process.cwd(), "public", "uploads");
    const target = resolveWithinRoot(uploadsRoot, `${safeFolder}/${fileName}`);
    if (!target) return; // should be unreachable; both parts are server-built

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
  } catch (fsErr) {
    // Non-fatal: MinIO is our primary persistent storage
    console.warn("Local uploads dir not writable, served via MinIO:", fsErr);
  }
}

/**
 * Upload image from base64 data URL (e.g. from camera capture)
 */
export async function uploadBase64Image(
  dataUrl: string,
  folder = "general"
): Promise<UploadResult> {
  try {
    await requireAuth();

    const matches = dataUrl.match(/^data:([A-Za-z0-9-+\/.]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return { success: false, error: "Format data gambar base64 tidak valid." };
    }

    const buffer = Buffer.from(matches[2], "base64");

    // Allowlist + size + magic-byte check in one place
    const validated = validateUpload(matches[1], buffer);
    if (!validated.ok) {
      return { success: false, error: validated.error };
    }

    const { fileKey, safeFolder, fileName } = buildFileKey(
      folder,
      validated.ext
    );

    // 1. Upload to MinIO S3 (persistent storage)
    await uploadBuffer(fileKey, buffer, validated.mime);

    // 2. Try to mirror to local public/uploads directory if writable
    await mirrorLocally(safeFolder, fileName, buffer);

    return {
      success: true,
      url: `/api/files/${fileKey}`,
      fileKey,
    };
  } catch (err: unknown) {
    const msg = toUserMessage(err, "Gagal mengunggah foto.");
    return { success: false, error: msg };
  }
}

/**
 * Upload image or file from FormData
 */
export async function uploadFormData(
  formData: FormData,
  folder = "general"
): Promise<UploadResult> {
  try {
    await requireAuth();

    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, error: "Tidak ada berkas yang dipilih." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Allowlist + size + magic-byte check in one place
    const validated = validateUpload(file.type, buffer);
    if (!validated.ok) {
      return { success: false, error: validated.error };
    }

    const { fileKey, safeFolder, fileName } = buildFileKey(
      folder,
      validated.ext
    );

    // 1. Upload to MinIO S3 (persistent storage)
    await uploadBuffer(fileKey, buffer, validated.mime);

    // 2. Try to mirror to public/uploads
    await mirrorLocally(safeFolder, fileName, buffer);

    return {
      success: true,
      url: `/api/files/${fileKey}`,
      fileKey,
    };
  } catch (err: unknown) {
    const msg = toUserMessage(err, "Gagal mengunggah berkas.");
    return { success: false, error: msg };
  }
}
