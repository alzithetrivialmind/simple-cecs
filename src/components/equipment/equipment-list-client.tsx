"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { canAccessReports } from "@/lib/roles";
import Link from "next/link";
import {
  EquipmentCategory,
  EquipmentStatus,
  Ownership,
} from "@prisma/client";
import {
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  QrCode,
  MapPin,
  Gauge,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { CATEGORY_LABELS, EQUIPMENT_STATUS } from "@/lib/labels";
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

export interface EquipmentItem {
  id: string;
  code: string;
  name: string;
  category: EquipmentCategory;
  status: EquipmentStatus;
  ownership: Ownership;
  model: string | null;
  manufacturer: string | null;
  currentHourMeter: number;
  photoUrl: string | null;
  department: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
}

interface EquipmentListClientProps {
  initialItems: EquipmentItem[];
  departments: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  userRole?: string;
}


export function EquipmentListClient({
  initialItems,
  departments,
  locations,
  userRole,
}: EquipmentListClientProps) {
  const [search, setSearch] = React.useState("");
  const searchParams = useSearchParams();
  const [categoryFilter, setCategoryFilter] = React.useState<string>(searchParams.get("category") || "ALL");
  const [statusFilter, setStatusFilter] = React.useState<string>(searchParams.get("status") || "ALL");
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("ALL");
  const [locationFilter, setLocationFilter] = React.useState<string>("ALL");

  const canEdit = userRole === "ADMIN" || userRole === "SUPERVISOR";

  const filteredItems = initialItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      (item.model && item.model.toLowerCase().includes(search.toLowerCase())) ||
      (item.manufacturer &&
        item.manufacturer.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory =
      categoryFilter === "ALL" || item.category === categoryFilter;

    const matchesStatus =
      statusFilter === "ALL" ||
      item.status === statusFilter ||
      (statusFilter === "DOWN" && (item.status === "BREAKDOWN" || item.status === "UNDER_REPAIR"));

    const matchesDepartment =
      departmentFilter === "ALL" || item.department?.id === departmentFilter;

    const matchesLocation =
      locationFilter === "ALL" || item.location?.id === locationFilter;

    return (
      matchesSearch &&
      matchesCategory &&
      matchesStatus &&
      matchesDepartment &&
      matchesLocation
    );
  });

  const hasFilter =
    search !== "" ||
    categoryFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    departmentFilter !== "ALL" ||
    locationFilter !== "ALL";

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("ALL");
    setStatusFilter("ALL");
    setDepartmentFilter("ALL");
    setLocationFilter("ALL");
  };

  const emptyState =
    initialItems.length === 0 ? (
      <div className="px-4 py-12 text-center">
        <p className="font-medium">Belum ada unit terdaftar.</p>
        <p className="mt-1 text-sm text-muted-foreground">Impor dari Excel atau tambah satu per satu.</p>
        {canEdit && (
          <div className="mt-4 flex justify-center gap-2">
            <Button asChild>
              <Link href="/equipment/import">Impor Excel</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/equipment/new">Tambah unit</Link>
            </Button>
          </div>
        )}
      </div>
    ) : (
      <div className="px-4 py-12 text-center">
        <p className="font-medium">Tidak ada unit yang cocok dengan filter.</p>
        <Button variant="outline" className="mt-3" onClick={resetFilters}>
          Hapus filter
        </Button>
      </div>
    );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Equipment"
        meta={
          filteredItems.length === initialItems.length
            ? `${initialItems.length} unit`
            : `${filteredItems.length} dari ${initialItems.length} unit`
        }
        actions={
          <>
            {canEdit && (
              <Button asChild className="h-11">
                <Link href="/equipment/new">
                  <Plus className="h-4 w-4" />
                  Tambah unit
                </Link>
              </Button>
            )}
            {canEdit && (
              <Button asChild variant="outline" className="h-11">
                <Link href="/equipment/import">
                  <FileSpreadsheet className="h-4 w-4" />
                  Impor Excel
                </Link>
              </Button>
            )}
            {/* Ekspor hanya untuk manajemen; endpoint-nya juga dijaga REPORT_ROLES */}
            {canAccessReports(userRole) && (
              <Button asChild variant="outline" className="hidden h-11 md:inline-flex">
                <a href="/api/export/equipment" download>
                  <Download className="h-4 w-4" />
                  Ekspor
                </a>
              </Button>
            )}
            <Button asChild variant="outline" className="hidden h-11 md:inline-flex">
              <Link href="/equipment/qr">
                <QrCode className="h-4 w-4" />
                Cetak QR
              </Link>
            </Button>
          </>
        }
      />

      {/* Pencarian + filter */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <div className="relative col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cari kode, nama, merk"
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
            <SelectItem value="DOWN">Rusak atau perbaikan</SelectItem>
            {(Object.keys(EQUIPMENT_STATUS) as EquipmentStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {EQUIPMENT_STATUS[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-11" aria-label="Kategori">
            <SelectValue placeholder="Semua kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua kategori</SelectItem>
            {(Object.keys(CATEGORY_LABELS) as EquipmentCategory[]).map((key) => (
              <SelectItem key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="h-11" aria-label="Lokasi">
            <SelectValue placeholder="Semua lokasi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua lokasi</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="h-11" aria-label="Departemen">
            <SelectValue placeholder="Semua dept." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua dept.</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
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

      {/* HP: daftar baris dengan strip status di kiri */}
      <div className="overflow-hidden rounded-lg border bg-card md:hidden">
        {filteredItems.length === 0 ? (
          emptyState
        ) : (
          <ul className="divide-y">
            {filteredItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/equipment/${item.id}`}
                  className="relative flex items-center gap-3 py-3 pl-4 pr-3 active:bg-muted"
                >
                  <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", STATUS_STRIP[item.status])} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-condensed text-lg font-bold leading-tight">{item.code}</span>
                      <StatusBadge kind="equipment" status={item.status} />
                    </div>
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex min-w-0 items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.location?.name || "Lokasi belum diisi"}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 tabular-nums">
                        <Gauge className="h-3.5 w-3.5" />
                        {item.currentHourMeter.toLocaleString("id-ID")} jam
                      </span>
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tablet/desktop: tabel */}
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        {filteredItems.length === 0 ? (
          emptyState
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Kode</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Kategori</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead className="hidden xl:table-cell">Departemen</TableHead>
                <TableHead className="text-right">Hour meter</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-condensed text-base font-bold">
                    <Link href={`/equipment/${item.id}`} className="hover:underline">
                      {item.code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/equipment/${item.id}`} className="font-medium hover:underline">
                      {item.name}
                    </Link>
                    {(item.manufacturer || item.model) && (
                      <div className="text-xs text-muted-foreground">
                        {[item.manufacturer, item.model].filter(Boolean).join(" ")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="equipment" status={item.status} />
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {CATEGORY_LABELS[item.category]}
                  </TableCell>
                  <TableCell className="text-sm">{item.location?.name || "-"}</TableCell>
                  <TableCell className="hidden text-sm xl:table-cell">{item.department?.name || "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.currentHourMeter.toLocaleString("id-ID")}{" "}
                    <span className="text-xs text-muted-foreground">jam</span>
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

const STATUS_STRIP: Record<EquipmentStatus, string> = {
  READY: "bg-green-700",
  IN_USE: "bg-green-500",
  STANDBY: "bg-gray-400",
  BREAKDOWN: "bg-red-600",
  UNDER_REPAIR: "bg-orange-500",
  SCRAPPED: "bg-gray-800",
};
