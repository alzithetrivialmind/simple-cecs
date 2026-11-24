import { z } from "zod";
import { Priority } from "@prisma/client";

export const breakdownRequestSchema = z.object({
  equipmentId: z.string().min(1, "Pilih unit equipment yang bermasalah"),
  problem: z
    .string()
    .min(5, "Deskripsi kerusakan minimal 5 karakter")
    .max(1000, "Deskripsi kerusakan maksimal 1000 karakter"),
  priority: z.nativeEnum(Priority, {
    errorMap: () => ({ message: "Pilih tingkat prioritas yang valid" }),
  }),
  hourMeter: z.coerce
    .number({ invalid_type_error: "Hour meter harus berupa angka" })
    .min(0, "Hour meter tidak boleh negatif")
    .optional(),
  reportedAt: z.coerce.date().optional(),
  photoKey: z.string().optional().nullable(),
  photoName: z.string().optional().nullable(),
  photoSize: z.number().optional().nullable(),
  photoMime: z.string().optional().nullable(),
});

export type BreakdownRequestInput = z.infer<typeof breakdownRequestSchema>;
