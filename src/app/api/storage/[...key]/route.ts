import { NextRequest, NextResponse } from "next/server";
import { getFileStream } from "@/lib/storage";
import { auth } from "@/auth";
import { Readable } from "stream";
import { isSafeFileKey, fileResponseHeaders } from "@/lib/upload-guard";

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

    // Reject path traversal before the key reaches storage
    if (!isSafeFileKey(fileKey)) {
      return new NextResponse("Invalid file key", { status: 400 });
    }

    const stream = await getFileStream(fileKey);

    // Convert Node Readable to Web ReadableStream
    const webStream = Readable.toWeb(stream) as ReadableStream;

    // Content type comes from the key's extension, not from client metadata
    return new NextResponse(webStream, {
      headers: fileResponseHeaders(fileKey),
    });
  } catch (error) {
    console.error("Storage streaming error:", error);
    return new NextResponse("File not found", { status: 404 });
  }
}
