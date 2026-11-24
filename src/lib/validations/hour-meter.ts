import { z } from "zod";

export const hourMeterLogSchema = z.object({
  equipmentId: z.string().min(1, "Unit wajib dipilih"),
  readingDate: z.string().min(1, "Tanggal pembacaan wajib diisi"),
  hourMeter: z.coerce
    .number({ invalid_type_error: "Hour meter harus berupa angka" })
    .int("Hour meter harus berupa bilangan bulat")
    .min(0, "Hour meter tidak boleh negatif"),
  source: z.string().default("MANUAL"),
  remark: z.string().optional().or(z.literal("")),
});

export type HourMeterLogInput = z.infer<typeof hourMeterLogSchema>;
