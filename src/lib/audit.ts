import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { clientIpFromHeaders } from "@/lib/client-ip";

type TransactionClient = Prisma.TransactionClient;

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATUS_CHANGE"
  | "VIEW"
  | "EXPORT"
  | string;

export interface CreateAuditLogParams {
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Extract IP and User-Agent from incoming Next.js request headers
 */
export async function getAuditClientInfo() {
  try {
    const h = await headers();
    // Jangan ambil entri kiri X-Forwarded-For: itu dikarang klien dan
    // membuat audit log bisa diracuni. Lihat @/lib/client-ip.
    const ipAddress = clientIpFromHeaders((name) => h.get(name));
    const userAgent = h.get("user-agent")?.slice(0, 512) || null;
    return { ipAddress, userAgent };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Record an audit log entry.
 */
export async function createAuditLog(
  params: CreateAuditLogParams,
  tx?: TransactionClient
) {
  const client = tx ?? db;

  let ipAddress = params.ipAddress;
  let userAgent = params.userAgent;

  if (!ipAddress && !userAgent) {
    const info = await getAuditClientInfo();
    ipAddress = info.ipAddress;
    userAgent = info.userAgent;
  }

  try {
    return await client.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        field: params.field ?? null,
        oldValue: params.oldValue ?? null,
        newValue: params.newValue ?? null,
        reason: params.reason ?? null,
        details: params.details ?? null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to record audit log:", err);
    return null;
  }
}

