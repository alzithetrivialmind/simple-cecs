import { test } from "node:test";
import assert from "node:assert/strict";
import { mapImportHeaders, parseExcelNumber } from "./excel-import";

test("parseExcelNumber: angka biasa dan desimal koma/titik", () => {
  assert.equal(parseExcelNumber("12.5"), 12.5);
  assert.equal(parseExcelNumber("15,5"), 15.5);
  assert.equal(parseExcelNumber("5000"), 5000);
});

test("parseExcelNumber: angka dengan satuan", () => {
  assert.equal(parseExcelNumber("20 (Liter)"), 20);
  assert.equal(parseExcelNumber("30.5 (Liter)"), 30.5);
  assert.equal(parseExcelNumber("100 L"), 100);
});

test("parseExcelNumber: pemisah ribuan", () => {
  assert.equal(parseExcelNumber("1.250"), 1250);
  assert.equal(parseExcelNumber("1.250,5"), 1250.5);
  assert.equal(parseExcelNumber("1,250.5"), 1250.5);
});

test("parseExcelNumber: kosong jadi null, teks tanpa angka jadi NaN", () => {
  assert.equal(parseExcelNumber(""), null);
  assert.equal(parseExcelNumber("  "), null);
  assert.equal(parseExcelNumber(undefined), null);
  assert.ok(Number.isNaN(parseExcelNumber("OWNED")));
});

test("mapImportHeaders: format template", () => {
  const cols = mapImportHeaders([
    "Kode Unit *", "Nama Unit *", "Kategori *", "Kepemilikan", "Hour Meter Awal", "Lokasi",
  ]);
  assert.equal(cols.code, 1);
  assert.equal(cols.name, 2);
  assert.equal(cols.currentHourMeter, 5);
  assert.equal(cols.locationName, 6);
});

test("mapImportHeaders: format export, kolom Status diabaikan", () => {
  const cols = mapImportHeaders([
    "Kode Unit", "Nama Unit", "Kategori", "Status", "Kepemilikan", "No. Aset", "Supplier",
    "Merk / Pabrikan", "Model / Tipe", "Nomor Seri (S/N)", "Tahun Pembuatan", "Hour Meter (Jam)",
    "Lokasi", "Departemen",
  ]);
  assert.equal(cols.ownership, 5);
  assert.equal(cols.assetNumber, 6);
  assert.equal(cols.yearOfManufacture, 11);
  assert.equal(cols.currentHourMeter, 12);
  assert.equal(cols.locationName, 13);
  assert.equal(cols.departmentName, 14);
  assert.equal(Object.values(cols).includes(4), false);
});
