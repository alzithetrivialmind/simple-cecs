"use client";

import * as React from "react";
import {
  Building2,
  MapPin,
  CalendarCheck,
  ClipboardCheck,
  Plus,
  Edit2,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  upsertDepartment,
  deleteDepartment,
  upsertLocation,
  deleteLocation,
  upsertPmType,
  deletePmType,
  upsertInspectionType,
  deleteInspectionType,
} from "@/server/actions/master";

interface MasterItem {
  id: string;
  name: string;
  _count?: Record<string, number>;
}

interface MasterDataClientProps {
  departments: MasterItem[];
  locations: MasterItem[];
  pmTypes: MasterItem[];
  inspectionTypes: MasterItem[];
}

export function MasterDataClient({
  departments,
  locations,
  pmTypes,
  inspectionTypes,
}: MasterDataClientProps) {
  const [activeTab, setActiveTab] = React.useState("department");

  // Modal State
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [targetType, setTargetType] = React.useState<
    "department" | "location" | "pmType" | "inspectionType"
  >("department");
  const [editingItem, setEditingItem] = React.useState<MasterItem | null>(null);
  const [nameInput, setNameInput] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleOpenAdd = (
    type: "department" | "location" | "pmType" | "inspectionType"
  ) => {
    setTargetType(type);
    setEditingItem(null);
    setNameInput("");
    setDialogOpen(true);
  };

  const handleOpenEdit = (
    type: "department" | "location" | "pmType" | "inspectionType",
    item: MasterItem
  ) => {
    setTargetType(type);
    setEditingItem(item);
    setNameInput(item.name);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    setIsSubmitting(true);
    try {
      let res: { success: boolean; error?: string };
      const payload = {
        id: editingItem?.id,
        name: nameInput.trim(),
      };

      if (targetType === "department") {
        res = await upsertDepartment(payload);
      } else if (targetType === "location") {
        res = await upsertLocation(payload);
      } else if (targetType === "pmType") {
        res = await upsertPmType(payload);
      } else {
        res = await upsertInspectionType(payload);
      }

      if (res.success) {
        toast.success("Data berhasil disimpan");
        setDialogOpen(false);
      } else {
        toast.error(res.error || "Gagal menyimpan data");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (
    type: "department" | "location" | "pmType" | "inspectionType",
    item: MasterItem
  ) => {
    if (confirm(`Hapus data "${item.name}"?`)) {
      try {
        let res: { success: boolean; error?: string };
        if (type === "department") {
          res = await deleteDepartment({ id: item.id });
        } else if (type === "location") {
          res = await deleteLocation({ id: item.id });
        } else if (type === "pmType") {
          res = await deletePmType({ id: item.id });
        } else {
          res = await deleteInspectionType({ id: item.id });
        }

        if (res.success) {
          toast.success("Data berhasil dihapus");
        } else {
          toast.error(res.error || "Gagal menghapus data");
        }
      } catch {
        toast.error("Terjadi kesalahan sistem");
      }
    }
  };

  const getDialogTitle = () => {
    const action = editingItem ? "Edit" : "Tambah";
    switch (targetType) {
      case "department":
        return `${action} Departemen`;
      case "location":
        return `${action} Lokasi`;
      case "pmType":
        return `${action} Tipe PM`;
      case "inspectionType":
        return `${action} Jenis Inspeksi`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-condensed text-3xl font-bold leading-tight tracking-tight">Master data</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto p-1 gap-1">
          <TabsTrigger value="department" className="flex items-center gap-2 py-2">
            <Building2 className="h-4 w-4" />
            <span>Departemen</span>
          </TabsTrigger>
          <TabsTrigger value="location" className="flex items-center gap-2 py-2">
            <MapPin className="h-4 w-4" />
            <span>Lokasi</span>
          </TabsTrigger>
          <TabsTrigger value="pmType" className="flex items-center gap-2 py-2">
            <CalendarCheck className="h-4 w-4" />
            <span>Tipe PM</span>
          </TabsTrigger>
          <TabsTrigger value="inspectionType" className="flex items-center gap-2 py-2">
            <ClipboardCheck className="h-4 w-4" />
            <span>Jenis Inspeksi</span>
          </TabsTrigger>
        </TabsList>

        {/* 1. DEPARTMENTS TAB */}
        <TabsContent value="department" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold">Daftar Departemen ({departments.length})</h2>
            <Button onClick={() => handleOpenAdd("department")} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Tambah Departemen
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Departemen</TableHead>
                  <TableHead>Jumlah Pengguna</TableHead>
                  <TableHead>Jumlah Unit</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Belum ada data departemen.
                    </TableCell>
                  </TableRow>
                ) : (
                  departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-medium text-foreground">{dept.name}</TableCell>
                      <TableCell>{dept._count?.users ?? 0} user</TableCell>
                      <TableCell>{dept._count?.equipment ?? 0} unit</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit("department", dept)}
                          >
                            <Edit2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete("department", dept)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* 2. LOCATIONS TAB */}
        <TabsContent value="location" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold">Daftar Lokasi ({locations.length})</h2>
            <Button onClick={() => handleOpenAdd("location")} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Tambah Lokasi
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Lokasi / Area</TableHead>
                  <TableHead>Unit di Lokasi</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Belum ada data lokasi.
                    </TableCell>
                  </TableRow>
                ) : (
                  locations.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell className="font-medium text-foreground">{loc.name}</TableCell>
                      <TableCell>{loc._count?.equipment ?? 0} unit</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit("location", loc)}
                          >
                            <Edit2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete("location", loc)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* 3. PM TYPES TAB */}
        <TabsContent value="pmType" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold">Tipe Preventive Maintenance ({pmTypes.length})</h2>
            <Button onClick={() => handleOpenAdd("pmType")} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Tambah Tipe PM
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Layanan / Tipe PM</TableHead>
                  <TableHead>Template Checklist</TableHead>
                  <TableHead>Rencana PM Aktif</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pmTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Belum ada tipe PM.
                    </TableCell>
                  </TableRow>
                ) : (
                  pmTypes.map((pm) => (
                    <TableRow key={pm.id}>
                      <TableCell className="font-medium text-foreground">{pm.name}</TableCell>
                      <TableCell>{pm._count?.templates ?? 0} template</TableCell>
                      <TableCell>{pm._count?.plans ?? 0} unit</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit("pmType", pm)}
                          >
                            <Edit2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete("pmType", pm)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* 4. INSPECTION TYPES TAB */}
        <TabsContent value="inspectionType" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold">Jenis Inspeksi & Sertifikasi ({inspectionTypes.length})</h2>
            <Button onClick={() => handleOpenAdd("inspectionType")} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Tambah Jenis Inspeksi
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Jenis Inspeksi</TableHead>
                  <TableHead>Riwayat Inspeksi</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspectionTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Belum ada jenis inspeksi.
                    </TableCell>
                  </TableRow>
                ) : (
                  inspectionTypes.map((ins) => (
                    <TableRow key={ins.id}>
                      <TableCell className="font-medium text-foreground">{ins.name}</TableCell>
                      <TableCell>{ins._count?.inspections ?? 0} catatan</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit("inspectionType", ins)}
                          >
                            <Edit2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete("inspectionType", ins)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Shared Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>
              Masukkan nama entitas master data di bawah ini.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="masterName">Nama *</Label>
              <Input
                id="masterName"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                required
                placeholder="Contoh: Alat Berat, Workshop Utama..."
              />
            </div>
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
