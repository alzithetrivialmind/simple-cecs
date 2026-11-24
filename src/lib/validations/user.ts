import { z } from "zod";
import { Role } from "@prisma/client";
import { passwordSchema } from "./password";

export const createUserSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").trim(),
  nik: z
    .string()
    .min(3, "NIK minimal 3 karakter")
    .max(20, "NIK maksimal 20 karakter")
    .trim()
    .toUpperCase(),
  email: z
    .string()
    .email("Format email tidak valid")
    .optional()
    .or(z.literal("")),
  password: passwordSchema,
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: "Role tidak valid" }),
  }),
  departmentId: z.string().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  avatarUrl: z.string().optional().or(z.literal("")),
});

export const updateUserSchema = z.object({
  id: z.string().min(1, "ID user wajib ada"),
  name: z.string().min(2, "Nama minimal 2 karakter").trim(),
  nik: z
    .string()
    .min(3, "NIK minimal 3 karakter")
    .max(20, "NIK maksimal 20 karakter")
    .trim()
    .toUpperCase(),
  email: z
    .string()
    .email("Format email tidak valid")
    .optional()
    .or(z.literal("")),
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: "Role tidak valid" }),
  }),
  departmentId: z.string().optional().or(z.literal("")),
  isActive: z.boolean(),
  avatarUrl: z.string().optional().or(z.literal("")),
});

export const resetPasswordSchema = z.object({
  userId: z.string().min(1, "ID user wajib ada"),
  newPassword: passwordSchema,
});

export const toggleUserStatusSchema = z.object({
  userId: z.string().min(1, "ID user wajib ada"),
  isActive: z.boolean(),
});

export const deleteUserSchema = z.object({
  userId: z.string().min(1, "ID user wajib ada"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
