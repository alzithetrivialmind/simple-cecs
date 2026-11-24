"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  toggleUserStatusSchema,
  deleteUserSchema,
  CreateUserInput,
  UpdateUserInput,
  ResetPasswordInput,
} from "@/lib/validations/user";
import { createAuditLog } from "@/lib/audit";
import { uploadBuffer } from "@/lib/storage";
import { validateUpload } from "@/lib/upload-guard";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Prisma, Role } from "@prisma/client";

export interface GetUsersParams {
  search?: string;
  role?: Role;
  page?: number;
  limit?: number;
}

export async function getUsers(params?: GetUsersParams) {
  await requireRole(["ADMIN"]);

  const page = Math.max(1, params?.page ?? 1);
  const limit = Math.max(1, Math.min(100, params?.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
  };

  if (params?.role) {
    where.role = params.role;
  }

  if (params?.search?.trim()) {
    const s = params.search.trim();
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { nik: { contains: s, mode: "insensitive" } },
      { email: { contains: s, mode: "insensitive" } },
    ];
  }

  const [total, users, departments] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        nik: true,
        email: true,
        role: true,
        departmentId: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
    }),
    db.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    users,
    departments,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createUser(data: CreateUserInput) {
  const admin = await requireRole(["ADMIN"]);

  const validation = createUserSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { name, nik, email, password, role, departmentId, isActive, avatarUrl } =
    validation.data;

  // Check NIK duplication
  const existingNik = await db.user.findFirst({
    where: {
      nik: { equals: nik, mode: "insensitive" },
      deletedAt: null,
    },
  });

  if (existingNik) {
    return {
      success: false,
      error: `NIK "${nik}" sudah digunakan oleh karyawan lain.`,
    };
  }

  // Check Email duplication if provided
  if (email) {
    const existingEmail = await db.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        deletedAt: null,
      },
    });

    if (existingEmail) {
      return {
        success: false,
        error: `Email "${email}" sudah digunakan.`,
      };
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = await db.user.create({
    data: {
      name,
      nik,
      email: email || null,
      passwordHash,
      role,
      departmentId: departmentId || null,
      isActive,
      avatarUrl: avatarUrl || null,
    },
  });

  await createAuditLog({
    userId: admin.id,
    action: "CREATE",
    entity: "User",
    entityId: newUser.id,
    newValue: JSON.stringify({ name, nik, role, isActive }),
  });

  revalidatePath("/admin/users");
  return { success: true, user: newUser };
}

export async function updateUser(data: UpdateUserInput) {
  const admin = await requireRole(["ADMIN"]);

  const validation = updateUserSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { id, name, nik, email, role, departmentId, isActive, avatarUrl } =
    validation.data;

  const existing = await db.user.findUnique({
    where: { id },
  });

  if (!existing || existing.deletedAt) {
    return { success: false, error: "Pengguna tidak ditemukan." };
  }

  // Check NIK duplication with other users
  const duplicateNik = await db.user.findFirst({
    where: {
      id: { not: id },
      nik: { equals: nik, mode: "insensitive" },
      deletedAt: null,
    },
  });

  if (duplicateNik) {
    return {
      success: false,
      error: `NIK "${nik}" sudah digunakan oleh pengguna lain.`,
    };
  }

  // Check Email duplication if provided
  if (email) {
    const duplicateEmail = await db.user.findFirst({
      where: {
        id: { not: id },
        email: { equals: email, mode: "insensitive" },
        deletedAt: null,
      },
    });

    if (duplicateEmail) {
      return {
        success: false,
        error: `Email "${email}" sudah digunakan oleh pengguna lain.`,
      };
    }
  }

  const updatedUser = await db.user.update({
    where: { id },
    data: {
      name,
      nik,
      email: email || null,
      role,
      departmentId: departmentId || null,
      isActive,
      avatarUrl: avatarUrl || existing.avatarUrl,
    },
  });

  await createAuditLog({
    userId: admin.id,
    action: "UPDATE",
    entity: "User",
    entityId: updatedUser.id,
    oldValue: JSON.stringify({
      name: existing.name,
      nik: existing.nik,
      role: existing.role,
      isActive: existing.isActive,
    }),
    newValue: JSON.stringify({ name, nik, role, isActive }),
  });

  revalidatePath("/admin/users");
  return { success: true, user: updatedUser };
}

export async function resetUserPassword(data: ResetPasswordInput) {
  const admin = await requireRole(["ADMIN"]);

  const validation = resetPasswordSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { userId, newPassword } = validation.data;

  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.deletedAt) {
    return { success: false, error: "Pengguna tidak ditemukan." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await db.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  await createAuditLog({
    userId: admin.id,
    action: "UPDATE",
    entity: "User",
    entityId: userId,
    field: "passwordHash",
    newValue: "Password reset by admin",
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function toggleUserStatus(data: {
  userId: string;
  isActive: boolean;
}) {
  const admin = await requireRole(["ADMIN"]);

  const validation = toggleUserStatusSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: "Input tidak valid" };
  }

  const { userId, isActive } = validation.data;

  // Prevent admin from disabling their own account
  if (userId === admin.id && !isActive) {
    return {
      success: false,
      error: "Anda tidak dapat menonaktifkan akun sendiri.",
    };
  }

  const user = await db.user.update({
    where: { id: userId },
    data: { isActive },
  });

  await createAuditLog({
    userId: admin.id,
    action: "UPDATE",
    entity: "User",
    entityId: userId,
    field: "isActive",
    oldValue: String(!isActive),
    newValue: String(isActive),
  });

  revalidatePath("/admin/users");
  return { success: true, user };
}

export async function deleteUser(data: { userId: string }) {
  const admin = await requireRole(["ADMIN"]);

  const validation = deleteUserSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: "Input tidak valid" };
  }

  const { userId } = validation.data;

  // Prevent admin from deleting themselves
  if (userId === admin.id) {
    return {
      success: false,
      error: "Anda tidak dapat menghapus akun sendiri.",
    };
  }

  // Soft delete per CECS rule
  const user = await db.user.update({
    where: { id: userId },
    data: {
      deletedAt: new Date(),
      isActive: false,
    },
  });

  await createAuditLog({
    userId: admin.id,
    action: "DELETE",
    entity: "User",
    entityId: userId,
    oldValue: JSON.stringify({ name: user.name, nik: user.nik }),
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function uploadUserPhoto(formData: FormData) {
  const admin = await requireRole(["ADMIN", "SUPERVISOR"]);

  const file = formData.get("file") as File | null;
  const userId = formData.get("userId") as string | null;

  if (!file) {
    return { success: false, error: "Berkas foto tidak ditemukan." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Extension and MIME come from the server allowlist, not from the
  // client-supplied file name / Content-Type
  const validated = validateUpload(file.type, buffer);
  if (!validated.ok) {
    return { success: false, error: validated.error };
  }

  const fileKey = `users/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${validated.ext}`;

  await uploadBuffer(fileKey, buffer, validated.mime);

  if (userId) {
    await db.user.update({
      where: { id: userId },
      data: { avatarUrl: `/api/files/${fileKey}` },
    });

    await createAuditLog({
      userId: admin.id,
      action: "UPDATE",
      entity: "User",
      entityId: userId,
      field: "avatarUrl",
      newValue: `/api/files/${fileKey}`,
    });
  }

  revalidatePath("/admin/users");
  return { success: true, fileKey, url: `/api/files/${fileKey}` };
}

/**
 * Force-logout a user by invalidating all their JWT tokens.
 * The user's session cookie is cleared within ~1 minute, at the next token
 * revalidation in the `jwt` callback (see REVALIDATION_INTERVAL_S in auth.ts).
 */
export async function forceLogoutUser(data: { userId: string }) {
  const admin = await requireRole(["ADMIN"]);

  const { userId } = data;

  if (!userId) {
    return { success: false, error: "User ID diperlukan." };
  }

  // Prevent admin from force-logging-out themselves
  if (userId === admin.id) {
    return {
      success: false,
      error: "Anda tidak dapat memaksa logout akun sendiri.",
    };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, nik: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    return { success: false, error: "Pengguna tidak ditemukan." };
  }

  await db.user.update({
    where: { id: userId },
    data: { tokenInvalidBefore: new Date() },
  });

  await createAuditLog({
    userId: admin.id,
    action: "FORCE_LOGOUT",
    entity: "User",
    entityId: userId,
    details: `Admin memaksa logout pengguna ${user.name} (${user.nik})`,
  });

  revalidatePath("/admin/users");
  return { success: true };
}
