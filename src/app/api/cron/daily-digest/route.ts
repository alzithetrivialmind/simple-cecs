import { NextRequest, NextResponse } from "next/server";
import { toUserMessage } from "@/lib/errors";
import { verifyCronRequest } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { PmStatus, WorkOrderStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  // Perbandingan token waktu-konstan; lihat @/lib/cron-auth
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  try {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const [overduePm, duePm, staleWorkOrders, expiringCertificates] =
      await Promise.all([
        db.pmPlan.findMany({
          where: { status: PmStatus.OVERDUE, isActive: true },
          include: {
            equipment: { select: { code: true, name: true } },
            pmType: { select: { name: true } },
          },
        }),
        db.pmPlan.findMany({
          where: { status: PmStatus.DUE, isActive: true },
          include: {
            equipment: { select: { code: true, name: true } },
            pmType: { select: { name: true } },
          },
        }),
        db.workOrder.findMany({
          where: {
            status: { in: [WorkOrderStatus.OPEN, WorkOrderStatus.WAITING_PART] },
            createdAt: { lte: threeDaysAgo },
            deletedAt: null,
          },
          include: {
            equipment: { select: { code: true, name: true } },
            assignedTo: { select: { name: true } },
          },
        }),
        db.inspection.findMany({
          where: {
            validUntil: {
              gte: now,
              lte: in30Days,
            },
            deletedAt: null,
          },
          include: {
            equipment: { select: { code: true, name: true } },
            inspectionType: { select: { name: true } },
          },
        }),
      ]);

    const digest = {
      summaryDate: now.toISOString(),
      overduePmCount: overduePm.length,
      duePmCount: duePm.length,
      staleWorkOrdersCount: staleWorkOrders.length,
      expiringCertificatesCount: expiringCertificates.length,
      details: {
        overduePm: overduePm.map((p) => `[${p.equipment.code}] ${p.equipment.name} - PM ${p.pmType.name}`),
        staleWorkOrders: staleWorkOrders.map((w) => `${w.code} ([${w.equipment.code}] ${w.equipment.name}) - Status: ${w.status}`),
        expiringCertificates: expiringCertificates.map((c) => `${c.code} (${c.inspectionType.name}) - Exp: ${c.validUntil?.toISOString().split("T")[0]}`),
      },
    };

    return NextResponse.json({
      success: true,
      digest,
    });
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal memproses daily digest");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
