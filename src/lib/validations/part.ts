import { z } from "zod";
import { EquipmentCategory, PartSystem } from "@prisma/client";

export const partSchema = z.object({
  id: z.string().optional(),
  partNumber: z
    .string()
    .min(2, "Nomor Part (Part Number) minimal 2 karakter")
    .max(100, "Nomor Part maksimal 100 karakter")
    .trim(),
  description: z
    .string()
    .min(3, "Deskripsi/nama spare part minimal 3 karakter")
    .max(255, "Deskripsi maksimal 255 karakter")
    .trim(),
  manufacturer: z.string().max(100).optional().nullable(),
  altPartNumber: z.string().max(100).optional().nullable(),
  system: z.nativeEnum(PartSystem, {
    errorMap: () => ({ message: "Pilih sistem komponen yang valid" }),
  }),
  unit: z.string().min(1, "Satuan wajib diisi").default("PCS"),
  compatibleCategories: z.array(z.nativeEnum(EquipmentCategory)).optional().default([]),
  compatibleEquipmentIds: z.array(z.string()).optional().default([]),
});

export type PartInput = z.infer<typeof partSchema>;

export const recordPartUsageSchema = z.object({
  workOrderId: z.string().min(1, "Work Order wajib dipilih"),
  partId: z.string().min(1, "Spare Part wajib dipilih"),
  qty: z.coerce.number().int().min(1, "Jumlah pemakaian minimal 1"),
});

export type RecordPartUsageInput = z.infer<typeof recordPartUsageSchema>;
