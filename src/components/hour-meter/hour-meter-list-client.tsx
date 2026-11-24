"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeIndo } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { deleteHourMeter } from "@/server/actions/hour-meter";
import { toast } from "sonner";

interface LogItem {
  id: string;
  readingDate: Date;
  hourMeter: number;
  source: string;
  remark: string | null;
  equipment: {
    id: string;
    code: string;
    name: string;
    category: string;
    currentHourMeter: number;
  };
  createdBy: {
    id: string;
    name: string;
    nik: string;
    role: string;
    avatarUrl?: string | null;
  };
}

interface HourMeterListClientProps {
  initialLogs: LogItem[];
  userRole?: string;
}

export function HourMeterListClient({
  initialLogs,
  userRole,
}: HourMeterListClientProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");

  const canCreate =
    userRole === "ADMIN" ||
    userRole === "SUPERVISOR" ||
    userRole === "TECHNICIAN";

  const canManage = userRole === "ADMIN";

  const handleDelete = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus catatan Hour Meter ini?")) {
      try {
        const res = await deleteHourMeter(id);
        if (res.success) {
          toast.success("Hour Meter berhasil dihapus.");
          router.refresh();
        } else {
          toast.error(res.error || "Gagal menghapus Hour Meter.");
        }
      } catch {
        toast.error("Terjadi kesalahan sistem");
      }
    }
  };

  const filteredLogs = initialLogs.filter((log) => {
    return (
      log.equipment.code.toLowerCase().includes(search.toLowerCase()) ||
      log.equipment.name.toLowerCase().includes(search.toLowerCase()) ||
      log.createdBy.name.toLowerCase().includes(search.toLowerCase()) ||
      log.createdBy.nik.toLowerCase().includes(search.toLowerCase()) ||
      (log.remark && log.remark.toLowerCase().includes(search.toLowerCase()))
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-condensed text-3xl font-bold leading-tight tracking-tight">Log hour meter</h1>
        </div>

        {canCreate && (
          <Link href="/hour-meter/new">
            <Button className="gap-2 h-11 min-h-[44px] shadow-sm">
              <Plus className="h-4 w-4" />
              Input Hour Meter
            </Button>
          </Link>
        )}
      </div>

      {/* Search Toolbar */}
      <div className="relative">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari berdasarkan kode unit, nama, teknisi pencatat, atau catatan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      {/* Mobile Card View (<768px) */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filteredLogs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Belum ada data log hour meter yang sesuai.
            </CardContent>
          </Card>
        ) : (
          filteredLogs.map((log) => (
            <Card key={log.id} className="border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-primary">
                      {log.equipment.code}
                    </span>
                    <h3 className="font-bold text-base text-foreground line-clamp-1">
                      {log.equipment.name}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-base text-blue-600 block">
                      {log.hourMeter.toLocaleString("id-ID")} Jam
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {log.source}
                    </Badge>
                  </div>
                </div>

                <div className="pt-2 border-t text-xs space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Waktu Catat:</span>
                    <span className="font-medium text-foreground">
                      {formatDateTimeIndo(log.readingDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span>Pencatat:</span>
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <UserAvatar
                        src={log.createdBy.avatarUrl}
                        name={log.createdBy.name}
                        nik={log.createdBy.nik}
                        size="xs"
                        className="shrink-0"
                      />
                      <span>{log.createdBy.name} ({log.createdBy.nik})</span>
                    </div>
                  </div>
                  {log.remark && (
                    <div className="pt-1 text-[11px] italic text-slate-600 dark:text-slate-400">
                      &quot;{log.remark}&quot;
                    </div>
                  )}
                  {canManage && (
                    <div className="pt-2 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(log.id)} className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3 w-3 mr-1" /> Hapus
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop Table View (>=768px) */}
      <div className="hidden md:block rounded-xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode Unit</TableHead>
              <TableHead>Nama Unit</TableHead>
              <TableHead>Hour Meter Tercatat</TableHead>
              <TableHead>Tanggal & Waktu</TableHead>
              <TableHead>Sumber Input</TableHead>
              <TableHead>Pencatat</TableHead>
              <TableHead>Keterangan</TableHead>
              {canManage && <TableHead className="text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Belum ada catatan log hour meter.
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono font-bold text-xs text-primary">
                    <Link
                      href={`/equipment/${log.equipment.id}`}
                      className="hover:underline"
                    >
                      {log.equipment.code}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium text-sm text-foreground">
                    <Link
                      href={`/equipment/${log.equipment.id}`}
                      className="hover:underline"
                    >
                      {log.equipment.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono font-bold text-sm text-foreground">
                    {log.hourMeter.toLocaleString("id-ID")} <span className="text-xs font-normal text-muted-foreground">Jam</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDateTimeIndo(log.readingDate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {log.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        src={log.createdBy.avatarUrl}
                        name={log.createdBy.name}
                        nik={log.createdBy.nik}
                        size="xs"
                        className="shrink-0 ring-1 ring-border"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-foreground leading-tight truncate">
                          {log.createdBy.name}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {log.createdBy.nik}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                    {log.remark || "-"}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(log.id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
