/**
 * Indonesian UI labels for enums, in one place so every screen uses the
 * same words. Badge variants follow the status colours in docs/UI-SPEC.md.
 */
import type {
  EquipmentCategory,
  EquipmentStatus,
  InspectionResult,
  PmStatus,
  Priority,
  Role,
  WorkOrderStatus,
  WorkOrderType,
} from "@prisma/client";

export type StatusVariant =
  | "ready"
  | "inUse"
  | "standby"
  | "breakdown"
  | "underRepair"
  | "scrapped"
  | "upcoming"
  | "due"
  | "overdue"
  | "open"
  | "waitingPart"
  | "inProgress"
  | "done"
  | "closed"
  | "outline";

interface Label {
  label: string;
  variant: StatusVariant;
}

export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  HEAVY_EQUIPMENT: "Alat Berat",
  VEHICLE: "Kendaraan",
  GENERATOR: "Genset",
  COMPRESSOR: "Kompresor",
  PUMP: "Pompa",
  WELDING_MACHINE: "Mesin Las",
  OTHER_POWERED_EQUIPMENT: "Peralatan Lain",
};

export const EQUIPMENT_STATUS: Record<EquipmentStatus, Label> = {
  READY: { label: "Siap", variant: "ready" },
  IN_USE: { label: "Dipakai", variant: "inUse" },
  STANDBY: { label: "Standby", variant: "standby" },
  BREAKDOWN: { label: "Rusak", variant: "breakdown" },
  UNDER_REPAIR: { label: "Perbaikan", variant: "underRepair" },
  SCRAPPED: { label: "Afkir", variant: "scrapped" },
};

export const WORK_ORDER_STATUS: Record<WorkOrderStatus, Label> = {
  OPEN: { label: "Terbuka", variant: "open" },
  WAITING_PART: { label: "Tunggu part", variant: "waitingPart" },
  IN_PROGRESS: { label: "Dikerjakan", variant: "inProgress" },
  DONE: { label: "Selesai", variant: "done" },
  CLOSED: { label: "Ditutup", variant: "closed" },
};

export const PM_STATUS: Record<PmStatus, Label> = {
  UPCOMING: { label: "Terjadwal", variant: "upcoming" },
  DUE: { label: "Jatuh tempo", variant: "due" },
  OVERDUE: { label: "Terlambat", variant: "overdue" },
};

export const PRIORITY: Record<Priority, Label> = {
  LOW: { label: "Rendah", variant: "outline" },
  MEDIUM: { label: "Sedang", variant: "outline" },
  HIGH: { label: "Tinggi", variant: "due" },
  CRITICAL: { label: "Kritis", variant: "breakdown" },
};

export const WORK_ORDER_TYPE: Record<WorkOrderType, string> = {
  CORRECTIVE: "Korektif",
  PREVENTIVE: "Preventif",
  INSPECTION_FOLLOW_UP: "Tindak lanjut inspeksi",
};

export const INSPECTION_RESULT: Record<InspectionResult, Label> = {
  PASS: { label: "Lulus", variant: "ready" },
  PASS_WITH_REMARK: { label: "Lulus dgn catatan", variant: "due" },
  FAIL: { label: "Gagal", variant: "breakdown" },
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  SUPERVISOR: "Supervisor",
  TECHNICIAN: "Teknisi",
  OPERATOR: "Operator",
  VIEWER: "Viewer",
};

export function roleLabel(role: string | null | undefined): string {
  return (role && ROLE_LABELS[role as Role]) || role || "";
}
