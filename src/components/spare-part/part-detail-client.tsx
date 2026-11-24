"use client";

import Link from "next/link";
import { ArrowLeft, History, Package, Trophy } from "lucide-react";
import { WorkOrderStatus, WorkOrderType } from "@prisma/client";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CATEGORY_LABELS, SYSTEM_LABELS } from "@/components/spare-part/part-list-client";
import type { getPartById } from "@/server/actions/part";
import { formatDateIndo, formatDateTimeIndo } from "@/lib/utils";

type PartDetail = NonNullable<Awaited<ReturnType<typeof getPartById>>>;

const WO_TYPE_LABELS: Record<WorkOrderType, string> = {
  CORRECTIVE: "Korektif",
  PREVENTIVE: "Preventif",
  INSPECTION_FOLLOW_UP: "Tindak Lanjut Inspeksi",
};

const WO_STATUS_CONFIG: Record<WorkOrderStatus, { label: string; variant: BadgeProps["variant"] }> = {
  OPEN: { label: "OPEN", variant: "open" },
  WAITING_PART: { label: "WAITING PART", variant: "waitingPart" },
  IN_PROGRESS: { label: "IN PROGRESS", variant: "inProgress" },
  DONE: { label: "DONE", variant: "done" },
  CLOSED: { label: "CLOSED", variant: "closed" },
};

interface PartDetailClientProps {
  part: PartDetail;
}

export function PartDetailClient({ part }: PartDetailClientProps) {
  const categories = part.compatibility
    .map((c) => c.category)
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button asChild variant="ghost" className="-ml-3 h-11 gap-2 text-muted-foreground">
          <Link href="/spare-part">
            <ArrowLeft className="h-4 w-4" />
            Spare part
          </Link>
        </Button>
        <div className="min-w-0 space-y-1">
          <h1 className="font-condensed text-3xl font-bold leading-tight tracking-tight break-all">{part.partNumber}</h1>
          <p className="text-base font-medium break-words">{part.description}</p>
        </div>
      </div>

      {/* Identity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Identitas Part
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Sistem</dt>
              <dd className="font-medium">{SYSTEM_LABELS[part.system]}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Satuan</dt>
              <dd className="font-medium">{part.unit}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Pabrikan</dt>
              <dd className="font-medium break-words">{part.manufacturer || "-"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Part Alternatif</dt>
              <dd className="font-mono font-medium break-all">{part.altPartNumber || "-"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Total Pemakaian</dt>
              <dd className="font-medium">{part.usageCount}x</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Total Qty Terpakai</dt>
              <dd className="font-medium">
                {part.totalQty} {part.unit}
              </dd>
            </div>
          </dl>

          <div className="space-y-1.5 border-t pt-3">
            <span className="text-xs text-muted-foreground">Kompatibel dengan</span>
            {categories.length === 0 && part.compatibleEquipment.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">Belum ada data kompatibilitas.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <Badge key={c} variant="outline">
                    {CATEGORY_LABELS[c]}
                  </Badge>
                ))}
                {part.compatibleEquipment.map((eq) => (
                  <Link key={eq.id} href={`/equipment/${eq.id}`}>
                    <Badge variant="outline" className="hover:bg-muted">
                      {eq.code}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top units */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" />
            Unit Paling Sering Memakai
          </CardTitle>
        </CardHeader>
        <CardContent>
          {part.topUnits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Part ini belum pernah dipakai. Pemakaian tercatat otomatis saat teknisi menambahkan
              part di tab Part Usage pada Work Order.
            </p>
          ) : (
            <ol className="divide-y">
              {part.topUnits.map((u, i) => (
                <li key={u.equipmentId}>
                  <Link
                    href={`/equipment/${u.equipmentId}`}
                    className="flex min-h-11 items-center gap-3 py-2.5 hover:bg-muted/50"
                  >
                    <span className="w-6 shrink-0 text-center text-sm font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm font-bold">{u.code}</div>
                      <div className="truncate text-xs text-muted-foreground">{u.name}</div>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <div className="font-semibold">{u.usageCount}x pakai</div>
                      <div className="text-muted-foreground">
                        {u.totalQty} {part.unit} · {formatDateIndo(u.lastUsedAt)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Usage history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Riwayat Pemakaian
          </CardTitle>
          {part.usageCount > part.usages.length && (
            <p className="text-xs text-muted-foreground">
              Menampilkan {part.usages.length} pemakaian terbaru dari {part.usageCount}.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {part.usages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada riwayat pemakaian. Tambahkan part ini dari tab Part Usage di detail Work
              Order.
            </p>
          ) : (
            <>
              {/* Mobile cards */}
              <ul className="space-y-3 md:hidden">
                {part.usages.map((u) => (
                  <li key={u.id}>
                    <Link
                      href={`/work-order/${u.workOrder.id}`}
                      className="block rounded-lg border p-3 hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-sm font-bold">{u.workOrder.code}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {u.workOrder.equipment.code} · {u.workOrder.equipment.name}
                          </div>
                        </div>
                        <Badge variant={WO_STATUS_CONFIG[u.workOrder.status].variant} className="shrink-0">
                          {WO_STATUS_CONFIG[u.workOrder.status].label}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatDateTimeIndo(u.usedAt)}</span>
                        <span className="font-semibold text-foreground">
                          {u.qty} {part.unit}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Work Order</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {part.usages.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTimeIndo(u.usedAt)}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/work-order/${u.workOrder.id}`}
                            className="font-mono text-sm font-semibold text-primary hover:underline"
                          >
                            {u.workOrder.code}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/equipment/${u.workOrder.equipment.id}`} className="hover:underline">
                            <div className="font-mono text-sm font-semibold">
                              {u.workOrder.equipment.code}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {u.workOrder.equipment.name}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{WO_TYPE_LABELS[u.workOrder.type]}</TableCell>
                        <TableCell>
                          <Badge variant={WO_STATUS_CONFIG[u.workOrder.status].variant}>
                            {WO_STATUS_CONFIG[u.workOrder.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {u.qty} {part.unit}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
