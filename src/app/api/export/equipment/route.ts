import { ORG_NAME } from "@/lib/brand";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { REPORT_ROLES } from "@/lib/roles";
import ExcelJS from "exceljs";

export async function GET() {
  try {
    await requireRole(REPORT_ROLES);

    const equipmentList = await db.equipment.findMany({
      where: { deletedAt: null },
      orderBy: { code: "asc" },
      include: {
        department: true,
        location: true,
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = `CECS - ${ORG_NAME}`;
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Equipment");

    worksheet.columns = [
      { header: "Kode Unit", key: "code", width: 15 },
      { header: "Nama Unit", key: "name", width: 30 },
      { header: "Kategori", key: "category", width: 20 },
      { header: "Status", key: "status", width: 15 },
      { header: "Kepemilikan", key: "ownership", width: 15 },
      { header: "No. Aset", key: "assetNumber", width: 15 },
      { header: "Supplier", key: "supplier", width: 20 },
      { header: "Merk / Pabrikan", key: "manufacturer", width: 20 },
      { header: "Model / Tipe", key: "model", width: 20 },
      { header: "Nomor Seri (S/N)", key: "serialNumber", width: 20 },
      { header: "Tahun Pembuatan", key: "yearOfManufacture", width: 15 },
      { header: "Hour Meter (Jam)", key: "currentHourMeter", width: 18 },
      { header: "Lokasi", key: "location", width: 20 },
      { header: "Departemen", key: "department", width: 25 },
      { header: "Model Mesin", key: "engineModel", width: 20 },
      { header: "Kapasitas", key: "capacity", width: 15 },
      { header: "Bahan Bakar", key: "fuelType", width: 15 },
      { header: "No. Seri Mesin", key: "engineSerialNumber", width: 18 },
      { header: "Transmisi", key: "transmission", width: 22 },
      { header: "Kap. Oli Mesin (L)", key: "engineOilCapacity", width: 18 },
      { header: "Kap. Oli Transmisi (L)", key: "transmissionOilCapacity", width: 20 },
      { header: "Kap. Oli Hidrolik (L)", key: "hydraulicOilCapacity", width: 20 },
      { header: "Kap. Tangki BBM (L)", key: "fuelTankCapacity", width: 20 },
      { header: "Pabrikan Mesin", key: "engineManufacturer", width: 18 },
      { header: "Daya Mesin", key: "enginePower", width: 18 },
      { header: "Torsi Maks", key: "maxTorque", width: 18 },
      { header: "Jumlah Silinder", key: "cylinderCount", width: 15 },
      { header: "Volume Silinder", key: "engineDisplacement", width: 15 },
      { header: "Sistem Hidrolik", key: "hydraulicSystem", width: 25 },
      { header: "Kecepatan Maks", key: "maxTravelSpeed", width: 15 },
      { header: "Kemampuan Menanjak", key: "gradeability", width: 18 },
      { header: "Radius Putar Min", key: "turningRadius", width: 18 },
      { header: "Dimensi (PxLxT)", key: "dimensions", width: 22 },
      { header: "Catatan", key: "notes", width: 50 },
    ];

    // Style Header Row
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" }, // Dark slate
    };
    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    equipmentList.forEach((eq) => {
      worksheet.addRow({
        code: eq.code,
        name: eq.name,
        category: eq.category,
        status: eq.status,
        ownership: eq.ownership,
        assetNumber: eq.assetNumber || "-",
        supplier: eq.supplier || "-",
        manufacturer: eq.manufacturer || "-",
        model: eq.model || "-",
        serialNumber: eq.serialNumber || "-",
        yearOfManufacture: eq.yearOfManufacture || "-",
        currentHourMeter: eq.currentHourMeter,
        location: eq.location?.name || "-",
        department: eq.department?.name || "-",
        engineModel: eq.engineModel || "-",
        capacity: eq.capacity || "-",
        fuelType: eq.fuelType || "-",
        engineManufacturer: eq.engineManufacturer || "-",
        engineSerialNumber: eq.engineSerialNumber || "-",
        transmission: eq.transmission || "-",
        engineOilCapacity: eq.engineOilCapacity ?? "-",
        transmissionOilCapacity: eq.transmissionOilCapacity ?? "-",
        hydraulicOilCapacity: eq.hydraulicOilCapacity ?? "-",
        fuelTankCapacity: eq.fuelTankCapacity ?? "-",
        enginePower: eq.enginePower || "-",
        maxTorque: eq.maxTorque || "-",
        cylinderCount: eq.cylinderCount || "-",
        engineDisplacement: eq.engineDisplacement || "-",
        hydraulicSystem: eq.hydraulicSystem || "-",
        maxTravelSpeed: eq.maxTravelSpeed || "-",
        gradeability: eq.gradeability || "-",
        turningRadius: eq.turningRadius || "-",
        dimensions: eq.dimensions || "-",
        notes: eq.notes || "-",
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="CECS_Equipment_${new Date().toISOString().split("T")[0]}.xlsx"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal mengekspor data equipment" },
      { status: 500 }
    );
  }
}
