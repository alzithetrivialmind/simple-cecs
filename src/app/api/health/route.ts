import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const status: Record<string, string> = {
    app: "ok",
    database: "unknown",
    timestamp: new Date().toISOString(),
  };

  try {
    await db.$queryRaw`SELECT 1`;
    status.database = "ok";
  } catch {
    status.database = "error";
  }

  const allOk = status.database === "ok";

  return NextResponse.json(status, { status: allOk ? 200 : 503 });
}
