import { z } from "zod";

export const departmentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Nama departemen minimal 2 karakter").trim(),
});

export const locationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Nama lokasi minimal 2 karakter").trim(),
});

export const pmTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Nama tipe PM minimal 2 karakter").trim(),
});

export const inspectionTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Nama jenis inspeksi minimal 2 karakter").trim(),
});

export const deleteMasterSchema = z.object({
  id: z.string().min(1, "ID wajib ada"),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;
export type LocationInput = z.infer<typeof locationSchema>;
export type PmTypeInput = z.infer<typeof pmTypeSchema>;
export type InspectionTypeInput = z.infer<typeof inspectionTypeSchema>;
