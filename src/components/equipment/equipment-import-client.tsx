"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ExcelJS from "exceljs";
import {
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { importEquipmentRowSchema, ImportEquipmentRow } from "@/lib/validations/equipment";
import { importEquipmentBatch } from "@/server/actions/equipment";
import {
  IMPORT_FIELD_LABELS,
  ImportField,
  mapImportHeaders,
  parseExcelNumber,
} from "@/lib/excel-import";

interface ParsedRow {
  rowNumber: number;
  data: Partial<ImportEquipmentRow>;
  isValid: boolean;
  errors: string[];
}

export function EquipmentImportClient() {
  const router = useRouter();
  const [isParsing, setIsParsing] = React.useState(false);
  const [isCommitting, setIsCommitting] = React.useState(false);
  const [parsedRows, setParsedRows] = React.useState<ParsedRow[]>([]);
  const [fileName, setFileName] = React.useState<string>("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsParsing(true);
    setParsedRows([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        toast.error("Worksheet tidak ditemukan dalam file Excel");
        setIsParsing(false);
        return;
      }

      const headerTexts: string[] = [];
      worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headerTexts[colNumber - 1] = cell.text ?? "";
      });
      const columns = mapImportHeaders(headerTexts);

      if (!columns.code || !columns.name) {
        toast.error(
          "Kolom \"Kode Unit\" dan \"Nama Unit\" tidak ditemukan di baris pertama. Gunakan file dari tombol Download Template atau Export Excel."
        );
        setIsParsing(false);
        return;
      }

      const rows: ParsedRow[] = [];

      // Row 1 is header, start from row 2
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        // Absent column -> undefined (keeps existing data on update),
        // empty cell -> null
        const text = (field: ImportField): string | null | undefined => {
          const col = columns[field];
          if (!col) return undefined;
          const value = row.getCell(col).text?.trim();
          return value ? value : null;
        };
        const num = (field: ImportField): number | null | undefined => {
          const value = text(field);
          return value === undefined ? undefined : parseExcelNumber(value);
        };

        const codeVal = text("code");
        const nameVal = text("name");
        if (!codeVal && !nameVal) return; // empty row

        const rawData = {
          code: codeVal ?? "",
          name: nameVal ?? "",
          category: text("category") ?? "HEAVY_EQUIPMENT",
          ownership: text("ownership") ?? "OWNED",
          currentHourMeter: num("currentHourMeter") ?? 0,
          assetNumber: text("assetNumber"),
          supplier: text("supplier"),
          manufacturer: text("manufacturer"),
          model: text("model"),
          serialNumber: text("serialNumber"),
          yearOfManufacture: num("yearOfManufacture"),
          locationName: text("locationName"),
          departmentName: text("departmentName"),
          engineModel: text("engineModel"),
          capacity: text("capacity"),
          fuelType: text("fuelType"),
          engineSerialNumber: text("engineSerialNumber"),
          transmission: text("transmission"),
          engineOilCapacity: num("engineOilCapacity"),
          transmissionOilCapacity: num("transmissionOilCapacity"),
          hydraulicOilCapacity: num("hydraulicOilCapacity"),
          fuelTankCapacity: num("fuelTankCapacity"),
          engineManufacturer: text("engineManufacturer"),
          enginePower: text("enginePower"),
          maxTorque: text("maxTorque"),
          cylinderCount: text("cylinderCount"),
          engineDisplacement: text("engineDisplacement"),
          hydraulicSystem: text("hydraulicSystem"),
          maxTravelSpeed: text("maxTravelSpeed"),
          gradeability: text("gradeability"),
          turningRadius: text("turningRadius"),
          dimensions: text("dimensions"),
          notes: text("notes"),
        };

        const validation = importEquipmentRowSchema.safeParse(rawData);
        if (validation.success) {
          rows.push({
            rowNumber,
            data: validation.data,
            isValid: true,
            errors: [],
          });
        } else {
          rows.push({
            rowNumber,
            data: rawData,
            isValid: false,
            errors: validation.error.errors.map((err) => {
              const field = String(err.path[0]) as ImportField;
              return `${IMPORT_FIELD_LABELS[field] ?? field}: ${err.message}`;
            }),
          });
        }
      });

      setParsedRows(rows);
      toast.success(`Berhasil membaca ${rows.length} baris data dari Excel.`);
    } catch {
      toast.error("Gagal membaca file Excel. Pastikan format file adalah .xlsx yang valid.");
    } finally {
      setIsParsing(false);
    }
  };

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);

  const handleCommit = async () => {
    if (validRows.length === 0) {
      toast.error("Tidak ada baris valid untuk diimpor.");
      return;
    }

    setIsCommitting(true);
    try {
      const payload = validRows.map((r) => r.data as ImportEquipmentRow);
      const res = await importEquipmentBatch(payload);

      if (res.success) {
        toast.success(`Berhasil mengimpor ${res.count} unit equipment ke database!`);
        router.push("/equipment");
      } else {
        toast.error(res.error || "Gagal mengimpor data unit.");
      }
    } catch {
      toast.error("Terjadi kesalahan saat menyimpan ke database.");
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/equipment"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Daftar Equipment
        </Link>
        <a href="/api/export/equipment-template" download>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4 text-emerald-600" />
            Unduh Template Excel
          </Button>
        </a>
      </div>

      <div>
        <h1 className="font-condensed text-3xl font-bold leading-tight tracking-tight">Impor equipment dari Excel</h1>
      </div>

      {/* Upload Box */}
      <Card>
        <CardContent className="p-6 md:p-8">
          <div className="border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center justify-center gap-4 text-center bg-muted/20 hover:bg-muted/40 transition-colors">
            <div className="p-4 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
              <FileSpreadsheet className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-foreground">
                {fileName ? `File: ${fileName}` : "Pilih Berkas Excel (.xlsx)"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Pastikan kolom mengikuti urutan pada template resmi CECS untuk menghindari kesalahan validasi.
              </p>
            </div>
            <input
              type="file"
              id="excelInput"
              accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isParsing || isCommitting}
            />
            <Button
              type="button"
              onClick={() => document.getElementById("excelInput")?.click()}
              disabled={isParsing || isCommitting}
              className="gap-2"
            >
              {isParsing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Membaca Data Excel...
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  Pilih File Excel
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Section */}
      {parsedRows.length > 0 && (
        <div className="space-y-4">
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground">Total Baris Terbaca</span>
                  <div className="text-xl font-bold">{parsedRows.length}</div>
                </div>
                <FileSpreadsheet className="h-6 w-6 text-slate-400" />
              </CardContent>
            </Card>

            <Card className="border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-emerald-600 font-semibold">Baris Valid (Siap Impor)</span>
                  <div className="text-xl font-bold text-emerald-600">{validRows.length}</div>
                </div>
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </CardContent>
            </Card>

            <Card className={invalidRows.length > 0 ? "border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20" : ""}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-rose-600 font-semibold">Baris Error (Dilewati)</span>
                  <div className="text-xl font-bold text-rose-600">{invalidRows.length}</div>
                </div>
                <AlertCircle className="h-6 w-6 text-rose-600" />
              </CardContent>
            </Card>
          </div>

          {/* Table Preview */}
          <Card>
            <CardHeader className="p-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Tabel Pratinjau Data Impor
                </CardTitle>
                <CardDescription className="text-xs">
                  Baris berstatus valid akan disimpan ke sistem.
                </CardDescription>
              </div>
              <Button
                onClick={handleCommit}
                disabled={isCommitting || validRows.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Mengimpor Unit...
                  </>
                ) : (
                  `Commit Impor (${validRows.length} Unit)`
                )}
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Baris</TableHead>
                    <TableHead>Status Validasi</TableHead>
                    <TableHead>Kode</TableHead>
                    <TableHead>Nama Unit</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Departemen</TableHead>
                    <TableHead>HM Awal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row) => (
                    <TableRow
                      key={row.rowNumber}
                      className={row.isValid ? "" : "bg-rose-500/10"}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{row.rowNumber}
                      </TableCell>
                      <TableCell>
                        {row.isValid ? (
                          <Badge variant="ready" className="text-[10px]">
                            VALID
                          </Badge>
                        ) : (
                          <div className="space-y-0.5">
                            <Badge variant="destructive" className="text-[10px]">
                              ERROR
                            </Badge>
                            <p className="text-[10px] text-rose-600 font-medium">
                              {row.errors.join(", ")}
                            </p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-xs">
                        {row.data.code || "-"}
                      </TableCell>
                      <TableCell className="font-medium text-xs">
                        {row.data.name || "-"}
                      </TableCell>
                      <TableCell className="text-xs">{row.data.category || "-"}</TableCell>
                      <TableCell className="text-xs">{row.data.locationName || "-"}</TableCell>
                      <TableCell className="text-xs">{row.data.departmentName || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.data.currentHourMeter ?? 0} Jam
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
