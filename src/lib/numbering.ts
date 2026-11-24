import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

/**
 * Generate formatted code for Work Order: WO-YYYY-XXXXXX (e.g. WO-2026-000125)
 */
export async function generateWorkOrderCode(
  tx?: TransactionClient
): Promise<string> {
  const client = tx ?? db;
  const currentYear = new Date().getFullYear();
  const prefix = `WO-${currentYear}-`;

  const latest = await client.workOrder.findFirst({
    where: {
      code: {
        startsWith: prefix,
      },
    },
    orderBy: {
      code: "desc",
    },
    select: {
      code: true,
    },
  });

  let nextSequence = 1;
  if (latest?.code) {
    const parts = latest.code.split("-");
    if (parts.length === 3) {
      const parsedSeq = parseInt(parts[2], 10);
      if (!isNaN(parsedSeq)) {
        nextSequence = parsedSeq + 1;
      }
    }
  }

  const paddedSeq = String(nextSequence).padStart(6, "0");
  return `${prefix}${paddedSeq}`;
}

/**
 * Generate formatted code for Breakdown Request: BD-YYYY-XXXXXX (e.g. BD-2026-000045)
 */
export async function generateBreakdownCode(
  tx?: TransactionClient
): Promise<string> {
  const client = tx ?? db;
  const currentYear = new Date().getFullYear();
  const prefix = `BD-${currentYear}-`;

  const latest = await client.breakdownRequest.findFirst({
    where: {
      code: {
        startsWith: prefix,
      },
    },
    orderBy: {
      code: "desc",
    },
    select: {
      code: true,
    },
  });

  let nextSequence = 1;
  if (latest?.code) {
    const parts = latest.code.split("-");
    if (parts.length === 3) {
      const parsedSeq = parseInt(parts[2], 10);
      if (!isNaN(parsedSeq)) {
        nextSequence = parsedSeq + 1;
      }
    }
  }

  const paddedSeq = String(nextSequence).padStart(6, "0");
  return `${prefix}${paddedSeq}`;
}

/**
 * Generate formatted code for Inspection: INS-YYYY-XXXXXX (e.g. INS-2026-000012)
 */
export async function generateInspectionCode(
  tx?: TransactionClient
): Promise<string> {
  const client = tx ?? db;
  const currentYear = new Date().getFullYear();
  const prefix = `INS-${currentYear}-`;

  const latest = await client.inspection.findFirst({
    where: {
      code: {
        startsWith: prefix,
      },
    },
    orderBy: {
      code: "desc",
    },
    select: {
      code: true,
    },
  });

  let nextSequence = 1;
  if (latest?.code) {
    const parts = latest.code.split("-");
    if (parts.length === 3) {
      const parsedSeq = parseInt(parts[2], 10);
      if (!isNaN(parsedSeq)) {
        nextSequence = parsedSeq + 1;
      }
    }
  }

  const paddedSeq = String(nextSequence).padStart(6, "0");
  return `${prefix}${paddedSeq}`;
}

/**
 * Generate formatted code for Equipment: PREFIX-XXX (e.g. CRN-001, FLT-002)
 */
export async function generateEquipmentCode(
  categoryPrefix: string,
  tx?: TransactionClient
): Promise<string> {
  const client = tx ?? db;
  const cleanPrefix = categoryPrefix.trim().toUpperCase();
  const prefix = `${cleanPrefix}-`;

  const latest = await client.equipment.findFirst({
    where: {
      code: {
        startsWith: prefix,
      },
    },
    orderBy: {
      code: "desc",
    },
    select: {
      code: true,
    },
  });

  let nextSequence = 1;
  if (latest?.code) {
    const parts = latest.code.split("-");
    if (parts.length >= 2) {
      const parsedSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsedSeq)) {
        nextSequence = parsedSeq + 1;
      }
    }
  }

  const paddedSeq = String(nextSequence).padStart(3, "0");
  return `${prefix}${paddedSeq}`;
}
