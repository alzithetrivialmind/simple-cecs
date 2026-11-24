import { z } from "zod";
import { EquipmentCategory, Ownership } from "@prisma/client";

// Accepts "28,5" / "28.5" / 28.5; empty input becomes null
const litersField = z.preprocess(
  (v) => {
    if (v === undefined || v === null) return null;
    if (typeof v === "string") {
      const cleaned = v.trim().replace(",", ".");
      return cleaned === "" ? null : Number(cleaned);
    }
    return v;
  },
  z
    .number({ invalid_type_error: "Kapasitas harus berupa angka (liter)" })
    .min(0, "Kapasitas tidak boleh negatif")
    .max(100000, "Kapasitas terlalu besar")
    .nullable()
);

const optionalText = z.string().trim().max(200).optional().or(z.literal(""));

export const equipmentSpecFields = {
  supplier: optionalText,
  engineManufacturer: optionalText,
  enginePower: optionalText,
  maxTorque: optionalText,
  cylinderCount: optionalText,
  engineDisplacement: optionalText,
  hydraulicSystem: optionalText,
  maxTravelSpeed: optionalText,
  gradeability: optionalText,
  turningRadius: optionalText,
  dimensions: optionalText,
  engineOilCapacity: litersField.optional(),
  transmissionOilCapacity: litersField.optional(),
  hydraulicOilCapacity: litersField.optional(),
  fuelTankCapacity: litersField.optional(),
  notes: z.string().max(10000, "Catatan maksimal 10.000 karakter").optional().or(z.literal("")),
};

export const equipmentSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .or(z.literal("")),
  name: z.string().min(2, "Nama unit minimal 2 karakter").trim(),
  category: z.nativeEnum(EquipmentCategory, {
    errorMap: () => ({ message: "Kategori unit tidak valid" }),
  }),
  ownership: z.nativeEnum(Ownership).default(Ownership.OWNED),
  assetNumber: z.string().optional().or(z.literal("")),
  manufacturer: z.string().optional().or(z.literal("")),
  model: z.string().optional().or(z.literal("")),
  serialNumber: z.string().optional().or(z.literal("")),
  yearOfManufacture: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  inServiceDate: z.string().optional().nullable(),

  engineModel: z.string().optional().or(z.literal("")),
  engineSerialNumber: z.string().optional().or(z.literal("")),
  transmission: z.string().optional().or(z.literal("")),
  capacity: z.string().optional().or(z.literal("")),
  operatingWeight: z.string().optional().or(z.literal("")),
  fuelType: z.string().optional().or(z.literal("")),
  ...equipmentSpecFields,

  locationId: z.string().optional().or(z.literal("")),
  departmentId: z.string().optional().or(z.literal("")),
  currentHourMeter: z.coerce.number().int().min(0).default(0),
  photoUrl: z.string().optional().or(z.literal("")),
});

export const updateEquipmentSchema = equipmentSchema.extend({
  id: z.string().min(1, "ID unit wajib ada"),
});

export const importEquipmentRowSchema = z.object({
  code: z.string().min(1, "Kode unit wajib diisi").trim().toUpperCase(),
  name: z.string().min(2, "Nama unit minimal 2 karakter").trim(),
  category: z.string().trim().toUpperCase(),
  ownership: z.string().trim().toUpperCase().default("OWNED"),
  assetNumber: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  yearOfManufacture: z.coerce
    .number({ invalid_type_error: "Tahun harus berupa angka" })
    .int("Tahun harus bilangan bulat")
    .min(1950, "Tahun minimal 1950")
    .max(2100, "Tahun tidak valid")
    .optional()
    .nullable(),
  locationName: z.string().optional().nullable(),
  departmentName: z.string().optional().nullable(),
  currentHourMeter: z.coerce
    .number({ invalid_type_error: "Hour meter harus berupa angka" })
    .int("Hour meter harus bilangan bulat")
    .min(0, "Hour meter tidak boleh negatif")
    .default(0),
  engineModel: z.string().optional().nullable(),
  capacity: z.string().optional().nullable(),
  fuelType: z.string().optional().nullable(),
  engineManufacturer: z.string().optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  engineSerialNumber: z.string().optional().nullable(),
  transmission: z.string().optional().nullable(),
  enginePower: z.string().max(200).optional().nullable(),
  maxTorque: z.string().max(200).optional().nullable(),
  cylinderCount: z.string().max(200).optional().nullable(),
  engineDisplacement: z.string().max(200).optional().nullable(),
  hydraulicSystem: z.string().max(200).optional().nullable(),
  maxTravelSpeed: z.string().max(200).optional().nullable(),
  gradeability: z.string().max(200).optional().nullable(),
  turningRadius: z.string().max(200).optional().nullable(),
  dimensions: z.string().max(200).optional().nullable(),
  engineOilCapacity: litersField.optional(),
  transmissionOilCapacity: litersField.optional(),
  hydraulicOilCapacity: litersField.optional(),
  fuelTankCapacity: litersField.optional(),
  notes: z.string().max(10000).optional().nullable(),
});

export type EquipmentInput = z.infer<typeof equipmentSchema>;
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>;
export type ImportEquipmentRow = z.infer<typeof importEquipmentRowSchema>;
