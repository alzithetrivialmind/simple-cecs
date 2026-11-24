"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";

export interface TimelineAttachment {
  id: string;
  title: string;
  url: string;
  kind?: string;
  fileName?: string;
  uploadedAt?: Date;
  uploadedBy?: {
    name: string;
    nik?: string;
    avatarUrl?: string | null;
  } | null;
}

export interface TimelineUser {
  id?: string;
  name: string;
  nik?: string;
  avatarUrl?: string | null;
  role?: string;
}

export type TimelineCategory = "ALL" | "USAGE" | "BREAKDOWN_WO" | "HOUR_METER" | "INSPECTION";

export interface DetailedTimelineEvent {
  id: string;
  type:
    | "USAGE_START"
    | "USAGE_END"
    | "BREAKDOWN"
    | "WORK_ORDER_CREATED"
    | "WORK_ORDER_STARTED"
    | "WORK_ORDER_CLOSED"
    | "HOUR_METER"
    | "INSPECTION"
    | "PM_EXECUTION";
  date: Date;
  title: string;
  description: string;
  category: "USAGE" | "BREAKDOWN_WO" | "HOUR_METER" | "INSPECTION";
  badgeText: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  linkUrl?: string;
  user?: TimelineUser | null;
  attachments: TimelineAttachment[];
  metadata?: {
    code?: string;
    priority?: string;
    status?: string;
    durationMinutes?: number | null;
    hourMeter?: number;
    downtimeMinutes?: number | null;
    remarks?: string | null;
    correctiveAction?: string | null;
  };
}

function formatFileUrl(fileKey: string): string {
  if (!fileKey) return "";
  if (
    fileKey.startsWith("http://") ||
    fileKey.startsWith("https://") ||
    fileKey.startsWith("/")
  ) {
    return fileKey;
  }
  return `/api/files/${encodeURIComponent(fileKey)}`;
}

export async function getDetailedEquipmentTimeline(
  equipmentId: string
): Promise<DetailedTimelineEvent[]> {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const [
    usageSessions,
    breakdowns,
    workOrders,
    hourMeterLogs,
    inspections,
  ] = await Promise.all([
    // 1. Operator Usage Sessions (Mulai & Selesai Dipakai)
    db.equipmentUsageSession.findMany({
      where: { equipmentId },
      orderBy: { startAt: "desc" },
      take: 100,
      include: {
        operator: {
          select: { id: true, name: true, nik: true, avatarUrl: true, role: true },
        },
      },
    }),
    // 2. Breakdown Requests
    db.breakdownRequest.findMany({
      where: { equipmentId, deletedAt: null },
      orderBy: { reportedAt: "desc" },
      take: 100,
      include: {
        reportedBy: {
          select: { id: true, name: true, nik: true, avatarUrl: true, role: true },
        },
      },
    }),
    // 3. Work Orders
    db.workOrder.findMany({
      where: { equipmentId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        assignedTo: {
          select: { id: true, name: true, nik: true, avatarUrl: true, role: true },
        },
        closedBy: {
          select: { id: true, name: true, nik: true, avatarUrl: true, role: true },
        },
        breakdownRequest: {
          select: { code: true, problem: true, priority: true },
        },
        pmPlan: {
          include: { pmType: true },
        },
        repairResult: true,
        diagnosis: true,
      },
    }),
    // 4. Hour Meter Logs
    db.hourMeterLog.findMany({
      where: { equipmentId },
      orderBy: { readingDate: "desc" },
      take: 100,
      include: {
        createdBy: {
          select: { id: true, name: true, nik: true, avatarUrl: true, role: true },
        },
      },
    }),
    // 5. Inspections
    db.inspection.findMany({
      where: { equipmentId, deletedAt: null },
      orderBy: { inspectionDate: "desc" },
      take: 50,
      include: {
        inspector: {
          select: { id: true, name: true, nik: true, avatarUrl: true, role: true },
        },
        inspectionType: { select: { name: true } },
      },
    }),
  ]);

  // Fetch all related attachments
  const bdIds = breakdowns.map((b) => b.id);
  const woIds = workOrders.map((w) => w.id);
  const insIds = inspections.map((i) => i.id);

  const attachments = await db.attachment.findMany({
    where: {
      OR: [
        { entityType: "EQUIPMENT", entityId: equipmentId },
        ...(bdIds.length > 0 ? [{ entityType: "BREAKDOWN" as const, entityId: { in: bdIds } }] : []),
        ...(woIds.length > 0 ? [{ entityType: "WORK_ORDER" as const, entityId: { in: woIds } }] : []),
        ...(insIds.length > 0 ? [{ entityType: "INSPECTION" as const, entityId: { in: insIds } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: {
        select: { id: true, name: true, nik: true, avatarUrl: true },
      },
    },
  });

  // Map attachments by entityId
  const attachmentsByEntityId: Record<string, typeof attachments> = {};
  for (const att of attachments) {
    if (!attachmentsByEntityId[att.entityId]) {
      attachmentsByEntityId[att.entityId] = [];
    }
    attachmentsByEntityId[att.entityId].push(att);
  }

  const events: DetailedTimelineEvent[] = [];

  // 1. Process Usage Sessions (Dipakai & Selesai Dipakai)
  for (const s of usageSessions) {
    // 1a. Sesi Mulai Dipakai
    const startAttachments: TimelineAttachment[] = [];
    if (s.startPhotoUrl) {
      startAttachments.push({
        id: `${s.id}-start-photo`,
        title: "Foto Meteran Mulai Pemakaian",
        url: formatFileUrl(s.startPhotoUrl),
        kind: "METERAN_AWAL",
        uploadedAt: s.startAt,
        uploadedBy: s.operator,
      });
    }

    events.push({
      id: `usage-start-${s.id}`,
      type: "USAGE_START",
      category: "USAGE",
      date: s.startAt,
      title: "Unit Mulai Digunakan (Operasional)",
      description: s.remarks
        ? `Catatan operator: "${s.remarks}"`
        : "Operator memulai sesi pemakaian unit alat berat.",
      badgeText: "Mulai Dipakai",
      badgeVariant: "default",
      user: s.operator,
      attachments: startAttachments,
      metadata: {
        remarks: s.remarks,
        status: s.status,
      },
    });

    // 1b. Sesi Selesai Dipakai (jika ada endAt)
    if (s.endAt) {
      const endAttachments: TimelineAttachment[] = [];
      if (s.endPhotoUrl) {
        endAttachments.push({
          id: `${s.id}-end-photo`,
          title: "Foto Meteran Selesai Pemakaian",
          url: formatFileUrl(s.endPhotoUrl),
          kind: "METERAN_AKHIR",
          uploadedAt: s.endAt,
          uploadedBy: s.operator,
        });
      }

      const durHours = s.durationMinutes ? Math.floor(s.durationMinutes / 60) : 0;
      const durMins = s.durationMinutes ? s.durationMinutes % 60 : 0;
      const durStr = durHours > 0 ? `${durHours} jam ${durMins} menit` : `${durMins} menit`;

      events.push({
        id: `usage-end-${s.id}`,
        type: "USAGE_END",
        category: "USAGE",
        date: s.endAt,
        title: "Unit Selesai Digunakan",
        description: s.durationMinutes
          ? `Durasi pemakaian operasional: ${durStr}.`
          : "Sesi penggunaan unit telah selesai.",
        badgeText: "Selesai Dipakai",
        badgeVariant: "secondary",
        user: s.operator,
        attachments: endAttachments,
        metadata: {
          durationMinutes: s.durationMinutes,
          status: s.status,
        },
      });
    }
  }

  // 2. Process Breakdowns (Laporan Kerusakan)
  for (const bd of breakdowns) {
    const bdAtts: TimelineAttachment[] = (attachmentsByEntityId[bd.id] || []).map((att) => ({
      id: att.id,
      title: `Foto Bukti Kerusakan (${att.fileName})`,
      url: formatFileUrl(att.fileKey),
      kind: att.kind,
      fileName: att.fileName,
      uploadedAt: att.createdAt,
      uploadedBy: att.uploadedBy,
    }));

    events.push({
      id: `bd-${bd.id}`,
      type: "BREAKDOWN",
      category: "BREAKDOWN_WO",
      date: bd.reportedAt,
      title: `Laporan Kerusakan #${bd.code}`,
      description: bd.problem,
      badgeText: `Breakdown (${bd.priority})`,
      badgeVariant: bd.priority === "CRITICAL" || bd.priority === "HIGH" ? "destructive" : "default",
      user: bd.reportedBy,
      attachments: bdAtts,
      metadata: {
        code: bd.code,
        priority: bd.priority,
        hourMeter: bd.hourMeter,
        status: bd.status,
      },
    });
  }

  // 3. Process Work Orders (Penerbitan, Dikerjakan, Ditutup)
  for (const wo of workOrders) {
    const woAtts: TimelineAttachment[] = (attachmentsByEntityId[wo.id] || []).map((att) => ({
      id: att.id,
      title: `Lampiran WO (${att.fileName})`,
      url: formatFileUrl(att.fileKey),
      kind: att.kind,
      fileName: att.fileName,
      uploadedAt: att.createdAt,
      uploadedBy: att.uploadedBy,
    }));

    // 3a. Diterbitkan
    events.push({
      id: `wo-created-${wo.id}`,
      type: "WORK_ORDER_CREATED",
      category: "BREAKDOWN_WO",
      date: wo.createdAt,
      title: `Work Order Diterbitkan #${wo.code}`,
      description: wo.breakdownRequest
        ? `Berdasarkan laporan #${wo.breakdownRequest.code}: ${wo.breakdownRequest.problem}`
        : wo.pmPlan
        ? `Jadwal Preventive Maintenance: ${wo.pmPlan.pmType.name}`
        : `Perintah kerja perbaikan unit (${wo.type})`,
      badgeText: `WO ${wo.type}`,
      badgeVariant: "outline",
      user: wo.assignedTo,
      linkUrl: `/work-order/${wo.id}`,
      attachments: woAtts,
      metadata: {
        code: wo.code,
        status: wo.status,
      },
    });

    // 3b. Mulai Dikerjakan (jika ada startedAt)
    if (wo.startedAt) {
      events.push({
        id: `wo-started-${wo.id}`,
        type: "WORK_ORDER_STARTED",
        category: "BREAKDOWN_WO",
        date: wo.startedAt,
        title: `Pekerjaan Dimulai Teknisi #${wo.code}`,
        description: wo.diagnosis?.finding
          ? `Temuan pemeriksaan teknisi: "${wo.diagnosis.finding}". Akar penyebab: "${wo.diagnosis.rootCause}"`
          : "Teknisi telah memulai pengerjaan fisik dan investigasi pada unit.",
        badgeText: "Sedang Dikerjakan",
        badgeVariant: "default",
        user: wo.assignedTo,
        linkUrl: `/work-order/${wo.id}`,
        attachments: woAtts.filter((a) => a.kind === "PHOTO_BEFORE" || a.kind === "PHOTO"),
        metadata: {
          code: wo.code,
          status: wo.status,
        },
      });
    }

    // 3c. Closed / Selesai (jika status CLOSED)
    if (wo.status === "CLOSED" && (wo.closedAt || wo.finishedAt || wo.updatedAt)) {
      const closedDate = wo.closedAt || wo.finishedAt || wo.updatedAt;
      const dtHours = wo.downtimeMinutes ? Math.floor(wo.downtimeMinutes / 60) : 0;
      const dtMins = wo.downtimeMinutes ? wo.downtimeMinutes % 60 : 0;
      const dtStr = dtHours > 0 ? `${dtHours} jam ${dtMins} menit` : `${dtMins} menit`;

      events.push({
        id: `wo-closed-${wo.id}`,
        type: "WORK_ORDER_CLOSED",
        category: "BREAKDOWN_WO",
        date: closedDate,
        title: `Work Order Selesai & Ditutup #${wo.code}`,
        description: wo.repairResult?.correctiveAction
          ? `Tindakan perbaikan: "${wo.repairResult.correctiveAction}". ${wo.downtimeMinutes ? `Total henti: ${dtStr}.` : ""} Unit dinyatakan laik kembali.`
          : `Perbaikan selesai. ${wo.downtimeMinutes ? `Total downtime: ${dtStr}.` : ""} Unit siap dioperasikan.`,
        badgeText: "WO Selesai (Closed)",
        badgeVariant: "secondary",
        user: wo.closedBy || wo.assignedTo,
        linkUrl: `/work-order/${wo.id}`,
        attachments: woAtts.filter((a) => a.kind === "PHOTO_AFTER" || a.kind === "PHOTO"),
        metadata: {
          code: wo.code,
          status: wo.status,
          downtimeMinutes: wo.downtimeMinutes,
          correctiveAction: wo.repairResult?.correctiveAction,
        },
      });
    }
  }

  // 4. Process Hour Meter Logs
  for (const hm of hourMeterLogs) {
    events.push({
      id: `hm-${hm.id}`,
      type: "HOUR_METER",
      category: "HOUR_METER",
      date: hm.readingDate,
      title: `Pencatatan Jam Operasi (${hm.hourMeter.toLocaleString("id-ID")} Jam)`,
      description: hm.remark
        ? `Catatan: "${hm.remark}"`
        : `Pencatatan hour meter sumber ${hm.source}.`,
      badgeText: `${hm.hourMeter} HM`,
      badgeVariant: "secondary",
      user: hm.createdBy,
      attachments: [],
      metadata: {
        hourMeter: hm.hourMeter,
        remarks: hm.remark,
      },
    });
  }

  // 5. Process Inspections
  for (const ins of inspections) {
    const insAtts: TimelineAttachment[] = (attachmentsByEntityId[ins.id] || []).map((att) => ({
      id: att.id,
      title: `Lampiran Inspeksi (${att.fileName})`,
      url: formatFileUrl(att.fileKey),
      kind: att.kind,
      fileName: att.fileName,
      uploadedAt: att.createdAt,
      uploadedBy: att.uploadedBy,
    }));

    events.push({
      id: `ins-${ins.id}`,
      type: "INSPECTION",
      category: "INSPECTION",
      date: ins.inspectionDate,
      title: `Inspeksi Keselamatan #${ins.code} (${ins.inspectionType.name})`,
      description: `Hasil evaluasi: ${ins.result}${ins.finding ? ` • Temuan: "${ins.finding}"` : ""}${ins.recommendation ? ` • Rekomendasi: "${ins.recommendation}"` : ""}`,
      badgeText: `Inspeksi: ${ins.result}`,
      badgeVariant: ins.result === "FAIL" ? "destructive" : "secondary",
      user: ins.inspector,
      linkUrl: `/inspection/${ins.id}`,
      attachments: insAtts,
      metadata: {
        code: ins.code,
        hourMeter: ins.hourMeter,
        status: ins.result,
      },
    });
  }

  // Sort descending by date (newest first)
  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
