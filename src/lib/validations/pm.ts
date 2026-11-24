import { z } from "zod";
import { EquipmentCategory, PmBasis } from "@prisma/client";

export const pmChecklistTemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Nama template minimal 2 karakter"),
  category: z.nativeEnum(EquipmentCategory, {
    errorMap: () => ({ message: "Pilih kategori unit yang valid" }),
  }),
  pmTypeId: z.string().min(1, "Pilih tipe PM"),
  isActive: z.boolean().default(true),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(2, "Label item checklist minimal 2 karakter"),
        sortOrder: z.number().optional().default(0),
      })
    )
    .min(1, "Minimal harus ada 1 item checklist"),
});

export type PmChecklistTemplateInput = z.infer<typeof pmChecklistTemplateSchema>;

export const pmPlanSchema = z
  .object({
    id: z.string().optional(),
    equipmentId: z.string().min(1, "Pilih unit equipment"),
    pmTypeId: z.string().min(1, "Pilih tipe PM"),
    basis: z.nativeEnum(PmBasis, {
      errorMap: () => ({ message: "Pilih basis interval (Hour Meter atau Kalender)" }),
    }),
    intervalHour: z.coerce.number().optional().nullable(),
    intervalDays: z.coerce.number().optional().nullable(),
    lastDoneHour: z.coerce.number().optional().nullable(),
    lastDoneDate: z.coerce.date().optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.basis === PmBasis.HOUR_METER) {
        return typeof data.intervalHour === "number" && data.intervalHour > 0;
      }
      return true;
    },
    {
      message: "Interval jam operasi (Hour Meter) wajib diisi lebih dari 0",
      path: ["intervalHour"],
    }
  )
  .refine(
    (data) => {
      if (data.basis === PmBasis.CALENDAR) {
        return typeof data.intervalDays === "number" && data.intervalDays > 0;
      }
      return true;
    },
    {
      message: "Interval hari kalender wajib diisi lebih dari 0",
      path: ["intervalDays"],
    }
  );

export type PmPlanInput = z.infer<typeof pmPlanSchema>;

export const executePmSchema = z.object({
  pmPlanId: z.string().min(1, "ID Jadwal PM wajib ada"),
  technicianId: z.string().optional().nullable(),
  hourMeter: z.coerce
    .number({ invalid_type_error: "Hour meter harus berupa angka" })
    .min(0, "Hour meter tidak boleh negatif"),
  executedAt: z.coerce.date().optional(),
  results: z
    .array(
      z.object({
        itemId: z.string(),
        label: z.string(),
        checked: z.boolean(),
        note: z.string().optional().nullable(),
      })
    )
    .min(1, "Hasil checklist minimal 1 item"),
  generalNote: z.string().optional().nullable(),
});

export type ExecutePmInput = z.infer<typeof executePmSchema>;
