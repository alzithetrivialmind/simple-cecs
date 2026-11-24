/**
 * Helpers for the equipment Excel import. Pure functions so they can be
 * unit tested without a browser.
 *
 * Columns are matched by header name, not by position, so both the
 * import template (/api/export/equipment-template) and the full export
 * (/api/export/equipment) can be re-imported.
 */

export type ImportField =
  | "code"
  | "name"
  | "category"
  | "ownership"
  | "assetNumber"
  | "supplier"
  | "manufacturer"
  | "model"
  | "serialNumber"
  | "yearOfManufacture"
  | "currentHourMeter"
  | "locationName"
  | "departmentName"
  | "engineModel"
  | "capacity"
  | "fuelType"
  | "engineSerialNumber"
  | "transmission"
  | "engineOilCapacity"
  | "transmissionOilCapacity"
  | "hydraulicOilCapacity"
  | "fuelTankCapacity"
  | "engineManufacturer"
  | "enginePower"
  | "maxTorque"
  | "cylinderCount"
  | "engineDisplacement"
  | "hydraulicSystem"
  | "maxTravelSpeed"
  | "gradeability"
  | "turningRadius"
  | "dimensions"
  | "notes";

/** Header labels as written by the template and the export, per field. */
const HEADER_ALIASES: Record<ImportField, string[]> = {
  code: ["Kode Unit"],
  name: ["Nama Unit"],
  category: ["Kategori"],
  ownership: ["Kepemilikan"],
  assetNumber: ["No. Aset"],
  supplier: ["Supplier"],
  manufacturer: ["Merk / Pabrikan"],
  model: ["Model / Tipe"],
  serialNumber: ["Nomor Seri (S/N)"],
  yearOfManufacture: ["Tahun Pembuatan"],
  currentHourMeter: ["Hour Meter Awal", "Hour Meter (Jam)", "Hour Meter"],
  locationName: ["Lokasi"],
  departmentName: ["Departemen"],
  engineModel: ["Model Mesin"],
  capacity: ["Kapasitas"],
  fuelType: ["Bahan Bakar"],
  engineSerialNumber: ["No. Seri Mesin"],
  transmission: ["Transmisi"],
  engineOilCapacity: ["Kap. Oli Mesin (L)"],
  transmissionOilCapacity: ["Kap. Oli Transmisi (L)"],
  hydraulicOilCapacity: ["Kap. Oli Hidrolik (L)"],
  fuelTankCapacity: ["Kap. Tangki BBM (L)"],
  engineManufacturer: ["Pabrikan Mesin"],
  enginePower: ["Daya Mesin"],
  maxTorque: ["Torsi Maks"],
  cylinderCount: ["Jumlah Silinder"],
  engineDisplacement: ["Volume Silinder"],
  hydraulicSystem: ["Sistem Hidrolik"],
  maxTravelSpeed: ["Kecepatan Maks"],
  gradeability: ["Kemampuan Menanjak"],
  turningRadius: ["Radius Putar Min"],
  dimensions: ["Dimensi (PxLxT)"],
  notes: ["Catatan"],
};

/** Indonesian label per field, used in validation messages. */
export const IMPORT_FIELD_LABELS: Record<ImportField, string> = Object.fromEntries(
  Object.entries(HEADER_ALIASES).map(([field, aliases]) => [field, aliases[0]])
) as Record<ImportField, string>;

function normalizeHeader(header: string): string {
  return header
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const ALIAS_LOOKUP = new Map<string, ImportField>(
  (Object.entries(HEADER_ALIASES) as [ImportField, string[]][]).flatMap(([field, aliases]) =>
    aliases.map((alias) => [normalizeHeader(alias), field] as const)
  )
);

/**
 * Map header cell texts (index 0 = column 1) to fields.
 * Returns field -> 1-based column number. Unknown headers (e.g. "Status",
 * which is never imported) are ignored.
 */
export function mapImportHeaders(headers: string[]): Partial<Record<ImportField, number>> {
  const columns: Partial<Record<ImportField, number>> = {};
  headers.forEach((header, index) => {
    const field = ALIAS_LOOKUP.get(normalizeHeader(header));
    if (field && columns[field] === undefined) {
      columns[field] = index + 1;
    }
  });
  return columns;
}

/**
 * Parse a number typed in Excel by hand.
 * Accepts "12.5", "12,5", "20 (Liter)", "1.250" (thousand separator),
 * "1.250,5". Returns null for an empty cell and NaN when no number is found,
 * so validation can report it instead of silently dropping the value.
 */
export function parseExcelNumber(raw: string | null | undefined): number | null {
  const text = (raw ?? "").trim();
  if (text === "") return null;

  const match = text.match(/-?\d[\d.,]*/);
  if (!match) return Number.NaN;
  let num = match[0].replace(/[.,]$/, "");

  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(num)) {
    // Indonesian format: dot = thousands, comma = decimal
    num = num.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(num)) {
    // English format: comma = thousands
    num = num.replace(/,/g, "");
  } else {
    num = num.replace(",", ".");
  }

  return Number(num);
}
