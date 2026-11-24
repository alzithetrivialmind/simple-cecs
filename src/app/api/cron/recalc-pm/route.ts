import { NextRequest, NextResponse } from "next/server";
import { toUserMessage } from "@/lib/errors";
import { verifyCronRequest } from "@/lib/cron-auth";
import { recalcAllPmPlans } from "@/server/services/pm-status";

export async function POST(req: NextRequest) {
  // Perbandingan token waktu-konstan; lihat @/lib/cron-auth
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  try {
    const result = await recalcAllPmPlans();
    return NextResponse.json({
      success: true,
      message: "Kalkulasi ulang status PM selesai.",
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal menghitung ulang status PM");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
