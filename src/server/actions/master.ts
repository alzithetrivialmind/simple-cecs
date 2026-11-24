"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import {
  departmentSchema,
  locationSchema,
  pmTypeSchema,
  inspectionTypeSchema,
  deleteMasterSchema,
  DepartmentInput,
  LocationInput,
  PmTypeInput,
  InspectionTypeInput,
} from "@/lib/validations/master";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function getMasterData() {
  await requireRole(["ADMIN"]);

  const [departments, locations, pmTypes, inspectionTypes] = await Promise.all([
    db.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { users: true, equipment: true },
        },
      },
    }),
    db.location.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { equipment: true },
        },
      },
    }),
    db.pmType.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { templates: true, plans: true },
        },
      },
    }),
    db.inspectionType.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { inspections: true },
        },
      },
    }),
  ]);

  return {
    departments,
    locations,
    pmTypes,
    inspectionTypes,
  };
}

// ============ DEPARTMENT ACTIONS ============

export async function upsertDepartment(data: DepartmentInput) {
  const admin = await requireRole(["ADMIN"]);

  const validation = departmentSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { id, name } = validation.data;

  try {
    if (id) {
      const updated = await db.department.update({
        where: { id },
        data: { name },
      });
      await createAuditLog({
        userId: admin.id,
        action: "UPDATE",
        entity: "Department",
        entityId: updated.id,
        newValue: name,
      });
    } else {
      const created = await db.department.create({
        data: { name },
      });
      await createAuditLog({
        userId: admin.id,
        action: "CREATE",
        entity: "Department",
        entityId: created.id,
        newValue: name,
      });
    }

    revalidatePath("/admin/master");
    return { success: true };
  } catch {
    return {
      success: false,
      error: `Departemen dengan nama "${name}" sudah ada.`,
    };
  }
}

export async function deleteDepartment(data: { id: string }) {
  const admin = await requireRole(["ADMIN"]);

  const validation = deleteMasterSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: "ID tidak valid" };
  }

  const { id } = validation.data;

  const count = await db.department.findUnique({
    where: { id },
    include: {
      _count: {
        select: { users: true, equipment: true },
      },
    },
  });

  if (!count || count.deletedAt) {
    return { success: false, error: "Departemen tidak ditemukan." };
  }

  if (count._count.users > 0 || count._count.equipment > 0) {
    return {
      success: false,
      error: "Tidak dapat menghapus departemen yang masih memiliki relasi data pengguna atau unit.",
    };
  }

  await db.department.update({
    where: { id },
    data: { deletedAt: new Date() }
  });

  await createAuditLog({
    userId: admin.id,
    action: "DELETE",
    entity: "Department",
    entityId: id,
    oldValue: count.name,
  });

  revalidatePath("/admin/master");
  return { success: true };
}

// ============ LOCATION ACTIONS ============

export async function upsertLocation(data: LocationInput) {
  const admin = await requireRole(["ADMIN"]);

  const validation = locationSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { id, name } = validation.data;

  try {
    if (id) {
      const updated = await db.location.update({
        where: { id },
        data: { name },
      });
      await createAuditLog({
        userId: admin.id,
        action: "UPDATE",
        entity: "Location",
        entityId: updated.id,
        newValue: name,
      });
    } else {
      const created = await db.location.create({
        data: { name },
      });
      await createAuditLog({
        userId: admin.id,
        action: "CREATE",
        entity: "Location",
        entityId: created.id,
        newValue: name,
      });
    }

    revalidatePath("/admin/master");
    return { success: true };
  } catch {
    return {
      success: false,
      error: `Lokasi dengan nama "${name}" sudah ada.`,
    };
  }
}

export async function deleteLocation(data: { id: string }) {
  const admin = await requireRole(["ADMIN"]);

  const validation = deleteMasterSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: "ID tidak valid" };
  }

  const { id } = validation.data;

  const count = await db.location.findUnique({
    where: { id },
    include: {
      _count: {
        select: { equipment: true },
      },
    },
  });

  if (!count || count.deletedAt) {
    return { success: false, error: "Lokasi tidak ditemukan." };
  }

  if (count._count.equipment > 0) {
    return {
      success: false,
      error: "Tidak dapat menghapus lokasi yang masih digunakan oleh unit equipment.",
    };
  }

  await db.location.update({
    where: { id },
    data: { deletedAt: new Date() }
  });

  await createAuditLog({
    userId: admin.id,
    action: "DELETE",
    entity: "Location",
    entityId: id,
    oldValue: count.name,
  });

  revalidatePath("/admin/master");
  return { success: true };
}

// ============ PM TYPE ACTIONS ============

export async function upsertPmType(data: PmTypeInput) {
  const admin = await requireRole(["ADMIN"]);

  const validation = pmTypeSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { id, name } = validation.data;

  try {
    if (id) {
      const updated = await db.pmType.update({
        where: { id },
        data: { name },
      });
      await createAuditLog({
        userId: admin.id,
        action: "UPDATE",
        entity: "PmType",
        entityId: updated.id,
        newValue: name,
      });
    } else {
      const created = await db.pmType.create({
        data: { name },
      });
      await createAuditLog({
        userId: admin.id,
        action: "CREATE",
        entity: "PmType",
        entityId: created.id,
        newValue: name,
      });
    }

    revalidatePath("/admin/master");
    return { success: true };
  } catch {
    return {
      success: false,
      error: `Tipe PM dengan nama "${name}" sudah ada.`,
    };
  }
}

export async function deletePmType(data: { id: string }) {
  const admin = await requireRole(["ADMIN"]);

  const validation = deleteMasterSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: "ID tidak valid" };
  }

  const { id } = validation.data;

  const count = await db.pmType.findUnique({
    where: { id },
    include: {
      _count: {
        select: { templates: true, plans: true },
      },
    },
  });

  if (!count || count.deletedAt) {
    return { success: false, error: "Tipe PM tidak ditemukan." };
  }

  if (count._count.templates > 0 || count._count.plans > 0) {
    return {
      success: false,
      error: "Tidak dapat menghapus tipe PM yang sudah memiliki checklist template atau rencana PM.",
    };
  }

  await db.pmType.update({
    where: { id },
    data: { deletedAt: new Date() }
  });

  await createAuditLog({
    userId: admin.id,
    action: "DELETE",
    entity: "PmType",
    entityId: id,
    oldValue: count.name,
  });

  revalidatePath("/admin/master");
  return { success: true };
}

// ============ INSPECTION TYPE ACTIONS ============

export async function upsertInspectionType(data: InspectionTypeInput) {
  const admin = await requireRole(["ADMIN"]);

  const validation = inspectionTypeSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { id, name } = validation.data;

  try {
    if (id) {
      const updated = await db.inspectionType.update({
        where: { id },
        data: { name },
      });
      await createAuditLog({
        userId: admin.id,
        action: "UPDATE",
        entity: "InspectionType",
        entityId: updated.id,
        newValue: name,
      });
    } else {
      const created = await db.inspectionType.create({
        data: { name },
      });
      await createAuditLog({
        userId: admin.id,
        action: "CREATE",
        entity: "InspectionType",
        entityId: created.id,
        newValue: name,
      });
    }

    revalidatePath("/admin/master");
    return { success: true };
  } catch {
    return {
      success: false,
      error: `Jenis inspeksi dengan nama "${name}" sudah ada.`,
    };
  }
}

export async function deleteInspectionType(data: { id: string }) {
  const admin = await requireRole(["ADMIN"]);

  const validation = deleteMasterSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: "ID tidak valid" };
  }

  const { id } = validation.data;

  const count = await db.inspectionType.findUnique({
    where: { id },
    include: {
      _count: {
        select: { inspections: true },
      },
    },
  });

  if (!count || count.deletedAt) {
    return { success: false, error: "Jenis inspeksi tidak ditemukan." };
  }

  if (count._count.inspections > 0) {
    return {
      success: false,
      error: "Tidak dapat menghapus jenis inspeksi yang sudah memiliki riwayat catatan inspeksi.",
    };
  }

  await db.inspectionType.update({
    where: { id },
    data: { deletedAt: new Date() }
  });

  await createAuditLog({
    userId: admin.id,
    action: "DELETE",
    entity: "InspectionType",
    entityId: id,
    oldValue: count.name,
  });

  revalidatePath("/admin/master");
  return { success: true };
}
