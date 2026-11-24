import { ORG_NAME } from "@/lib/brand";
import { NextRequest, NextResponse } from "next/server";
import { toUserMessage } from "@/lib/errors";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { REPORT_ROLES } from "@/lib/roles";
import ExcelJS from "exceljs";
import { WorkOrderStatus, WorkOrderType } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireRole(REPORT_ROLES);

    const searchParams = req.nextUrl.searchParams;
    const reportType = searchParams.get("type") || "downtime";

    const workbook = new ExcelJS.Workbook();
    workbook.creator = `CECS - ${ORG_NAME}`;
    workbook.created = new Date();

    if (reportType === "downtime") {
      const worksheet = workbook.addWorksheet("Downtime & Perbaikan");

      worksheet.columns = [
        { header: "No. Work Order", key: "code", width: 18 },
        { header: "Kode Unit", key: "unitCode", width: 15 },
        { header: "Nama Unit", key: "unitName", width: 25 },
        { header: "Kategori", key: "category", width: 20 },
        { header: "Departemen", key: "department", width: 20 },
        { header: "Problem / Kerusakan", key: "problem", width: 35 },
        { header: "Penyebab (Root Cause)", key: "rootCause", width: 30 },
        { header: "Tindakan Perbaikan", key: "action", width: 35 },
        { header: "Downtime (Menit)", key: "downtimeMin", width: 18 },
        { header: "Downtime (Jam)", key: "downtimeHour", width: 18 },
        { header: "Tgl Selesai / Ditutup", key: "closedAt", width: 22 },
      ];

      const workOrders = await db.workOrder.findMany({
        where: {
          type: { in: [WorkOrderType.CORRECTIVE, WorkOrderType.INSPECTION_FOLLOW_UP] },
          status: WorkOrderStatus.CLOSED,
        },
        include: {
          equipment: { include: { department: true } },
          breakdownRequest: true,
          diagnosis: true,
          repairResult: true,
        },
        orderBy: { closedAt: "desc" },
      });

      for (const wo of workOrders) {
        const dtMin = wo.downtimeMinutes ?? 0;
        worksheet.addRow({
          code: wo.code,
          unitCode: wo.equipment.code,
          unitName: wo.equipment.name,
          category: wo.equipment.category,
          department: wo.equipment.department?.name || "-",
          problem: wo.breakdownRequest?.problem || "-",
          rootCause: wo.diagnosis?.rootCause || "-",
          action: wo.repairResult?.correctiveAction || "-",
          downtimeMin: dtMin,
          downtimeHour: Number((dtMin / 60).toFixed(1)),
          closedAt: wo.closedAt ? new Date(wo.closedAt).toLocaleString("id-ID") : "-",
        });
      }
    } else if (reportType === "pm") {
      const worksheet = workbook.addWorksheet("PM Compliance");

      worksheet.columns = [
        { header: "Kode Unit", key: "unitCode", width: 15 },
        { header: "Nama Unit", key: "unitName", width: 25 },
        { header: "Kategori", key: "category", width: 20 },
        { header: "Tipe Servis PM", key: "pmType", width: 25 },
        { header: "Basis", key: "basis", width: 15 },
        { header: "Interval HM", key: "intervalHour", width: 15 },
        { header: "Interval Hari", key: "intervalDays", width: 15 },
        { header: "HM Terakhir", key: "lastDoneHour", width: 15 },
        { header: "HM Berikutnya", key: "nextDueHour", width: 18 },
        { header: "Tgl Berikutnya", key: "nextDueDate", width: 18 },
        { header: "Status PM", key: "status", width: 15 },
      ];

      const plans = await db.pmPlan.findMany({
        where: { isActive: true, equipment: { deletedAt: null } },
        include: {
          equipment: true,
          pmType: true,
        },
        orderBy: [{ status: "asc" }, { nextDueHour: "asc" }],
      });

      for (const p of plans) {
        worksheet.addRow({
          unitCode: p.equipment.code,
          unitName: p.equipment.name,
          category: p.equipment.category,
          pmType: p.pmType.name,
          basis: p.basis,
          intervalHour: p.intervalHour || "-",
          intervalDays: p.intervalDays || "-",
          lastDoneHour: p.lastDoneHour || "-",
          nextDueHour: p.nextDueHour || "-",
          nextDueDate: p.nextDueDate ? new Date(p.nextDueDate).toLocaleDateString("id-ID") : "-",
          status: p.status,
        });
      }
    } else if (reportType === "parts") {
      const worksheet = workbook.addWorksheet("Pemakaian Spare Part");

      worksheet.columns = [
        { header: "Part Number", key: "partNumber", width: 20 },
        { header: "Deskripsi", key: "description", width: 35 },
        { header: "Sistem", key: "system", width: 18 },
        { header: "Qty Dipakai", key: "qty", width: 15 },
        { header: "Satuan", key: "unit", width: 12 },
        { header: "No. Work Order", key: "woCode", width: 18 },
        { header: "Unit Mesin", key: "unitCode", width: 15 },
        { header: "Tanggal Pemakaian", key: "usedAt", width: 22 },
      ];

      const usages = await db.partUsage.findMany({
        where: { deletedAt: null },
        include: {
          part: true,
          workOrder: {
            include: { equipment: true },
          },
        },
        orderBy: { usedAt: "desc" },
      });

      for (const u of usages) {
        worksheet.addRow({
          partNumber: u.part.partNumber,
          description: u.part.description,
          system: u.part.system,
          qty: u.qty,
          unit: u.part.unit,
          woCode: u.workOrder.code,
          unitCode: u.workOrder.equipment.code,
          usedAt: new Date(u.usedAt).toLocaleString("id-ID"),
        });
      }
    }

    // Apply standard styling to all sheets
    for (const ws of workbook.worksheets) {
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" },
      };
      ws.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
      ws.getRow(1).height = 25;
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="CECS_Laporan_${reportType.toUpperCase()}_${new Date().toISOString().split("T")[0]}.xlsx"`,
      },
    });
  } catch (error: unknown) {
    const msg = toUserMessage(error, "Gagal mengexport file excel.");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
