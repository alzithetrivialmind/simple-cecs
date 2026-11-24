import { z } from "zod";
import { WorkOrderStatus, WorkOrderType } from "@prisma/client";

export const createWorkOrderSchema = z.object({
  equipmentId: z.string().min(1, "Pilih unit equipment"),
  type: z.nativeEnum(WorkOrderType, {
    errorMap: () => ({ message: "Pilih tipe work order yang valid" }),
  }),
  assignedToId: z.string().optional().nullable(),
  externalServiceBy: z.string().max(150, "Nama servis eksternal maksimal 150 karakter").optional().nullable(),
  problem: z.string().min(3, "Deskripsi masalah / pekerjaan minimal 3 karakter"),
});

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;

export const assignWorkOrderSchema = z.object({
  workOrderId: z.string().min(1, "ID Work Order wajib ada"),
  assignedToId: z.string().optional().nullable(),
  externalServiceBy: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export type AssignWorkOrderInput = z.infer<typeof assignWorkOrderSchema>;

export const updateWorkOrderStatusSchema = z.object({
  workOrderId: z.string().min(1, "ID Work Order wajib ada"),
  toStatus: z.nativeEnum(WorkOrderStatus, {
    errorMap: () => ({ message: "Status target tidak valid" }),
  }),
  note: z.string().optional().nullable(),
});

export type UpdateWorkOrderStatusInput = z.infer<typeof updateWorkOrderStatusSchema>;

export const updateDiagnosisSchema = z.object({
  workOrderId: z.string().min(1, "ID Work Order wajib ada"),
  finding: z.string().min(3, "Temuan teknis minimal 3 karakter"),
  rootCause: z.string().min(3, "Penyebab utama (root cause) minimal 3 karakter"),
  recommendation: z.string().optional().nullable(),
  checklist: z.any().optional().nullable(),
});

export type UpdateDiagnosisInput = z.infer<typeof updateDiagnosisSchema>;

export const updateRepairResultSchema = z.object({
  workOrderId: z.string().min(1, "ID Work Order wajib ada"),
  correctiveAction: z.string().min(3, "Tindakan perbaikan wajib diisi minimal 3 karakter"),
  remark: z.string().optional().nullable(),
});

export type UpdateRepairResultInput = z.infer<typeof updateRepairResultSchema>;

export const closeWorkOrderSchema = z.object({
  workOrderId: z.string().min(1, "ID Work Order wajib ada"),
  correctiveAction: z.string().min(3, "Tindakan perbaikan wajib diisi minimal 3 karakter").optional().nullable(),
  remark: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export type CloseWorkOrderInput = z.infer<typeof closeWorkOrderSchema>;
