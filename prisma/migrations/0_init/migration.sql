-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "UsageStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('HEAVY_EQUIPMENT', 'VEHICLE', 'GENERATOR', 'COMPRESSOR', 'PUMP', 'WELDING_MACHINE', 'OTHER_POWERED_EQUIPMENT');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('READY', 'STANDBY', 'IN_USE', 'BREAKDOWN', 'UNDER_REPAIR', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "Ownership" AS ENUM ('OWNED', 'RENTAL');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BreakdownStatus" AS ENUM ('SUBMITTED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkOrderType" AS ENUM ('CORRECTIVE', 'PREVENTIVE', 'INSPECTION_FOLLOW_UP');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('OPEN', 'WAITING_PART', 'IN_PROGRESS', 'DONE', 'CLOSED');

-- CreateEnum
CREATE TYPE "PmBasis" AS ENUM ('HOUR_METER', 'CALENDAR');

-- CreateEnum
CREATE TYPE "PmStatus" AS ENUM ('UPCOMING', 'DUE', 'OVERDUE');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PASS', 'PASS_WITH_REMARK', 'FAIL');

-- CreateEnum
CREATE TYPE "PartSystem" AS ENUM ('ENGINE', 'HYDRAULIC', 'ELECTRICAL', 'UNDERCARRIAGE', 'TRANSMISSION', 'OTHERS');

-- CreateEnum
CREATE TYPE "AttachmentEntity" AS ENUM ('EQUIPMENT', 'BREAKDOWN', 'WORK_ORDER', 'INSPECTION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nik" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'TECHNICIAN',
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "tokenInvalidBefore" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PmType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PmType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InspectionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "assetNumber" TEXT,
    "supplier" TEXT,
    "category" "EquipmentCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "yearOfManufacture" INTEGER,
    "inServiceDate" TIMESTAMP(3),
    "engineModel" TEXT,
    "engineSerialNumber" TEXT,
    "transmission" TEXT,
    "capacity" TEXT,
    "operatingWeight" TEXT,
    "fuelType" TEXT,
    "engineManufacturer" TEXT,
    "enginePower" TEXT,
    "maxTorque" TEXT,
    "cylinderCount" TEXT,
    "engineDisplacement" TEXT,
    "hydraulicSystem" TEXT,
    "maxTravelSpeed" TEXT,
    "gradeability" TEXT,
    "turningRadius" TEXT,
    "dimensions" TEXT,
    "engineOilCapacity" DOUBLE PRECISION,
    "transmissionOilCapacity" DOUBLE PRECISION,
    "hydraulicOilCapacity" DOUBLE PRECISION,
    "fuelTankCapacity" DOUBLE PRECISION,
    "notes" TEXT,
    "locationId" TEXT,
    "departmentId" TEXT,
    "ownership" "Ownership" NOT NULL DEFAULT 'OWNED',
    "status" "EquipmentStatus" NOT NULL DEFAULT 'READY',
    "currentHourMeter" INTEGER NOT NULL DEFAULT 0,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HourMeterLog" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "hourMeter" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "remark" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HourMeterLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentUsageSession" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3),
    "startPhotoUrl" TEXT NOT NULL,
    "endPhotoUrl" TEXT,
    "durationMinutes" INTEGER,
    "remarks" TEXT,
    "status" "UsageStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EquipmentUsageSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakdownRequest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hourMeter" INTEGER NOT NULL,
    "reportedById" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "BreakdownStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BreakdownRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "breakdownRequestId" TEXT,
    "pmPlanId" TEXT,
    "type" "WorkOrderType" NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "externalServiceBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "downtimeMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderStatusHistory" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "fromStatus" "WorkOrderStatus",
    "toStatus" "WorkOrderStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "WorkOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagnosis" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "checklist" JSONB,
    "finding" TEXT NOT NULL,
    "rootCause" TEXT NOT NULL,
    "recommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairResult" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "correctiveAction" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "manufacturer" TEXT,
    "altPartNumber" TEXT,
    "system" "PartSystem" NOT NULL DEFAULT 'OTHERS',
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartCompatibility" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "category" "EquipmentCategory",
    "equipmentId" TEXT,

    CONSTRAINT "PartCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartUsage" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PartUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PmChecklistTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "pmTypeId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PmChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PmChecklistItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PmChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PmPlan" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "pmTypeId" TEXT NOT NULL,
    "basis" "PmBasis" NOT NULL,
    "intervalHour" INTEGER,
    "intervalDays" INTEGER,
    "lastDoneHour" INTEGER,
    "lastDoneDate" TIMESTAMP(3),
    "nextDueHour" INTEGER,
    "nextDueDate" TIMESTAMP(3),
    "status" "PmStatus" NOT NULL DEFAULT 'UPCOMING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PmPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PmExecution" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "pmPlanId" TEXT NOT NULL,
    "hourMeter" INTEGER NOT NULL,
    "results" JSONB NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PmExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "inspectionTypeId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "hourMeter" INTEGER NOT NULL,
    "result" "InspectionResult" NOT NULL,
    "finding" TEXT,
    "recommendation" TEXT,
    "certificateNumber" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "entityType" "AttachmentEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PHOTO',
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "firstAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_nik_key" ON "User"("nik");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE INDEX "Department_deletedAt_idx" ON "Department"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_key" ON "Location"("name");

-- CreateIndex
CREATE INDEX "Location_deletedAt_idx" ON "Location"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PmType_name_key" ON "PmType"("name");

-- CreateIndex
CREATE INDEX "PmType_deletedAt_idx" ON "PmType"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionType_name_key" ON "InspectionType"("name");

-- CreateIndex
CREATE INDEX "InspectionType_deletedAt_idx" ON "InspectionType"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_code_key" ON "Equipment"("code");

-- CreateIndex
CREATE INDEX "Equipment_category_status_idx" ON "Equipment"("category", "status");

-- CreateIndex
CREATE INDEX "Equipment_deletedAt_idx" ON "Equipment"("deletedAt");

-- CreateIndex
CREATE INDEX "HourMeterLog_equipmentId_readingDate_idx" ON "HourMeterLog"("equipmentId", "readingDate");

-- CreateIndex
CREATE INDEX "HourMeterLog_deletedAt_idx" ON "HourMeterLog"("deletedAt");

-- CreateIndex
CREATE INDEX "EquipmentUsageSession_equipmentId_status_idx" ON "EquipmentUsageSession"("equipmentId", "status");

-- CreateIndex
CREATE INDEX "EquipmentUsageSession_operatorId_status_idx" ON "EquipmentUsageSession"("operatorId", "status");

-- CreateIndex
CREATE INDEX "EquipmentUsageSession_deletedAt_idx" ON "EquipmentUsageSession"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BreakdownRequest_code_key" ON "BreakdownRequest"("code");

-- CreateIndex
CREATE INDEX "BreakdownRequest_equipmentId_reportedAt_idx" ON "BreakdownRequest"("equipmentId", "reportedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_code_key" ON "WorkOrder"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_breakdownRequestId_key" ON "WorkOrder"("breakdownRequestId");

-- CreateIndex
CREATE INDEX "WorkOrder_equipmentId_status_idx" ON "WorkOrder"("equipmentId", "status");

-- CreateIndex
CREATE INDEX "WorkOrder_status_createdAt_idx" ON "WorkOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkOrderStatusHistory_workOrderId_changedAt_idx" ON "WorkOrderStatusHistory"("workOrderId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Diagnosis_workOrderId_key" ON "Diagnosis"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairResult_workOrderId_key" ON "RepairResult"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Part_partNumber_key" ON "Part"("partNumber");

-- CreateIndex
CREATE INDEX "Part_system_idx" ON "Part"("system");

-- CreateIndex
CREATE UNIQUE INDEX "PartCompatibility_partId_category_equipmentId_key" ON "PartCompatibility"("partId", "category", "equipmentId");

-- CreateIndex
CREATE INDEX "PartUsage_partId_usedAt_idx" ON "PartUsage"("partId", "usedAt");

-- CreateIndex
CREATE INDEX "PmChecklistTemplate_deletedAt_idx" ON "PmChecklistTemplate"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PmChecklistTemplate_category_pmTypeId_key" ON "PmChecklistTemplate"("category", "pmTypeId");

-- CreateIndex
CREATE INDEX "PmPlan_status_idx" ON "PmPlan"("status");

-- CreateIndex
CREATE INDEX "PmPlan_deletedAt_idx" ON "PmPlan"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PmPlan_equipmentId_pmTypeId_key" ON "PmPlan"("equipmentId", "pmTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "PmExecution_workOrderId_key" ON "PmExecution"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_code_key" ON "Inspection"("code");

-- CreateIndex
CREATE INDEX "Inspection_equipmentId_inspectionDate_idx" ON "Inspection"("equipmentId", "inspectionDate");

-- CreateIndex
CREATE INDEX "Inspection_validUntil_idx" ON "Inspection"("validUntil");

-- CreateIndex
CREATE INDEX "Attachment_entityType_entityId_idx" ON "Attachment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_at_idx" ON "AuditLog"("entity", "entityId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_action_at_idx" ON "AuditLog"("action", "at");

-- CreateIndex
CREATE INDEX "AuditLog_userId_at_idx" ON "AuditLog"("userId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "LoginAttempt_lastAttemptAt_idx" ON "LoginAttempt"("lastAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoginAttempt_scope_key_key" ON "LoginAttempt"("scope", "key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HourMeterLog" ADD CONSTRAINT "HourMeterLog_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HourMeterLog" ADD CONSTRAINT "HourMeterLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentUsageSession" ADD CONSTRAINT "EquipmentUsageSession_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentUsageSession" ADD CONSTRAINT "EquipmentUsageSession_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownRequest" ADD CONSTRAINT "BreakdownRequest_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakdownRequest" ADD CONSTRAINT "BreakdownRequest_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_breakdownRequestId_fkey" FOREIGN KEY ("breakdownRequestId") REFERENCES "BreakdownRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_pmPlanId_fkey" FOREIGN KEY ("pmPlanId") REFERENCES "PmPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderStatusHistory" ADD CONSTRAINT "WorkOrderStatusHistory_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairResult" ADD CONSTRAINT "RepairResult_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartCompatibility" ADD CONSTRAINT "PartCompatibility_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartUsage" ADD CONSTRAINT "PartUsage_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartUsage" ADD CONSTRAINT "PartUsage_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmChecklistTemplate" ADD CONSTRAINT "PmChecklistTemplate_pmTypeId_fkey" FOREIGN KEY ("pmTypeId") REFERENCES "PmType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmChecklistItem" ADD CONSTRAINT "PmChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PmChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmPlan" ADD CONSTRAINT "PmPlan_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmPlan" ADD CONSTRAINT "PmPlan_pmTypeId_fkey" FOREIGN KEY ("pmTypeId") REFERENCES "PmType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmExecution" ADD CONSTRAINT "PmExecution_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmExecution" ADD CONSTRAINT "PmExecution_pmPlanId_fkey" FOREIGN KEY ("pmPlanId") REFERENCES "PmPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inspectionTypeId_fkey" FOREIGN KEY ("inspectionTypeId") REFERENCES "InspectionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

