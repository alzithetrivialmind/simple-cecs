import { ORG_NAME } from "@/lib/brand";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { REPORT_ROLES } from "@/lib/roles";
import ExcelJS from "exceljs";

export async function GET() {
  try {
    await requireRole(REPORT_ROLES);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = `CECS - ${ORG_NAME}`;

    const worksheet = workbook.addWorksheet("Template_Import");

    worksheet.columns = [
      { header: "Kode Unit *", key: "code", width: 15 },
      { header: "Nama Unit *", key: "name", width: 30 },
      { header: "Kategori *", key: "category", width: 25 },
      { header: "Kepemilikan", key: "ownership", width: 15 },
      { header: "Hour Meter Awal", key: "currentHourMeter", width: 18 },
      { header: "Merk / Pabrikan", key: "manufacturer", width: 20 },
      { header: "Model / Tipe", key: "model", width: 20 },
      { header: "Nomor Seri (S/N)", key: "serialNumber", width: 20 },
      { header: "Tahun Pembuatan", key: "yearOfManufacture", width: 15 },
      { header: "Lokasi", key: "locationName", width: 20 },
      { header: "Departemen", key: "departmentName", width: 25 },
      { header: "Model Mesin", key: "engineModel", width: 20 },
      { header: "Kapasitas", key: "capacity", width: 15 },
      { header: "Bahan Bakar", key: "fuelType", width: 15 },
      { header: "Pabrikan Mesin", key: "engineManufacturer", width: 18 },
      { header: "No. Seri Mesin", key: "engineSerialNumber", width: 18 },
      { header: "Transmisi", key: "transmission", width: 22 },
      { header: "Kap. Oli Mesin (L)", key: "engineOilCapacity", width: 18 },
      { header: "Kap. Oli Transmisi (L)", key: "transmissionOilCapacity", width: 20 },
      { header: "Kap. Oli Hidrolik (L)", key: "hydraulicOilCapacity", width: 20 },
      { header: "Kap. Tangki BBM (L)", key: "fuelTankCapacity", width: 20 },
      { header: "Catatan", key: "notes", width: 50 },
      { header: "Supplier", key: "supplier", width: 20 },
    ];

    // Header styling
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0284C7" }, // Blue
    };

    // Sample data rows (fictional units)
    worksheet.addRow({
      code: "CRN-001",
      name: "Crawler Crane 50T",
      category: "HEAVY_EQUIPMENT",
      ownership: "OWNED",
      currentHourMeter: 1000,
      manufacturer: "Contoh Pabrikan",
      model: "MODEL-A",
      serialNumber: "SN-CONTOH-001",
      yearOfManufacture: 2020,
      locationName: "Area A",
      departmentName: "Alat Berat",
      engineModel: "ENGINE-A",
      capacity: "50 Ton",
      fuelType: "Solar / Diesel",
      engineManufacturer: "Contoh Pabrikan",
      engineSerialNumber: "ENG-CONTOH-001",
      transmission: "Hydraulic drive",
      engineOilCapacity: 25,
      transmissionOilCapacity: 10,
      hydraulicOilCapacity: 300,
      fuelTankCapacity: 350,
      notes: "Catatan teknis unit",
      supplier: "SUP-001",
    });

    worksheet.addRow({
      code: "FLT-001",
      name: "Forklift 5T",
      category: "HEAVY_EQUIPMENT",
      ownership: "OWNED",
      currentHourMeter: 500,
      manufacturer: "Contoh Pabrikan",
      model: "MODEL-B",
      serialNumber: "SN-CONTOH-002",
      yearOfManufacture: 2021,
      locationName: "Workshop Utama",
      departmentName: "Mekanik",
      capacity: "5 Ton",
      fuelType: "Solar / Diesel",
    });

    worksheet.addRow({
      code: "GEN-001",
      name: "Genset 150 kVA",
      category: "GENERATOR",
      ownership: "RENTAL",
      currentHourMeter: 1500,
      manufacturer: "Contoh Pabrikan",
      model: "MODEL-C",
      serialNumber: "SN-CONTOH-003",
      yearOfManufacture: 2019,
      locationName: "Area B",
      departmentName: "Elektrikal",
      capacity: "150 kVA",
      fuelType: "Solar / Diesel",
    });

    // Reference note sheet for categories
    const refSheet = workbook.addWorksheet("Panduan_Kategori");
    refSheet.columns = [
      { header: "Nilai Kategori Valid", key: "val", width: 30 },
      { header: "Keterangan", key: "desc", width: 40 },
    ];
    refSheet.getRow(1).font = { bold: true };
    refSheet.addRow({ val: "HEAVY_EQUIPMENT", desc: "Alat Berat (Crane, Forklift, Excavator)" });
    refSheet.addRow({ val: "VEHICLE", desc: "Kendaraan Operasional (Dump Truck, Pick Up)" });
    refSheet.addRow({ val: "GENERATOR", desc: "Genset / Pembangkit Listrik" });
    refSheet.addRow({ val: "COMPRESSOR", desc: "Kompresor Angin / Udara" });
    refSheet.addRow({ val: "PUMP", desc: "Pompa Air / Dewatering" });
    refSheet.addRow({ val: "WELDING_MACHINE", desc: "Mesin Las Bermesin" });
    refSheet.addRow({ val: "OTHER_POWERED_EQUIPMENT", desc: "Peralatan Bermesin Lainnya" });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Template_Import_Equipment_CECS.xlsx"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal mengunduh template" },
      { status: 500 }
    );
  }
}
