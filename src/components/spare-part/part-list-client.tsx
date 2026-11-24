"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Wrench,
  Plus,
  Search,
  Edit2,
  Trash2,
  Cpu,
  Zap,
  Activity,
  Cog,
  Component,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EquipmentCategory, PartSystem } from "@prisma/client";
import { PartFormDialog } from "@/components/spare-part/part-form-dialog";
import { deletePart, getParts } from "@/server/actions/part";
import { PartInput } from "@/lib/validations/part";

export const SYSTEM_LABELS: Record<PartSystem, string> = {
  ENGINE: "Engine / Mesin",
  HYDRAULIC: "Hidrolik",
  ELECTRICAL: "Elektrikal",
  UNDERCARRIAGE: "Undercarriage",
  TRANSMISSION: "Transmisi",
  OTHERS: "Lain-lain",
};

export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  HEAVY_EQUIPMENT: "Alat Berat",
  VEHICLE: "Kendaraan",
  GENERATOR: "Genset",
  COMPRESSOR: "Kompresor",
  PUMP: "Pompa",
  WELDING_MACHINE: "Mesin Las",
  OTHER_POWERED_EQUIPMENT: "Lain-lain",
};

type PartItem = Awaited<ReturnType<typeof getParts>>["items"][number];

interface PartListClientProps {
  initialParts: PartItem[];
  totalParts: number;
  userRole?: string;
}

export function PartListClient({
  initialParts,
  totalParts,
  userRole,
}: PartListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(searchParams.get("search") || "");
  const [systemFilter, setSystemFilter] = React.useState<string>(
    searchParams.get("system") || "ALL"
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [partToEdit, setPartToEdit] = React.useState<(PartInput & { id: string }) | null>(null);

  const canManage = userRole === "ADMIN" || userRole === "SUPERVISOR";

  const filteredParts = React.useMemo(() => {
    return initialParts.filter((p) => {
      if (systemFilter !== "ALL" && p.system !== systemFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchPn = p.partNumber.toLowerCase().includes(q);
        const matchDesc = p.description.toLowerCase().includes(q);
        const matchAlt = p.altPartNumber?.toLowerCase().includes(q);
        const matchMfr = p.manufacturer?.toLowerCase().includes(q);
        if (!matchPn && !matchDesc && !matchAlt && !matchMfr) return false;
      }

      return true;
    });
  }, [initialParts, systemFilter, search]);

  const openCreate = () => {
    setPartToEdit(null);
    setDialogOpen(true);
  };

  const openEdit = (p: PartItem) => {
    setPartToEdit({
      id: p.id,
      partNumber: p.partNumber,
      description: p.description,
      manufacturer: p.manufacturer,
      altPartNumber: p.altPartNumber,
      system: p.system,
      unit: p.unit,
      compatibleCategories: p.compatibility
        .map((c) => c.category)
        .filter((c): c is EquipmentCategory => c !== null),
      compatibleEquipmentIds: p.compatibility
        .map((c) => c.equipmentId)
        .filter((id): id is string => !!id),
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus suku cadang ${name} dari katalog?`)) return;

    try {
      const res = await deletePart(id);
      if (res.success) {
        toast.success("Suku cadang berhasil dihapus");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menghapus suku cadang");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat menghapus part.");
    }
  };

  const getSystemBadge = (sys: PartSystem) => {
    switch (sys) {
      case "ENGINE":
        return (
          <Badge className="bg-red-500/15 text-red-700 border-red-200 gap-1 font-medium hover:bg-red-500/20">
            <Activity className="w-3 h-3" />
            Engine
          </Badge>
        );
      case "HYDRAULIC":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 border-blue-200 gap-1 font-medium hover:bg-blue-500/20">
            <Cog className="w-3 h-3" />
            Hidrolik
          </Badge>
        );
      case "ELECTRICAL":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 border-amber-200 gap-1 font-medium hover:bg-amber-500/20">
            <Zap className="w-3 h-3" />
            Elektrikal
          </Badge>
        );
      case "UNDERCARRIAGE":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200 gap-1 font-medium hover:bg-emerald-500/20">
            <Truck className="w-3 h-3" />
            Undercarriage
          </Badge>
        );
      case "TRANSMISSION":
        return (
          <Badge className="bg-purple-500/15 text-purple-700 border-purple-200 gap-1 font-medium hover:bg-purple-500/20">
            <Cpu className="w-3 h-3" />
            Transmisi
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 font-medium">
            <Component className="w-3 h-3" />
            Lain-lain
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nomor part, deskripsi, merk, atau part alternatif..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          <Select value={systemFilter} onValueChange={setSystemFilter}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Semua Sistem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Sistem</SelectItem>
              {(Object.keys(SYSTEM_LABELS) as PartSystem[]).map((sys) => (
                <SelectItem key={sys} value={sys}>
                  {SYSTEM_LABELS[sys]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canManage && (
          <Button onClick={openCreate} className="shrink-0 gap-2">
            <Plus className="w-4 h-4" />
            Tambah Suku Cadang
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-card border rounded-xl shadow-sm">
          <div className="text-xs font-medium text-muted-foreground">Total Master Part</div>
          <div className="text-2xl font-bold mt-1">{totalParts}</div>
        </div>
        <div className="p-3.5 bg-card border rounded-xl shadow-sm border-l-4 border-l-red-500">
          <div className="text-xs font-medium text-muted-foreground">Part Engine</div>
          <div className="text-2xl font-bold mt-1 text-red-600">
            {initialParts.filter((p) => p.system === "ENGINE").length}
          </div>
        </div>
        <div className="p-3.5 bg-card border rounded-xl shadow-sm border-l-4 border-l-blue-500">
          <div className="text-xs font-medium text-muted-foreground">Part Hidrolik</div>
          <div className="text-2xl font-bold mt-1 text-blue-600">
            {initialParts.filter((p) => p.system === "HYDRAULIC").length}
          </div>
        </div>
        <div className="p-3.5 bg-card border rounded-xl shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-medium text-muted-foreground">Part Elektrikal</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">
            {initialParts.filter((p) => p.system === "ELECTRICAL").length}
          </div>
        </div>
      </div>

      {/* Content View */}
      {filteredParts.length === 0 ? (
        <Card className="text-center py-16 border-dashed">
          <CardContent className="space-y-3">
            <Wrench className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-lg font-medium text-slate-800">Tidak Ada Suku Cadang</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {search || systemFilter !== "ALL"
                ? "Tidak ada hasil yang sesuai dengan filter pencarian."
                : "Belum ada master spare part yang didaftarkan ke sistem."}
            </p>
            {canManage && (
              <Button onClick={openCreate} variant="outline" className="gap-2 mt-2">
                <Plus className="w-4 h-4" />
                Daftarkan Part Pertama
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredParts.map((p) => (
              <Card key={p.id} className="shadow-sm border-slate-200">
                <CardHeader className="pb-3 border-b bg-slate-50/50 flex flex-row items-start justify-between">
                  <Link href={`/spare-part/${p.id}`} className="min-w-0 hover:underline">
                    <span className="font-mono text-sm font-bold text-primary">
                      {p.partNumber}
                    </span>
                    <CardTitle className="text-base mt-0.5 font-bold line-clamp-1">
                      {p.description}
                    </CardTitle>
                    {p.altPartNumber && (
                      <div className="text-xs text-slate-400 font-mono">
                        Cross Ref: {p.altPartNumber}
                      </div>
                    )}
                  </Link>
                  {getSystemBadge(p.system)}
                </CardHeader>
                <CardContent className="pt-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Pabrikan: {p.manufacturer || "-"}</span>
                    <span className="font-semibold text-slate-700">Satuan: {p.unit}</span>
                  </div>

                  {p.compatibility.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs text-slate-400">Kompatibel dengan:</span>
                      <div className="flex flex-wrap gap-1">
                        {p.compatibility.slice(0, 3).map((c) => (
                          <Badge key={c.id} variant="outline" className="text-[10px] px-1.5 py-0">
                            {c.category ? CATEGORY_LABELS[c.category] : c.equipmentId}
                          </Badge>
                        ))}
                        {p.compatibility.length > 3 && (
                          <span className="text-[10px] text-slate-400 self-center">
                            +{p.compatibility.length - 3} lainnya
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Riwayat Pemakaian: {p._count.usages}x
                    </span>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-500"
                          onClick={() => openEdit(p)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(p.id, p.partNumber)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
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
                  <TableHead className="w-[160px]">Nomor Part (P/N)</TableHead>
                  <TableHead>Deskripsi Komponen</TableHead>
                  <TableHead>Sistem</TableHead>
                  <TableHead>Merk / Cross Ref</TableHead>
                  <TableHead>Kompatibilitas</TableHead>
                  <TableHead className="text-center">Pemakaian</TableHead>
                  {canManage && <TableHead className="text-right">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParts.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/70">
                    <TableCell>
                      <Link
                        href={`/spare-part/${p.id}`}
                        className="font-mono font-bold text-sm text-primary hover:underline"
                      >
                        {p.partNumber}
                      </Link>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Satuan: {p.unit}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm text-slate-900">
                        {p.description}
                      </div>
                    </TableCell>
                    <TableCell>{getSystemBadge(p.system)}</TableCell>
                    <TableCell>
                      <div className="text-xs text-slate-700 font-medium">
                        {p.manufacturer || "-"}
                      </div>
                      {p.altPartNumber && (
                        <div className="text-[11px] text-slate-400 font-mono">
                          Alt: {p.altPartNumber}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.compatibility.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">Semua unit</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {p.compatibility.slice(0, 3).map((c) => (
                            <Badge key={c.id} variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50">
                              {c.category ? CATEGORY_LABELS[c.category] : c.equipmentId}
                            </Badge>
                          ))}
                          {p.compatibility.length > 3 && (
                            <span className="text-[10px] text-slate-400 self-center">
                              +{p.compatibility.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {p._count.usages}x
                      </span>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-slate-500 hover:text-slate-900"
                            onClick={() => openEdit(p)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                            onClick={() => handleDelete(p.id, p.partNumber)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <PartFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        partToEdit={partToEdit}
      />
    </div>
  );
}
