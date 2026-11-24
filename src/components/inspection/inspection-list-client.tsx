"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ClipboardCheck,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  Gauge,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InspectionResult } from "@prisma/client";
import { formatDate } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";

interface InspectionItem {
  id: string;
  code: string;
  inspectionDate: Date;
  hourMeter: number;
  result: InspectionResult;
  finding: string | null;
  recommendation: string | null;
  certificateNumber: string | null;
  validUntil: Date | null;
  equipment: {
    id: string;
    code: string;
    name: string;
    category: string;
    location?: { id: string; name: string } | null;
    department?: { id: string; name: string } | null;
  };
  inspectionType: {
    id: string;
    name: string;
  };
  inspector: {
    id: string;
    name: string;
    nik: string;
    avatarUrl?: string | null;
  };
}

interface InspectionListClientProps {
  inspections: InspectionItem[];
  inspectionTypes: { id: string; name: string }[];
}

export function InspectionListClient({
  inspections,
  inspectionTypes,
}: InspectionListClientProps) {
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(searchParams.get("search") || "");
  const [resultFilter, setResultFilter] = React.useState<string>(
    searchParams.get("result") || "ALL"
  );
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");

  const filteredInspections = React.useMemo(() => {
    return inspections.filter((ins) => {
      // Result filter
      if (resultFilter !== "ALL" && ins.result !== resultFilter) return false;

      // Type filter
      if (typeFilter !== "ALL" && ins.inspectionType.id !== typeFilter) return false;

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchCode = ins.code.toLowerCase().includes(q);
        const matchEq =
          ins.equipment.code.toLowerCase().includes(q) ||
          ins.equipment.name.toLowerCase().includes(q);
        const matchType = ins.inspectionType.name.toLowerCase().includes(q);
        const matchCert = ins.certificateNumber?.toLowerCase().includes(q);
        const matchInspector = ins.inspector.name.toLowerCase().includes(q);

        if (!matchCode && !matchEq && !matchType && !matchCert && !matchInspector) {
          return false;
        }
      }

      return true;
    });
  }, [inspections, resultFilter, typeFilter, search]);

  const getResultBadge = (res: InspectionResult) => {
    switch (res) {
      case InspectionResult.PASS:
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Lulus
          </Badge>
        );
      case InspectionResult.PASS_WITH_REMARK:
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            LULUS DENGAN CATATAN
          </Badge>
        );
      case InspectionResult.FAIL:
        return (
          <Badge className="bg-red-600 hover:bg-red-700 text-white gap-1 font-medium">
            <XCircle className="w-3.5 h-3.5" />
            Gagal
          </Badge>
        );
    }
  };

  const getCertStatus = (validUntil: Date | null) => {
    if (!validUntil) return null;
    const now = new Date();
    const expiry = new Date(validUntil);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
          Kedaluwarsa
        </span>
      );
    } else if (diffDays <= 30) {
      return (
        <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          Sisa {diffDays} hari
        </span>
      );
    } else {
      return (
        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          Aktif
        </span>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari kode inspeksi, unit, tipe, sertifikat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="Hasil Inspeksi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Hasil</SelectItem>
                <SelectItem value={InspectionResult.PASS}>Lulus</SelectItem>
                <SelectItem value={InspectionResult.PASS_WITH_REMARK}>
                  Lulus dgn Catatan
                </SelectItem>
                <SelectItem value={InspectionResult.FAIL}>Gagal</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="Tipe Inspeksi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Tipe</SelectItem>
                {inspectionTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button asChild className="shrink-0 gap-2">
          <Link href="/inspection/new">
            <Plus className="w-4 h-4" />
            Input Inspeksi Baru
          </Link>
        </Button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-card border rounded-xl shadow-sm">
          <div className="text-xs font-medium text-muted-foreground">Total Inspeksi</div>
          <div className="text-2xl font-bold mt-1">{inspections.length}</div>
        </div>
        <div className="p-3.5 bg-card border rounded-xl shadow-sm border-l-4 border-l-emerald-500">
          <div className="text-xs font-medium text-muted-foreground">Lulus</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">
            {inspections.filter((i) => i.result === InspectionResult.PASS).length}
          </div>
        </div>
        <div className="p-3.5 bg-card border rounded-xl shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-medium text-muted-foreground">Lulus dgn Catatan</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">
            {inspections.filter((i) => i.result === InspectionResult.PASS_WITH_REMARK).length}
          </div>
        </div>
        <div className="p-3.5 bg-card border rounded-xl shadow-sm border-l-4 border-l-red-500">
          <div className="text-xs font-medium text-muted-foreground">Gagal (Auto BD & WO)</div>
          <div className="text-2xl font-bold mt-1 text-red-600">
            {inspections.filter((i) => i.result === InspectionResult.FAIL).length}
          </div>
        </div>
      </div>

      {/* List / Table */}
      {filteredInspections.length === 0 ? (
        <Card className="text-center py-16 border-dashed">
          <CardContent className="space-y-3">
            <ClipboardCheck className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-lg font-medium text-slate-800">Tidak Ada Data Inspeksi</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {search || resultFilter !== "ALL" || typeFilter !== "ALL"
                ? "Tidak ada hasil yang cocok dengan filter yang dipilih."
                : "Belum ada catatan inspeksi unit yang tersimpan di sistem."}
            </p>
            <Button asChild variant="outline" className="gap-2 mt-2">
              <Link href="/inspection/new">
                <Plus className="w-4 h-4" />
                Catat Inspeksi Pertama
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredInspections.map((ins) => (
              <Card key={ins.id} className="shadow-sm border-slate-200">
                <CardHeader className="pb-3 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-semibold text-primary">
                      {ins.code}
                    </span>
                    <CardTitle className="text-base mt-0.5 font-bold">
                      {ins.equipment.code} - {ins.equipment.name}
                    </CardTitle>
                  </div>
                  {getResultBadge(ins.result)}
                </CardHeader>
                <CardContent className="pt-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(ins.inspectionDate)}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Gauge className="w-3.5 h-3.5 text-slate-400" />
                      {ins.hourMeter.toLocaleString("id-ID")} Jam
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium">
                      Tipe: {ins.inspectionType.name}
                    </div>
                    {ins.certificateNumber && (
                      <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded border">
                        <span className="font-mono text-slate-700">
                          Sertifikat: {ins.certificateNumber}
                        </span>
                        {getCertStatus(ins.validUntil)}
                      </div>
                    )}
                  </div>

                  {ins.finding && (
                    <div className="text-xs text-slate-700 bg-amber-50/60 p-2 rounded border border-amber-100 line-clamp-2">
                      <span className="font-semibold text-amber-900">Temuan: </span>
                      {ins.finding}
                    </div>
                  )}

                  <div className="pt-2 border-t flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        name={ins.inspector.name}
                        avatarUrl={ins.inspector.avatarUrl}
                        size="xs"
                      />
                      <span className="text-slate-700 font-medium">{ins.inspector.name}</span>
                    </div>
                    <Button size="sm" variant="ghost" asChild className="h-8 gap-1">
                      <Link href={`/inspection/${ins.id}`}>
                        Lihat Detail
                        <ExternalLink className="w-3.5 h-3.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-card rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[130px]">No. Inspeksi</TableHead>
                  <TableHead>Unit Equipment</TableHead>
                  <TableHead>Tipe Inspeksi</TableHead>
                  <TableHead>Tanggal & HM</TableHead>
                  <TableHead>Hasil</TableHead>
                  <TableHead>Sertifikat / Masa Berlaku</TableHead>
                  <TableHead>Inspektor</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInspections.map((ins) => (
                  <TableRow key={ins.id} className="hover:bg-slate-50/70">
                    <TableCell className="font-mono font-semibold text-xs text-primary">
                      {ins.code}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm text-slate-900">
                        {ins.equipment.code}
                      </div>
                      <div className="text-xs text-slate-500 line-clamp-1">
                        {ins.equipment.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium px-2.5 py-1 rounded bg-slate-100 text-slate-800">
                        {ins.inspectionType.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium">{formatDate(ins.inspectionDate)}</div>
                      <div className="text-xs font-mono text-slate-500">
                        {ins.hourMeter.toLocaleString("id-ID")} Jam
                      </div>
                    </TableCell>
                    <TableCell>{getResultBadge(ins.result)}</TableCell>
                    <TableCell>
                      {ins.certificateNumber ? (
                        <div className="space-y-1">
                          <div className="font-mono text-xs font-medium text-slate-800">
                            {ins.certificateNumber}
                          </div>
                          {getCertStatus(ins.validUntil)}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          name={ins.inspector.name}
                          avatarUrl={ins.inspector.avatarUrl}
                          size="xs"
                        />
                        <div>
                          <div className="text-xs font-medium text-slate-800">
                            {ins.inspector.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            NIK: {ins.inspector.nik}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" asChild className="h-8 gap-1">
                        <Link href={`/inspection/${ins.id}`}>
                          Detail
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
