import { NextRequest, NextResponse } from "next/server";
import { getMinioClient, BUCKET_NAME } from "@/lib/storage";
import { auth } from "@/auth";
import { promises as fs } from "fs";
import path from "path";
import {
  isSafeFileKey,
  resolveWithinRoot,
  fileResponseHeaders,
} from "@/lib/upload-guard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  // Only authenticated users may access stored files
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { key } = await params;
    const fileKey = key.join("/");

    // Reject path traversal before the key reaches MinIO or the filesystem.
    // path.join() does not contain "../", so this check is what keeps the
    // read confined to the uploads directory.
    if (!isSafeFileKey(fileKey)) {
      return new NextResponse("Invalid file key", { status: 400 });
    }

    // Content-Type is derived from the key's extension, never from the
    // metadata stored alongside the object — that metadata came from the
    // client at upload time and can claim text/html.
    const headers = fileResponseHeaders(fileKey);

    // 1. Try MinIO S3 storage first
    try {
      const stream = await getMinioClient().getObject(BUCKET_NAME, fileKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      return new NextResponse(buffer, { headers });
    } catch {
      // 2. Fallback to local uploads directory on disk
      try {
        const uploadsRoot = path.join(process.cwd(), "public", "uploads");
        const localPath = resolveWithinRoot(uploadsRoot, fileKey);
        if (!localPath) {
          return new NextResponse("Invalid file key", { status: 400 });
        }

        const buffer = await fs.readFile(localPath);

        return new NextResponse(buffer, { headers });
      } catch {
        return new NextResponse("File not found", { status: 404 });
      }
    }
  } catch {
    return new NextResponse("Invalid file request", { status: 400 });
  }
}
