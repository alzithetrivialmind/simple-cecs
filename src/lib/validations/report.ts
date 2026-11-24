import { z } from "zod";
import { EquipmentCategory } from "@prisma/client";

export const reportFilterSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  category: z.nativeEnum(EquipmentCategory).optional(),
  departmentId: z.string().optional(),
  equipmentId: z.string().optional(),
  period: z.enum(["7D", "30D", "90D", "1Y", "CUSTOM"]).default("30D"),
});

export type ReportFilterInput = z.infer<typeof reportFilterSchema>;
