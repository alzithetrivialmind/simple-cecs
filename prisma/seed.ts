import {
  PrismaClient,
  Role,
  EquipmentCategory,
  EquipmentStatus,
  Ownership,
  PartSystem,
  PmBasis,
  PmStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// All records below are fictional. In production only the first admin account
// is created, and its password must be supplied through SEED_ADMIN_PASSWORD.
const isProduction = process.env.NODE_ENV === "production";
const DEMO_PASSWORD = "password123";

async function seedAdmin() {
  const password =
    process.env.SEED_ADMIN_PASSWORD || (isProduction ? "" : DEMO_PASSWORD);
  if (isProduction && password.length < 12) {
    throw new Error(
      "Set SEED_ADMIN_PASSWORD (at least 12 characters) before seeding in production."
    );
  }

  await prisma.user.upsert({
    where: { nik: "ADM001" },
    update: {},
    create: {
      name: "Admin",
      nik: "ADM001",
      email: "admin@example.com",
      passwordHash: await bcrypt.hash(password, 10),
      role: Role.ADMIN,
      isActive: true,
    },
  });
}

async function seedDemo() {
  const department = (name: string) =>
    prisma.department.upsert({ where: { name }, update: {}, create: { name } });
  const location = (name: string) =>
    prisma.location.upsert({ where: { name }, update: {}, create: { name } });
  const pmType = (name: string) =>
    prisma.pmType.upsert({ where: { name }, update: {}, create: { name } });
  const inspectionType = (name: string) =>
    prisma.inspectionType.upsert({ where: { name }, update: {}, create: { name } });

  const heavy = await department("Alat Berat");
  const electrical = await department("Elektrikal");
  const mechanical = await department("Mekanik");

  const areaA = await location("Area A");
  const areaB = await location("Area B");
  const workshop = await location("Workshop Utama");

  const pm250 = await pmType("Service 250 Hours");
  await pmType("Service 500 Hours");
  await pmType("Service 1000 Hours");
  await pmType("Annual Service");

  await inspectionType("Safety & Operational Check");
  await inspectionType("Load Test");
  await inspectionType("Riksa Uji K3");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = [
    { nik: "SPV001", name: "Demo Supervisor", role: Role.SUPERVISOR, departmentId: heavy.id },
    { nik: "TECH001", name: "Demo Technician 1", role: Role.TECHNICIAN, departmentId: heavy.id },
    { nik: "TECH002", name: "Demo Technician 2", role: Role.TECHNICIAN, departmentId: electrical.id },
    { nik: "OPR001", name: "Demo Operator", role: Role.OPERATOR, departmentId: heavy.id },
    { nik: "VIW001", name: "Demo Viewer", role: Role.VIEWER, departmentId: mechanical.id },
  ];
  for (const user of users) {
    await prisma.user.upsert({
      where: { nik: user.nik },
      update: {},
      create: {
        ...user,
        email: `${user.nik.toLowerCase()}@example.com`,
        passwordHash,
        isActive: true,
      },
    });
  }

  await prisma.pmChecklistTemplate.upsert({
    where: {
      category_pmTypeId: {
        category: EquipmentCategory.HEAVY_EQUIPMENT,
        pmTypeId: pm250.id,
      },
    },
    update: {},
    create: {
      name: "Checklist Servis 250 Jam Alat Berat",
      category: EquipmentCategory.HEAVY_EQUIPMENT,
      pmTypeId: pm250.id,
      isActive: true,
      items: {
        create: [
          { label: "Ganti oli mesin dan filter oli", sortOrder: 0 },
          { label: "Bersihkan filter udara", sortOrder: 1 },
          { label: "Periksa level cairan radiator", sortOrder: 2 },
          { label: "Periksa kebocoran selang hidrolik", sortOrder: 3 },
          { label: "Periksa voltase aki dan terminal", sortOrder: 4 },
        ],
      },
    },
  });

  const equipment = (
    code: string,
    name: string,
    category: EquipmentCategory,
    capacity: string,
    currentHourMeter: number,
    locationId: string,
    departmentId: string
  ) =>
    prisma.equipment.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name,
        category,
        capacity,
        currentHourMeter,
        locationId,
        departmentId,
        manufacturer: "Demo Manufacturer",
        model: `DEMO-${code}`,
        serialNumber: `SN-DEMO-${code}`,
        yearOfManufacture: 2020,
        fuelType: "Solar",
        status: EquipmentStatus.READY,
        ownership: Ownership.OWNED,
      },
    });

  const crane = await equipment("CRN-001", "Demo Crawler Crane", EquipmentCategory.HEAVY_EQUIPMENT, "50 Ton", 3400, areaA.id, heavy.id);
  const excavator = await equipment("EXC-001", "Demo Excavator", EquipmentCategory.HEAVY_EQUIPMENT, "20 Ton", 2200, areaB.id, heavy.id);
  await equipment("FLT-001", "Demo Forklift", EquipmentCategory.HEAVY_EQUIPMENT, "5 Ton", 800, workshop.id, mechanical.id);
  await equipment("GEN-001", "Demo Generator", EquipmentCategory.GENERATOR, "500 kVA", 4800, workshop.id, electrical.id);
  await equipment("CMP-001", "Demo Air Compressor", EquipmentCategory.COMPRESSOR, "750 CFM", 1700, areaB.id, mechanical.id);

  const pmPlan = (equipmentId: string, lastDoneHour: number, status: PmStatus) =>
    prisma.pmPlan.upsert({
      where: { equipmentId_pmTypeId: { equipmentId, pmTypeId: pm250.id } },
      update: {},
      create: {
        equipmentId,
        pmTypeId: pm250.id,
        basis: PmBasis.HOUR_METER,
        intervalHour: 250,
        lastDoneHour,
        nextDueHour: lastDoneHour + 250,
        status,
      },
    });
  await pmPlan(crane.id, 3250, PmStatus.UPCOMING);
  await pmPlan(excavator.id, 1900, PmStatus.OVERDUE);

  const parts = [
    { partNumber: "DEMO-OIL-01", description: "Engine Oil Filter", system: PartSystem.ENGINE, unit: "PCS" },
    { partNumber: "DEMO-FUEL-01", description: "Fuel Filter", system: PartSystem.ENGINE, unit: "PCS" },
    { partNumber: "DEMO-HYD-01", description: "Hydraulic Seal Kit", system: PartSystem.HYDRAULIC, unit: "SET" },
    { partNumber: "DEMO-ELC-01", description: "Alternator 24V", system: PartSystem.ELECTRICAL, unit: "PCS" },
  ];
  for (const part of parts) {
    await prisma.part.upsert({
      where: { partNumber: part.partNumber },
      update: {},
      create: {
        ...part,
        manufacturer: "Demo Manufacturer",
        compatibility: { create: [{ category: EquipmentCategory.HEAVY_EQUIPMENT }] },
      },
    });
  }
}

async function main() {
  await seedAdmin();
  if (isProduction) {
    console.log("Admin account ready (ADM001). Demo data is skipped in production.");
    return;
  }
  await seedDemo();
  console.log("Demo data ready.");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
