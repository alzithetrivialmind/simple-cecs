"use server";

import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { INPUT_ROLES } from "@/lib/roles";
import { createAuditLog } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { validatePasswordStrength } from "@/lib/validations/password";
import { revalidatePath } from "next/cache";

/**
 * Update current user profile photo (avatar)
 */
export async function updateProfilePhoto(avatarUrl: string) {
  const user = await requireAuth();

  const existing = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, nik: true, avatarUrl: true },
  });

  if (!existing) {
    return { success: false, error: "Pengguna tidak ditemukan." };
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { avatarUrl },
  });

  // Audit Log
  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entity: "User",
    entityId: user.id,
    field: "avatarUrl",
    oldValue: existing.avatarUrl || "(Belum ada foto)",
    newValue: avatarUrl,
    reason: "Pembaruan foto profil karyawan",
    details: `Pengguna ${user.name} (${user.nik}) memperbarui foto profil akun`,
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true, avatarUrl: updated.avatarUrl };
}

/**
 * Change current user password
 */
export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const user = await requireAuth();

  if (!data.currentPassword || !data.newPassword || !data.confirmPassword) {
    return { success: false, error: "Semua kolom password wajib diisi." };
  }

  // Kebijakan kata sandi terpusat, sama dengan yang dipakai admin saat
  // membuat user atau melakukan reset.
  const strengthError = validatePasswordStrength(data.newPassword);
  if (strengthError) {
    return { success: false, error: strengthError };
  }

  if (data.newPassword !== data.confirmPassword) {
    return { success: false, error: "Konfirmasi password baru tidak cocok." };
  }

  if (data.newPassword === data.currentPassword) {
    return {
      success: false,
      error: "Password baru harus berbeda dari password saat ini.",
    };
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, passwordHash: true, name: true, nik: true },
  });

  if (!dbUser) {
    return { success: false, error: "Pengguna tidak ditemukan." };
  }

  // Verify old password
  const isValid = await bcrypt.compare(data.currentPassword, dbUser.passwordHash);
  if (!isValid) {
    return { success: false, error: "Password saat ini salah." };
  }

  // Hash new password
  const newHash = await bcrypt.hash(data.newPassword, 10);

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  // Audit Log (Never log actual passwords!)
  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entity: "User",
    entityId: user.id,
    field: "passwordHash",
    oldValue: "********",
    newValue: "********",
    reason: "Pergantian password akun mandiri oleh pengguna",
    details: `Pengguna ${user.name} (${user.nik}) berhasil memperbarui kata sandi akun`,
  });

  return { success: true, message: "Password berhasil diperbarui." };
}

/**
 * Update equipment photo (can be called from Equipment Detail)
 */
export async function updateEquipmentPhoto(equipmentId: string, photoUrl: string) {
  const user = await requireRole(INPUT_ROLES);

  const existing = await db.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, code: true, name: true, photoUrl: true },
  });

  if (!existing) {
    return { success: false, error: "Unit equipment tidak ditemukan." };
  }

  const updated = await db.equipment.update({
    where: { id: equipmentId },
    data: { photoUrl },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entity: "Equipment",
    entityId: equipmentId,
    field: "photoUrl",
    oldValue: existing.photoUrl || "(Belum ada foto)",
    newValue: photoUrl,
    reason: "Pembaruan foto unit alat berat / teknik",
    details: `Foto dokumentasi unit ${existing.code} (${existing.name}) diperbarui oleh ${user.name}`,
  });

  revalidatePath(`/equipment/${equipmentId}`);
  revalidatePath("/equipment");
  return { success: true, photoUrl: updated.photoUrl };
}
