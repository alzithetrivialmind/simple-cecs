"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PmBasis, PmStatus, EquipmentCategory } from "@prisma/client";
import {
  Search,
  Plus,
  Play,
  ListChecks,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateIndo } from "@/lib/utils";
import { deletePmPlan } from "@/server/actions/pm";
import { toast } from "sonner";

export interface PmScheduleItem {
  id: string;
  basis: PmBasis;
  intervalHour: number | null;
  intervalDays: number | null;
  lastDoneHour: number | null;
  lastDoneDate: Date | null;
  nextDueHour: number | null;
  nextDueDate: Date | null;
  status: PmStatus;
  equipment: {
    id: string;
    code: string;
    name: string;
    category: EquipmentCategory;
    currentHourMeter: number;
    location: { id: string; name: string } | null;
    department: { id: string; name: string } | null;
  };
  pmType: {
    id: string;
    name: string;
  };
  executions: {
    id: string;
    hourMeter: number;
    executedAt: Date;
  }[];
}

interface PmScheduleClientProps {
  initialItems: PmScheduleItem[];
  userRole?: string;
}

export function PmScheduleClient({
  initialItems,
  userRole,
}: PmScheduleClientProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState<string>(searchParams.get("tab") || "OVERDUE");

  const canManage = userRole === "ADMIN";
  const canExecute = canManage || userRole === "SUPERVISOR" || userRole === "TECHNICIAN";

  const handleDelete = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus jadwal PM ini?")) {
      try {
        const res = await deletePmPlan(id);
        if (res.success) {
          toast.success("Jadwal PM berhasil dihapus.");
          router.refresh();
        } else {
          toast.error(res.error || "Gagal menghapus jadwal PM.");
        }
      } catch {
        toast.error("Terjadi kesalahan sistem");
      }
    }
  };

  const overdueItems = initialItems.filter((i) => i.status === PmStatus.OVERDUE);
  const dueItems = initialItems.filter((i) => i.status === PmStatus.DUE);
  const upcomingItems = initialItems.filter((i) => i.status === PmStatus.UPCOMING);

  const filterBySearch = (list: PmScheduleItem[]) => {
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter(
      (i) =>
        i.equipment.name.toLowerCase().includes(s) ||
        i.equipment.code.toLowerCase().includes(s) ||
        i.pmType.name.toLowerCase().includes(s)
    );
  };

  const getDisplayedItems = () => {
    let base = initialItems;
    if (activeTab === "OVERDUE") base = overdueItems;
    else if (activeTab === "DUE") base = dueItems;
    else if (activeTab === "UPCOMING") base = upcomingItems;
    return filterBySearch(base);
  };

  const displayedItems = getDisplayedItems();

  // "Sisa 80 jam" / "Lewat 3 hari": yang dibutuhkan mekanik, bukan rumus
  const dueText = (item: (typeof initialItems)[number]) => {
    if (item.basis === PmBasis.HOUR_METER && item.nextDueHour !== null) {
      const left = item.nextDueHour - item.equipment.currentHourMeter;
      const target = `${item.nextDueHour.toLocaleString("id-ID")} jam`;
      return left > 0 ? `Sisa ${left.toLocaleString("id-ID")} jam (di ${target})` : `Lewat ${Math.abs(left).toLocaleString("id-ID")} jam (target ${target})`;
    }
    if (item.nextDueDate) {
      const days = Math.ceil((new Date(item.nextDueDate).getTime() - Date.now()) / 86400000);
      const target = formatDateIndo(item.nextDueDate);
      return days > 0 ? `Sisa ${days} hari (${target})` : `Lewat ${Math.abs(days)} hari (${target})`;
    }
    return "-";
  };

  const emptyText: Record<string, string> = {
    OVERDUE: "Tidak ada PM yang terlambat.",
    DUE: "Tidak ada PM yang jatuh tempo dalam waktu dekat.",
    UPCOMING: "Belum ada jadwal PM terdaftar.",
    ALL: "Belum ada jadwal PM terdaftar.",
  };

  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        title="Preventive maintenance"
        actions={
          canManage && (
            <>
              <Button asChild variant="outline" className="h-11">
                <Link href="/preventive/templates">
                  <ListChecks className="h-4 w-4" />
                  Template checklist
                </Link>
              </Button>
              <Button asChild className="h-11">
                <Link href="/preventive/plan/new">
                  <Plus className="h-4 w-4" />
                  Atur jadwal
                </Link>
              </Button>
            </>
          )
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="flex h-12 w-full sm:grid sm:w-[520px] sm:grid-cols-4">
            <TabsTrigger value="OVERDUE" className="gap-1.5 data-[state=active]:bg-red-600 data-[state=active]:text-white">
              Terlambat
              <span className="tabular-nums">{overdueItems.length}</span>
            </TabsTrigger>
            <TabsTrigger value="DUE" className="gap-1.5 data-[state=active]:bg-orange-600 data-[state=active]:text-white">
              Jatuh tempo
              <span className="tabular-nums">{dueItems.length}</span>
            </TabsTrigger>
            <TabsTrigger value="UPCOMING" className="gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Terjadwal
              <span className="tabular-nums">{upcomingItems.length}</span>
            </TabsTrigger>
            <TabsTrigger value="ALL" className="gap-1.5">
              Semua
              <span className="tabular-nums">{initialItems.length}</span>
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari unit atau tipe PM"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 pl-9"
            />
          </div>
        </div>

        {/* HP: baris, terlambat berlatar merah muda (UI-SPEC) */}
        <div className="overflow-hidden rounded-lg border bg-card md:hidden">
          {displayedItems.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="font-medium">{search ? "Tidak ada jadwal yang cocok." : emptyText[activeTab]}</p>
              {canManage && !search && (activeTab === "UPCOMING" || activeTab === "ALL") && (
                <Button asChild className="mt-4">
                  <Link href="/preventive/plan/new">Atur jadwal PM</Link>
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-y">
              {displayedItems.map((item) => {
                const isOverdue = item.status === PmStatus.OVERDUE;
                return (
                  <li key={item.id} className={cn("relative py-3 pl-4 pr-3", isOverdue && "bg-red-50")}>
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-0 left-0 w-1",
                        isOverdue ? "bg-red-600" : item.status === PmStatus.DUE ? "bg-orange-500" : "bg-blue-600"
                      )}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/equipment/${item.equipment.id}`} className="font-condensed text-lg font-bold leading-tight hover:underline">
                        {item.equipment.code}
                      </Link>
                      <StatusBadge kind="pm" status={item.status} />
                    </div>
                    <p className="truncate text-sm font-medium">
                      {item.pmType.name}, {item.equipment.name}
                    </p>
                    <p className={cn("text-sm", isOverdue ? "font-semibold text-red-700" : "text-muted-foreground")}>
                      {dueText(item)}
                    </p>
                    <div className="mt-2 flex gap-2">
                      {canExecute && (
                        <Button asChild className="h-11 flex-1">
                          <Link href={`/preventive/execute/${item.id}`}>
                            <Play className="h-4 w-4" />
                            Eksekusi
                          </Link>
                        </Button>
                      )}
                      {canManage && (
                        <Button
                          variant="outline"
                          className="h-11 w-11 p-0 text-destructive"
                          onClick={() => handleDelete(item.id)}
                          aria-label={`Hapus jadwal PM ${item.equipment.code}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Desktop View (>=768px) */}
        <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Kode Unit</TableHead>
                <TableHead>Nama Unit</TableHead>
                <TableHead>Tipe PM</TableHead>
                <TableHead>Basis Interval</TableHead>
                <TableHead>HM / Tanggal Kini</TableHead>
                <TableHead>Target Jatuh Tempo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-36 text-center text-muted-foreground">
                    Tidak ada jadwal PM yang sesuai.
                  </TableCell>
                </TableRow>
              ) : (
                displayedItems.map((item) => {
                  const isOverdue = item.status === PmStatus.OVERDUE;
                  const isDue = item.status === PmStatus.DUE;

                  return (
                    <TableRow
                      key={item.id}
                      className={`hover:bg-muted/40 ${
                        isOverdue ? "bg-red-50/20 dark:bg-red-950/10" : ""
                      }`}
                    >
                      <TableCell className="font-mono font-bold text-xs text-primary">
                        <Link
                          href={`/equipment/${item.equipment.id}`}
                          className="hover:underline"
                        >
                          {item.equipment.code}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium text-sm text-foreground">
                        <Link
                          href={`/equipment/${item.equipment.id}`}
                          className="hover:underline"
                        >
                          {item.equipment.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs font-semibold">
                        PM {item.pmType.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.basis === PmBasis.HOUR_METER
                          ? `${item.intervalHour} Jam (Hour Meter)`
                          : `${item.intervalDays} Hari (Kalender)`}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.basis === PmBasis.HOUR_METER ? (
                          <span>{item.equipment.currentHourMeter.toLocaleString("id-ID")} Jam</span>
                        ) : (
                          <span>Hari Ini</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-xs">
                        {item.basis === PmBasis.HOUR_METER ? (
                          <span
                            className={
                              isOverdue
                                ? "text-red-600 dark:text-red-400"
                                : isDue
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-foreground"
                            }
                          >
                            {item.nextDueHour?.toLocaleString("id-ID")} Jam
                          </span>
                        ) : item.nextDueDate ? (
                          <span
                            className={
                              isOverdue
                                ? "text-red-600 dark:text-red-400"
                                : isDue
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-foreground"
                            }
                          >
                            {formatDateIndo(item.nextDueDate)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="pm" status={item.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canManage && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          {canExecute && (
                            <Link href={`/preventive/execute/${item.id}`}>
                              <Button
                                size="sm"
                                className={`h-8 gap-1 text-xs font-semibold ${
                                  isOverdue
                                    ? "bg-red-600 hover:bg-red-700 text-white"
                                    : isDue
                                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                                    : ""
                                }`}
                              >
                                <Play className="h-3 w-3" />
                                Eksekusi
                              </Button>
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Tabs>
    </div>
  );
}
