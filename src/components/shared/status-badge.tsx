import type {
  EquipmentStatus,
  InspectionResult,
  PmStatus,
  Priority,
  WorkOrderStatus,
} from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  EQUIPMENT_STATUS,
  INSPECTION_RESULT,
  PM_STATUS,
  PRIORITY,
  WORK_ORDER_STATUS,
} from "@/lib/labels";

type StatusBadgeProps = { className?: string } & (
  | { kind: "equipment"; status: EquipmentStatus }
  | { kind: "workOrder"; status: WorkOrderStatus }
  | { kind: "pm"; status: PmStatus }
  | { kind: "priority"; status: Priority }
  | { kind: "inspection"; status: InspectionResult }
);

const MAPS = {
  equipment: EQUIPMENT_STATUS,
  workOrder: WORK_ORDER_STATUS,
  pm: PM_STATUS,
  priority: PRIORITY,
  inspection: INSPECTION_RESULT,
} as const;

export function StatusBadge(props: StatusBadgeProps) {
  const map = MAPS[props.kind] as Record<string, { label: string; variant: Parameters<typeof Badge>[0]["variant"] }>;
  const entry = map[props.status] ?? { label: props.status, variant: "outline" };
  return (
    <Badge variant={entry.variant} className={props.className}>
      {entry.label}
    </Badge>
  );
}
