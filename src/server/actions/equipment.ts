"use server";

import { db } from "@/lib/db";
import { toUserMessage } from "@/lib/errors";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import {
  equipmentSchema,
  updateEquipmentSchema,
  importEquipmentRowSchema,
  EquipmentInput,
  UpdateEquipmentInput,
  ImportEquipmentRow,
} from "@/lib/validations/equipment";
import { generateEquipmentCode } from "@/lib/numbering";
import { createAuditLog } from "@/lib/audit";
import { uploadBuffer } from "@/lib/storage";
import { validateUpload, safeDisplayName } from "@/lib/upload-guard";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { EquipmentCategory, EquipmentStatus, Ownership, Prisma } from "@prisma/client";

export interface GetEquipmentParams {
  search?: string;
  category?: EquipmentCategory;
  status?: EquipmentStatus;
  departmentId?: string;
  locationId?: string;
  page?: number;
  limit?: number;
  /** Ambil semua unit tanpa paginasi (list equipment memfilter di client). */
  all?: boolean;
}

const CATEGORY_PREFIX_MAP: Record<EquipmentCategory, string> = {
  HEAVY_EQUIPMENT: "HE",
  VEHICLE: "VEH",
  GENERATOR: "GEN",
  COMPRESSOR: "CMP",
  PUMP: "PMP",
  WELDING_MACHINE: "WLD",
  OTHER_POWERED_EQUIPMENT: "EQP",
};

type SpecInput = Pick<
  EquipmentInput,
  | "supplier"
  | "engineManufacturer"
  | "enginePower"
  | "maxTorque"
  | "cylinderCount"
  | "engineDisplacement"
  | "hydraulicSystem"
  | "maxTravelSpeed"
  | "gradeability"
  | "turningRadius"
  | "dimensions"
  | "engineOilCapacity"
  | "transmissionOilCapacity"
  | "hydraulicOilCapacity"
  | "fuelTankCapacity"
  | "notes"
>;

function toSpecData(v: SpecInput) {
  return {
    supplier: v.supplier || null,
    engineManufacturer: v.engineManufacturer || null,
    enginePower: v.enginePower || null,
    maxTorque: v.maxTorque || null,
    cylinderCount: v.cylinderCount || null,
    engineDisplacement: v.engineDisplacement || null,
    hydraulicSystem: v.hydraulicSystem || null,
    maxTravelSpeed: v.maxTravelSpeed || null,
    gradeability: v.gradeability || null,
    turningRadius: v.turningRadius || null,
    dimensions: v.dimensions || null,
    engineOilCapacity: v.engineOilCapacity ?? null,
    transmissionOilCapacity: v.transmissionOilCapacity ?? null,
    hydraulicOilCapacity: v.hydraulicOilCapacity ?? null,
    fuelTankCapacity: v.fuelTankCapacity ?? null,
    notes: v.notes?.trim() || null,
  };
}

export async function getEquipmentList(params?: GetEquipmentParams) {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const page = Math.max(1, params?.page ?? 1);
  const limit = Math.max(1, Math.min(100, params?.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.EquipmentWhereInput = {
    deletedAt: null,
  };

  if (params?.category) {
    where.category = params.category;
  }

  if (params?.status) {
    where.status = params.status;
  }

  if (params?.departmentId) {
    where.departmentId = params.departmentId;
  }

  if (params?.locationId) {
    where.locationId = params.locationId;
  }

  if (params?.search?.trim()) {
    const s = params.search.trim();
    where.OR = [
      { code: { contains: s, mode: "insensitive" } },
      { name: { contains: s, mode: "insensitive" } },
      { model: { contains: s, mode: "insensitive" } },
      { serialNumber: { contains: s, mode: "insensitive" } },
      { assetNumber: { contains: s, mode: "insensitive" } },
    ];
  }

  const [total, items, departments, locations] = await Promise.all([
    db.equipment.count({ where }),
    db.equipment.findMany({
      where,
      ...(params?.all ? {} : { skip, take: limit }),
      orderBy: { code: "asc" },
      include: {
        department: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    }),
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.location.findMany({ orderBy: { name: "asc" } }),
  ]);

  return {
    items,
    departments,
    locations,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getEquipmentById(id: string) {
  // Defense in depth: do not rely on middleware alone for authorization
  await requireAuth();

  const equipment = await db.equipment.findFirst({
    where: { id, deletedAt: null },
    include: {
      department: true,
      location: true,
      hourMeterLogs: {
        orderBy: { readingDate: "desc" },
        take: 10,
        include: {
          createdBy: { select: { id: true, name: true, nik: true, avatarUrl: true } },
        },
      },
      workOrders: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          assignedTo: { select: { id: true, name: true, nik: true, avatarUrl: true } },
          repairResult: { select: { correctiveAction: true } },
        },
      },
      breakdowns: {
        where: { deletedAt: null },
        orderBy: { reportedAt: "desc" },
        include: {
          reportedBy: { select: { id: true, name: true, nik: true, avatarUrl: true } },
        },
      },
      usageSessions: {
        orderBy: { startAt: "desc" },
        take: 10,
        include: {
          operator: { select: { id: true, name: true, nik: true, avatarUrl: true } },
        },
      },
    },
  });

  if (!equipment) return null;

  // Get all attachments linked to this equipment, its breakdowns, and its work orders
  const breakdownIds = equipment.breakdowns.map((b) => b.id);
  const workOrderIds = equipment.workOrders.map((w) => w.id);

  const attachments = await db.attachment.findMany({
    where: {
      OR: [
        { entityType: "EQUIPMENT", entityId: id },
        ...(breakdownIds.length > 0 ? [{ entityType: "BREAKDOWN" as const, entityId: { in: breakdownIds } }] : []),
        ...(workOrderIds.length > 0 ? [{ entityType: "WORK_ORDER" as const, entityId: { in: workOrderIds } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { id: true, name: true, nik: true, avatarUrl: true } },
    },
  });

  return {
    ...equipment,
    attachments,
  };
}

export async function createEquipment(data: EquipmentInput) {
  const user = await requireRole(["ADMIN", "SUPERVISOR"]);

  const validation = equipmentSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const validated = validation.data;

  // Generate code if empty
  let code = validated.code?.trim().toUpperCase();
  if (!code) {
    const prefix = CATEGORY_PREFIX_MAP[validated.category] || "EQP";
    code = await generateEquipmentCode(prefix);
  }

  // Check unique code
  const existing = await db.equipment.findUnique({
    where: { code },
  });

  if (existing) {
    return {
      success: false,
      error: `Kode unit "${code}" sudah terdaftar.`,
    };
  }

  const inServiceDate = validated.inServiceDate
    ? new Date(validated.inServiceDate)
    : null;

  const equipment = await db.equipment.create({
    data: {
      code,
      name: validated.name,
      category: validated.category,
      ownership: validated.ownership,
      status: EquipmentStatus.READY, // Default READY per CECS rule
      assetNumber: validated.assetNumber || null,
      manufacturer: validated.manufacturer || null,
      model: validated.model || null,
      serialNumber: validated.serialNumber || null,
      yearOfManufacture: validated.yearOfManufacture || null,
      inServiceDate,
      engineModel: validated.engineModel || null,
      engineSerialNumber: validated.engineSerialNumber || null,
      transmission: validated.transmission || null,
      capacity: validated.capacity || null,
      operatingWeight: validated.operatingWeight || null,
      fuelType: validated.fuelType || null,
      ...toSpecData(validated),
      locationId: validated.locationId || null,
      departmentId: validated.departmentId || null,
      currentHourMeter: validated.currentHourMeter || 0,
      photoUrl: validated.photoUrl || null,
    },
  });

  // If initial hour meter > 0, log it
  if (validated.currentHourMeter > 0) {
    await db.hourMeterLog.create({
      data: {
        equipmentId: equipment.id,
        hourMeter: validated.currentHourMeter,
        source: "MANUAL",
        readingDate: new Date(),
        remark: "Pencatatan awal saat registrasi unit",
        createdById: user.id,
      },
    });
  }

  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    entity: "Equipment",
    entityId: equipment.code,
    newValue: JSON.stringify({ code: equipment.code, name: equipment.name }),
    details: `Mendaftarkan unit teknik baru: ${equipment.name} (${equipment.code})`,
  });

  revalidatePath("/equipment");
  return { success: true, equipment };
}

export async function updateEquipment(data: UpdateEquipmentInput) {
  const user = await requireRole(["ADMIN", "SUPERVISOR"]);

  const validation = updateEquipmentSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  const { id, ...validated } = validation.data;

  const existing = await db.equipment.findUnique({
    where: { id },
  });

  if (!existing || existing.deletedAt) {
    return { success: false, error: "Unit tidak ditemukan." };
  }

  const inServiceDate = validated.inServiceDate
    ? new Date(validated.inServiceDate)
    : null;

  // Status is preserved, never overwritten from form
  const updated = await db.equipment.update({
    where: { id },
    data: {
      name: validated.name,
      category: validated.category,
      ownership: validated.ownership,
      assetNumber: validated.assetNumber || null,
      manufacturer: validated.manufacturer || null,
      model: validated.model || null,
      serialNumber: validated.serialNumber || null,
      yearOfManufacture: validated.yearOfManufacture || null,
      inServiceDate,
      engineModel: validated.engineModel || null,
      engineSerialNumber: validated.engineSerialNumber || null,
      transmission: validated.transmission || null,
      capacity: validated.capacity || null,
      operatingWeight: validated.operatingWeight || null,
      fuelType: validated.fuelType || null,
      ...toSpecData(validated),
      locationId: validated.locationId || null,
      departmentId: validated.departmentId || null,
      photoUrl: validated.photoUrl || existing.photoUrl,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entity: "Equipment",
    entityId: id,
    details: `Update data spesifikasi unit ${existing.code} (${existing.name})`,
    oldValue: JSON.stringify({ name: existing.name, model: existing.model, category: existing.category, serialNumber: existing.serialNumber }),
    newValue: JSON.stringify({ name: updated.name, model: updated.model, category: updated.category, serialNumber: updated.serialNumber }),
  });

  revalidatePath("/equipment");
  revalidatePath(`/equipment/${id}`);
  return { success: true, equipment: updated };
}

export async function deleteEquipment(id: string) {
  const user = await requireRole(["ADMIN"]);

  const existing = await db.equipment.findUnique({
    where: { id },
  });

  if (!existing || existing.deletedAt) {
    return { success: false, error: "Unit tidak ditemukan." };
  }

  // Soft delete
  await db.equipment.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "DELETE",
    entity: "Equipment",
    entityId: id,
    reason: "Penghapusan unit equipment (Soft Delete)",
    details: `Unit equipment ${existing.code} (${existing.name}) dinonaktifkan/dihapus`,
    oldValue: JSON.stringify({ code: existing.code, name: existing.name }),
  });

  revalidatePath("/equipment");
  return { success: true };
}

export async function uploadEquipmentPhoto(formData: FormData) {
  const user = await requireRole(["ADMIN", "SUPERVISOR", "TECHNICIAN"]);

  const file = formData.get("file") as File | null;
  const equipmentId = formData.get("equipmentId") as string | null;

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

  const fileKey = `equipment/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${validated.ext}`;

  await uploadBuffer(fileKey, buffer, validated.mime);

  // If equipmentId is passed, also create an Attachment record
  if (equipmentId) {
    await db.attachment.create({
      data: {
        entityType: "EQUIPMENT",
        entityId: equipmentId,
        kind: "PHOTO",
        fileKey,
        fileName: safeDisplayName(file.name, validated.ext),
        mimeType: validated.mime,
        sizeBytes: buffer.length,
        uploadedById: user.id,
      },
    });

    // Update equipment cover photo if not set
    await db.equipment.update({
      where: { id: equipmentId },
      data: { photoUrl: `/api/files/${fileKey}` },
    });
  }

  return { success: true, fileKey, url: `/api/files/${fileKey}` };
}

export async function importEquipmentBatch(
  rows: ImportEquipmentRow[]
): Promise<{ success: true; count: number } | { success: false; error: string }> {
  try {
    const user = await requireRole(["ADMIN", "SUPERVISOR"]);

    const parsed = importEquipmentRowSchema.array().safeParse(rows);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || "Data impor tidak valid" };
    }
    rows = parsed.data;

    const departments = await db.department.findMany();
    const locations = await db.location.findMany();

    const deptMap = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
    const locMap = new Map(locations.map((l) => [l.name.toLowerCase(), l.id]));

    const createdEquipment = [];

    for (const row of rows) {
      // Map department & location if matching
      const departmentId = row.departmentName
        ? deptMap.get(row.departmentName.trim().toLowerCase())
        : undefined;

      const locationId = row.locationName
        ? locMap.get(row.locationName.trim().toLowerCase())
        : undefined;

      // Validate category enum
      const validCategory = Object.values(EquipmentCategory).includes(
        row.category as EquipmentCategory
      )
        ? (row.category as EquipmentCategory)
        : EquipmentCategory.OTHER_POWERED_EQUIPMENT;

      const validOwnership = Object.values(Ownership).includes(
        row.ownership as Ownership
      )
        ? (row.ownership as Ownership)
        : Ownership.OWNED;

      // Blank spec cells stay undefined so re-importing an older template
      // does not wipe data entered from the form
      const importSpecUpdate = {
        engineManufacturer: row.engineManufacturer || undefined,
        enginePower: row.enginePower || undefined,
        maxTorque: row.maxTorque || undefined,
        cylinderCount: row.cylinderCount || undefined,
        engineDisplacement: row.engineDisplacement || undefined,
        hydraulicSystem: row.hydraulicSystem || undefined,
        maxTravelSpeed: row.maxTravelSpeed || undefined,
        gradeability: row.gradeability || undefined,
        turningRadius: row.turningRadius || undefined,
        dimensions: row.dimensions || undefined,
        supplier: row.supplier || undefined,
        engineSerialNumber: row.engineSerialNumber || undefined,
        transmission: row.transmission || undefined,
        engineOilCapacity: row.engineOilCapacity ?? undefined,
        transmissionOilCapacity: row.transmissionOilCapacity ?? undefined,
        hydraulicOilCapacity: row.hydraulicOilCapacity ?? undefined,
        fuelTankCapacity: row.fuelTankCapacity ?? undefined,
        notes: row.notes?.trim() || undefined,
      };

      const eq = await db.equipment.upsert({
        where: { code: row.code },
        update: {
          name: row.name,
          category: validCategory,
          ownership: validOwnership,
          // Columns missing from the file (undefined) keep the stored value
          assetNumber: row.assetNumber === undefined ? undefined : row.assetNumber || null,
          manufacturer: row.manufacturer || null,
          model: row.model || null,
          serialNumber: row.serialNumber || null,
          yearOfManufacture: row.yearOfManufacture || null,
          engineModel: row.engineModel || null,
          capacity: row.capacity || null,
          fuelType: row.fuelType || null,
          ...importSpecUpdate,
          departmentId: row.departmentName === undefined ? undefined : departmentId || null,
          locationId: row.locationName === undefined ? undefined : locationId || null,
        },
        create: {
          code: row.code,
          name: row.name,
          category: validCategory,
          ownership: validOwnership,
          status: EquipmentStatus.READY,
          assetNumber: row.assetNumber || null,
          manufacturer: row.manufacturer || null,
          model: row.model || null,
          serialNumber: row.serialNumber || null,
          yearOfManufacture: row.yearOfManufacture || null,
          engineModel: row.engineModel || null,
          capacity: row.capacity || null,
          fuelType: row.fuelType || null,
          ...importSpecUpdate,
          currentHourMeter: row.currentHourMeter || 0,
          departmentId: departmentId || null,
          locationId: locationId || null,
        },
      });

      createdEquipment.push(eq);
    }

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "Equipment",
      entityId: "BATCH_IMPORT",
      newValue: `Imported ${createdEquipment.length} units from Excel`,
    });

    revalidatePath("/equipment");
    return { success: true, count: createdEquipment.length };
  } catch (err: unknown) {
    const message = toUserMessage(err, "Gagal mengimpor data equipment.");
    return { success: false, error: message };
  }
}

