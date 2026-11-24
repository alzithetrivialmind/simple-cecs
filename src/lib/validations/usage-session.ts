import { z } from "zod";

export const startUsageSessionSchema = z.object({
  equipmentId: z.string().min(1, "ID unit equipment wajib ada"),
  startPhotoUrl: z.string().min(1, "Foto meteran dashboard saat mulai kerja wajib diambil"),
  startHourMeter: z.coerce.number().int("Hour meter harus bilangan bulat").nonnegative("Hour meter tidak boleh negatif").optional(),
  remarks: z.string().max(500, "Catatan maksimal 500 karakter").optional(),
});

export const finishUsageSessionSchema = z.object({
  sessionId: z.string().min(1, "ID sesi pemakaian wajib ada"),
  endPhotoUrl: z.string().min(1, "Foto meteran dashboard saat selesai kerja wajib diambil"),
  finalHourMeter: z.coerce.number().int("Hour meter harus bilangan bulat").nonnegative("Hour meter tidak boleh negatif").optional(),
  remarks: z.string().max(500, "Catatan maksimal 500 karakter").optional(),
});

export type StartUsageSessionInput = z.infer<typeof startUsageSessionSchema>;
export type FinishUsageSessionInput = z.infer<typeof finishUsageSessionSchema>;
