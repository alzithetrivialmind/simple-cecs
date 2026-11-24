import { z } from "zod";
import { InspectionResult } from "@prisma/client";

export const inspectionSchema = z
  .object({
    id: z.string().optional(),
    equipmentId: z.string().min(1, "Pilih unit equipment yang diinspeksi"),
    inspectionTypeId: z.string().min(1, "Pilih jenis inspeksi"),
    inspectorId: z.string().min(1, "Pilih nama inspektur / auditor"),
    inspectionDate: z.coerce.date({
      required_error: "Tanggal pelaksanaan inspeksi wajib diisi",
    }),
    hourMeter: z.coerce
      .number({ invalid_type_error: "Hour meter harus berupa angka" })
      .min(0, "Hour meter tidak boleh negatif"),
    result: z.nativeEnum(InspectionResult, {
      errorMap: () => ({ message: "Pilih hasil inspeksi yang valid" }),
    }),
    finding: z.string().optional().nullable(),
    recommendation: z.string().optional().nullable(),
    certificateNumber: z.string().optional().nullable(),
    validUntil: z.coerce.date().optional().nullable(),
    attachmentKey: z.string().optional().nullable(),
    attachmentName: z.string().optional().nullable(),
    attachmentSize: z.number().optional().nullable(),
    attachmentMime: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.result === InspectionResult.FAIL) {
        return !!data.finding && data.finding.trim().length >= 5;
      }
      return true;
    },
    {
      message:
        "Uraian temuan kerusakan (finding) wajib diisi minimal 5 karakter jika hasil inspeksi FAIL",
      path: ["finding"],
    }
  );

export type InspectionInput = z.infer<typeof inspectionSchema>;
