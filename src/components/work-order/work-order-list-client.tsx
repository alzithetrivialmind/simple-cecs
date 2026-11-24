"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { canInputData } from "@/lib/roles";
import {
  WorkOrderStatus,
  WorkOrderType,
  Priority,
  EquipmentCategory,
} from "@prisma/client";
import {
  Search,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { WORK_ORDER_STATUS, WORK_ORDER_TYPE } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTimeIndo } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";

export interface WorkOrderItem {
  id: string;
  code: string;
  type: WorkOrderType;
  status: WorkOrderStatus;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  closedAt: Date | null;
  downtimeMinutes: number | null;
  externalServiceBy: string | null;
  equipment: {
    id: string;
    code: string;
    name: string;
    category: EquipmentCategory;
    location: { id: string; name: string } | null;
  };
  assignedTo: {
    id: string;
    name: string;
    nik: string;
    avatarUrl?: string | null;
  } | null;
  breakdownRequest: {
    id: string;
    code: string;
    problem: string;
    priority: Priority;
    reportedAt: Date;
  } | null;
  pmPlan: {
    id: string;
    pmType: { name: string };
  } | null;
  diagnosis: {
    finding: string;
    rootCause: string;
  } | null;
  repairResult: {
    correctiveAction: string;
  } | null;
}

interface TechnicianOption {
  id: string;
  name: string;
  nik: string;
}

interface WorkOrderListClientProps {
  initialItems: WorkOrderItem[];
  technicians: TechnicianOption[];
  userRole?: string;
}

const STATUS_STRIP: Record<WorkOrderStatus, string> = {
  OPEN: "bg-blue-600",
  WAITING_PART: "bg-yellow-400",
  IN_PROGRESS: "bg-orange-500",
  DONE: "bg-green-700",
  CLOSED: "bg-gray-300",
};

function summary(item: WorkOrderItem): string {
  return (
    item.breakdownRequest?.problem ||
    item.diagnosis?.finding ||
    item.pmPlan?.pmType?.name ||
    WORK_ORDER_TYPE[item.type]
  );
}

function assignee(item: WorkOrderItem): string {
  return item.assignedTo?.name || item.externalServiceBy || "Belum ditugaskan";
}

export function WorkOrderListClient({
  initialItems,
  technicians,
  userRole,
}: WorkOrderListClientProps) {
  const [search, setSearch] = React.useState("");
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = React.useState<string>(searchParams.get("status") || "ALL");
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");
  const [techFilter, setTechFilter] = React.useState<string>("ALL");

  const canCreate =
    userRole === "ADMIN" ||
    userRole === "SUPERVISOR" ||
    userRole === "TECHNICIAN";

  const filteredItems = initialItems.filter((item) => {
    const s = search.toLowerCase();
    const matchesSearch =
      item.code.toLowerCase().includes(s) ||
      item.equipment.name.toLowerCase().includes(s) ||
      item.equipment.code.toLowerCase().includes(s) ||
      (item.assignedTo && item.assignedTo.name.toLowerCase().includes(s)) ||
      (item.breakdownRequest && item.breakdownRequest.problem.toLowerCase().includes(s));

    const matchesStatus =
      statusFilter === "ALL" ||
      item.status === statusFilter ||
      (statusFilter === "ACTIVE" && item.status !== "DONE" && item.status !== "CLOSED");
    const matchesType = typeFilter === "ALL" || item.type === typeFilter;
    const matchesTech = techFilter === "ALL" || item.assignedTo?.id === techFilter;

    return matchesSearch && matchesStatus && matchesType && matchesTech;
  });

  const hasFilter = search !== "" || statusFilter !== "ALL" || typeFilter !== "ALL" || techFilter !== "ALL";
  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setTechFilter("ALL");
  };

  const emptyState =
    initialItems.length === 0 ? (
      <div className="px-4 py-12 text-center">
        <p className="font-medium">Belum ada work order.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Work order korektif dibuat otomatis saat kerusakan dilaporkan.
        </p>
        {canInputData(userRole) && (
          <Button asChild className="mt-4 bg-red-600 hover:bg-red-700">
            <Link href="/breakdown/new">Lapor kerusakan</Link>
          </Button>
        )}
      </div>
    ) : (
      <div className="px-4 py-12 text-center">
        <p className="font-medium">Tidak ada work order yang cocok dengan filter.</p>
        <Button variant="outline" className="mt-3" onClick={resetFilters}>
          Hapus filter
        </Button>
      </div>
    );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Work order"
        meta={
          filteredItems.length === initialItems.length
            ? `${initialItems.length} work order`
            : `${filteredItems.length} dari ${initialItems.length} work order`
        }
        actions={
          canCreate && (
            <Button asChild className="h-11">
              <Link href="/work-order/new">
                <Plus className="h-4 w-4" />
                Buat work order
              </Link>
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="relative col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cari nomor WO, unit, teknisi"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11" aria-label="Status">
            <SelectValue placeholder="Semua status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua status</SelectItem>
            <SelectItem value="ACTIVE">Masih aktif</SelectItem>
            {(Object.keys(WORK_ORDER_STATUS) as WorkOrderStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {WORK_ORDER_STATUS[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-11" aria-label="Tipe">
            <SelectValue placeholder="Semua tipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua tipe</SelectItem>
            {(Object.keys(WORK_ORDER_TYPE) as WorkOrderType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {WORK_ORDER_TYPE[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={techFilter} onValueChange={setTechFilter}>
          <SelectTrigger className="col-span-2 h-11 lg:col-span-1" aria-label="Teknisi">
            <SelectValue placeholder="Semua teknisi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua teknisi</SelectItem>
            {technicians.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilter && filteredItems.length > 0 && (
        <button type="button" onClick={resetFilters} className="text-sm font-medium text-primary underline">
          Hapus filter
        </button>
      )}

      {/* HP: baris dengan strip status */}
      <div className="overflow-hidden rounded-lg border bg-card md:hidden">
        {filteredItems.length === 0 ? (
          emptyState
        ) : (
          <ul className="divide-y">
            {filteredItems.map((item) => (
              <li key={item.id}>
                <Link href={`/work-order/${item.id}`} className="relative block py-3 pl-4 pr-3 active:bg-muted">
                  <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", STATUS_STRIP[item.status])} />
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-condensed text-lg font-bold leading-tight">{item.equipment.code}</span>
                    <StatusBadge kind="workOrder" status={item.status} />
                  </div>
                  <p className="line-clamp-2 text-sm">{summary(item)}</p>
                  <p className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="truncate">
                      {item.code}, {assignee(item)}
                    </span>
                    <span className="shrink-0">{formatDateTimeIndo(item.createdAt)}</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tablet/desktop */}
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        {filteredItems.length === 0 ? (
          emptyState
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Nomor</TableHead>
                <TableHead>Unit dan masalah</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Tipe</TableHead>
                <TableHead>Teknisi</TableHead>
                <TableHead className="hidden xl:table-cell">Dibuat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-condensed text-base font-bold">
                    <Link href={`/work-order/${item.id}`} className="hover:underline">
                      {item.code}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[360px]">
                    <Link href={`/work-order/${item.id}`} className="font-medium hover:underline">
                      {item.equipment.code} {item.equipment.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{summary(item)}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="workOrder" status={item.status} />
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">{WORK_ORDER_TYPE[item.type]}</TableCell>
                  <TableCell className="text-sm">
                    {item.assignedTo ? (
                      <span className="flex items-center gap-2">
                        <UserAvatar
                          src={item.assignedTo.avatarUrl}
                          name={item.assignedTo.name}
                          nik={item.assignedTo.nik}
                          size="xs"
                          className="shrink-0"
                        />
                        <span className="truncate">{item.assignedTo.name}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{assignee(item)}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                    {formatDateTimeIndo(item.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
