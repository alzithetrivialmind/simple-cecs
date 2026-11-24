"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTimeIndo } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  Search,
  RotateCcw,
  LogIn,
  LogOut,
  PlusCircle,
  Edit3,
  Trash2,
  Eye,
  RefreshCw,
  Info,
  Computer,
  Globe,
} from "lucide-react";

interface AuditLogRecord {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  at: Date | string;
  user: {
    id: string;
    name: string;
    nik: string;
    role: string;
    avatarUrl?: string | null;
  } | null;
}

interface UserOption {
  id: string;
  name: string;
  nik: string;
  role: string;
}

interface AuditLogClientProps {
  initialLogs: AuditLogRecord[];
  total: number;
  currentPage: number;
  totalPages: number;
  users: UserOption[];
}

export function AuditLogClient({
  initialLogs,
  total,
  currentPage,
  totalPages,
  users,
}: AuditLogClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filters state
  const [search, setSearch] = React.useState(searchParams.get("search") || "");
  const [action, setAction] = React.useState(searchParams.get("action") || "ALL");
  const [entity, setEntity] = React.useState(searchParams.get("entity") || "ALL");
  const [userId, setUserId] = React.useState(searchParams.get("userId") || "ALL");
  const [startDate, setStartDate] = React.useState(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = React.useState(searchParams.get("endDate") || "");

  // Detail modal state
  const [selectedLog, setSelectedLog] = React.useState<AuditLogRecord | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const applyFilters = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1"); // Reset to page 1 on filter change

    Object.entries(newParams).forEach(([key, val]) => {
      if (!val || val === "ALL") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({ search: search.trim() });
  };

  const handleResetFilters = () => {
    setSearch("");
    setAction("ALL");
    setEntity("ALL");
    setUserId("ALL");
    setStartDate("");
    setEndDate("");
    startTransition(() => {
      router.push(pathname);
    });
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const renderActionBadge = (act: string) => {
    switch (act) {
      case "LOGIN":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-semibold">
            <LogIn className="h-3 w-3" /> LOGIN
          </Badge>
        );
      case "LOGOUT":
        return (
          <Badge className="bg-slate-600 hover:bg-slate-700 text-white gap-1 font-semibold">
            <LogOut className="h-3 w-3" /> LOGOUT
          </Badge>
        );
      case "CREATE":
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white gap-1 font-semibold">
            <PlusCircle className="h-3 w-3" /> TAMBAH
          </Badge>
        );
      case "UPDATE":
        return (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white gap-1 font-semibold">
            <Edit3 className="h-3 w-3" /> UBAH
          </Badge>
        );
      case "STATUS_CHANGE":
        return (
          <Badge className="bg-purple-600 hover:bg-purple-700 text-white gap-1 font-semibold">
            <RefreshCw className="h-3 w-3" /> STATUS
          </Badge>
        );
      case "DELETE":
        return (
          <Badge className="bg-rose-600 hover:bg-rose-700 text-white gap-1 font-semibold">
            <Trash2 className="h-3 w-3" /> HAPUS
          </Badge>
        );
      case "VIEW":
        return (
          <Badge variant="outline" className="text-muted-foreground border-border gap-1 font-medium">
            <Eye className="h-3 w-3" /> LIHAT
          </Badge>
        );
      default:
        return <Badge variant="secondary">{act}</Badge>;
    }
  };

  const tryFormatJson = (val: string | null) => {
    if (!val) return null;
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return val;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-condensed text-3xl font-bold leading-tight tracking-tight">Audit log</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-lg border border-border">
          <span>Total Tercatat:</span>
          <span className="font-bold text-foreground">{total.toLocaleString("id-ID")}</span>
          <span>Aktivitas</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ID entitas, nama staf, NIK, alasan perubahan, atau keterangan..."
              className="pl-9 h-10"
            />
          </div>
          <Button type="submit" disabled={isPending} className="shrink-0">
            {isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            Cari Log
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleResetFilters}
            disabled={isPending}
            className="shrink-0"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-border/60">
          {/* Action Filter */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
              Jenis Aksi
            </label>
            <Select
              value={action}
              onValueChange={(val) => {
                setAction(val);
                applyFilters({ action: val });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Semua Aksi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Aksi</SelectItem>
                <SelectItem value="LOGIN">LOGIN (Masuk Sesi)</SelectItem>
                <SelectItem value="LOGOUT">LOGOUT (Keluar)</SelectItem>
                <SelectItem value="CREATE">CREATE (Tambah Data)</SelectItem>
                <SelectItem value="UPDATE">UPDATE (Perubahan Nilai)</SelectItem>
                <SelectItem value="STATUS_CHANGE">STATUS_CHANGE (Status)</SelectItem>
                <SelectItem value="DELETE">DELETE (Penghapusan)</SelectItem>
                <SelectItem value="VIEW">VIEW (Akses Halaman)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Entity Filter */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
              Modul / Entitas
            </label>
            <Select
              value={entity}
              onValueChange={(val) => {
                setEntity(val);
                applyFilters({ entity: val });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Semua Modul" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Modul</SelectItem>
                <SelectItem value="Auth">Auth (Autentikasi)</SelectItem>
                <SelectItem value="User">User (Karyawan)</SelectItem>
                <SelectItem value="Equipment">Equipment (Unit Alat)</SelectItem>
                <SelectItem value="WorkOrder">WorkOrder (Perbaikan)</SelectItem>
                <SelectItem value="BreakdownRequest">BreakdownRequest (Kerusakan)</SelectItem>
                <SelectItem value="HourMeterLog">HourMeterLog (HM Unit)</SelectItem>
                <SelectItem value="Master">Master Data</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User Filter */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
              Pengguna
            </label>
            <Select
              value={userId}
              onValueChange={(val) => {
                setUserId(val);
                applyFilters({ userId: val });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Semua Pengguna" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Pengguna</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.nik})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
              Tanggal Mulai
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                applyFilters({ startDate: e.target.value });
              }}
              className="h-9"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
              Tanggal Akhir
            </label>
            <Input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => {
                setEndDate(e.target.value);
                applyFilters({ endDate: e.target.value });
              }}
              className="h-9"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[180px]">Waktu (WIB)</TableHead>
                <TableHead className="w-[200px]">Pengguna</TableHead>
                <TableHead className="w-[120px]">Aksi</TableHead>
                <TableHead className="w-[150px]">Modul / ID</TableHead>
                <TableHead>Keterangan & Alasan Perubahan</TableHead>
                <TableHead className="w-[100px] text-right">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Tidak ada catatan aktivitas yang cocok dengan kriteria pencarian.
                  </TableCell>
                </TableRow>
              ) : (
                initialLogs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    {/* Timestamp */}
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTimeIndo(log.at)}
                    </TableCell>

                    {/* User */}
                    <TableCell>
                      {log.user ? (
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            src={log.user.avatarUrl}
                            name={log.user.name}
                            nik={log.user.nik}
                            size="sm"
                            className="shrink-0 ring-1 ring-border"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-sm text-foreground leading-tight truncate">
                              {log.user.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono">{log.user.nik}</span>
                              <span className="text-primary font-semibold">[{log.user.role}]</span>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sistem / Anonim</span>
                      )}
                    </TableCell>

                    {/* Action */}
                    <TableCell>{renderActionBadge(log.action)}</TableCell>

                    {/* Entity & ID */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-foreground">
                          {log.entity}
                        </span>
                        {log.entityId && (
                          <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[140px]">
                            {log.entityId}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Reason & Details */}
                    <TableCell>
                      <div className="flex flex-col space-y-0.5 max-w-xl">
                        {log.reason && (
                          <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span className="line-clamp-1">{log.reason}</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {log.details ||
                            (log.field
                              ? `Mengubah field '${log.field}': '${log.oldValue ?? "-"}' -> '${log.newValue ?? "-"}'`
                              : log.newValue || "Aktivitas tercatat")}
                        </p>
                      </div>
                    </TableCell>

                    {/* Detail Button */}
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Info className="h-3.5 w-3.5 mr-1" />
                        Detail
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
            <div>
              Menampilkan halaman <span className="font-semibold text-foreground">{currentPage}</span> dari{" "}
              <span className="font-semibold text-foreground">{totalPages}</span> ({total} total)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isPending}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || isPending}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedLog && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  {renderActionBadge(selectedLog.action)}
                  <span className="text-xs font-mono text-muted-foreground">
                    ID: {selectedLog.id}
                  </span>
                </div>
                <DialogTitle className="text-lg font-bold">
                  Detail Rekam Jejak Aktivitas
                </DialogTitle>
                <DialogDescription>
                  Waktu: {formatDateTimeIndo(selectedLog.at)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3 text-sm">
                {/* User & Network Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/40 p-3 rounded-lg border border-border/80">
                  <div>
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      Pelaksana Aktivitas
                    </span>
                    {selectedLog.user ? (
                      <div className="mt-1.5 flex items-center gap-3">
                        <UserAvatar
                          src={selectedLog.user.avatarUrl}
                          name={selectedLog.user.name}
                          nik={selectedLog.user.nik}
                          size="md"
                          className="shrink-0 ring-1 ring-border"
                        />
                        <div>
                          <div className="font-bold text-foreground leading-tight">{selectedLog.user.name}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">
                            NIK: {selectedLog.user.nik} | <span className="text-primary font-semibold">[{selectedLog.user.role}]</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic mt-1">Sistem / Unregistered</div>
                    )}
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      Jaringan & Perangkat
                    </span>
                    <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                        {/* Jangan menampilkan 127.0.0.1 sebagai pengganti nilai
                            kosong: kolom ini dipakai untuk mendiagnosis apakah
                            reverse proxy meneruskan IP asli, sehingga nilai
                            palsu justru menyesatkan. */}
                        <span>IP: {selectedLog.ipAddress || "tidak diketahui"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <Computer className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate" title={selectedLog.userAgent || "-"}>
                          {selectedLog.userAgent || "Desktop Browser"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Target Information */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground block">
                    Target Modul & Objek
                  </span>
                  <div className="p-3 bg-card border border-border rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground">Modul: </span>
                      <span className="font-bold text-foreground">{selectedLog.entity}</span>
                    </div>
                    {selectedLog.entityId && (
                      <div>
                        <span className="text-xs text-muted-foreground">Target ID: </span>
                        <span className="font-mono text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
                          {selectedLog.entityId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reason & Cause of Change */}
                {selectedLog.reason && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-amber-600 block">
                      Alasan / Penyebab Perubahan
                    </span>
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-foreground font-medium">
                      {selectedLog.reason}
                    </div>
                  </div>
                )}

                {/* Description / Summary */}
                {selectedLog.details && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      Keterangan Lengkap
                    </span>
                    <div className="p-3 bg-muted/40 border border-border rounded-lg text-sm text-foreground whitespace-pre-wrap">
                      {selectedLog.details}
                    </div>
                  </div>
                )}

                {/* Data Diff (Old Value vs New Value) */}
                {(selectedLog.oldValue || selectedLog.newValue) && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      Perbandingan Perubahan Data (Diff)
                    </span>

                    {selectedLog.field && (
                      <div className="text-xs text-muted-foreground">
                        Field yang dimodifikasi: <span className="font-mono font-bold text-foreground">{selectedLog.field}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Old Value */}
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-rose-600 block">
                          Nilai Sebelum (Old Value)
                        </span>
                        <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-md font-mono text-xs text-foreground overflow-x-auto max-h-48 whitespace-pre">
                          {tryFormatJson(selectedLog.oldValue) || "(Kosong / Null)"}
                        </div>
                      </div>

                      {/* New Value */}
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-emerald-600 block">
                          Nilai Sesudah (New Value)
                        </span>
                        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md font-mono text-xs text-foreground overflow-x-auto max-h-48 whitespace-pre">
                          {tryFormatJson(selectedLog.newValue) || "(Kosong / Null)"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <Button variant="outline" onClick={() => setSelectedLog(null)}>
                  Tutup
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
