"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ListChecks,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Loader2,
  FileCheck2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EquipmentCategory } from "@prisma/client";
import { savePmChecklistTemplate, getPmChecklistTemplates } from "@/server/actions/pm";
import { PmChecklistTemplateInput } from "@/lib/validations/pm";

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  HEAVY_EQUIPMENT: "Alat Berat",
  VEHICLE: "Kendaraan",
  GENERATOR: "Genset",
  COMPRESSOR: "Kompresor",
  PUMP: "Pompa",
  WELDING_MACHINE: "Mesin Las",
  OTHER_POWERED_EQUIPMENT: "Lain-lain",
};

interface TemplateItem {
  id?: string;
  label: string;
}

type TemplateRecord = Awaited<ReturnType<typeof getPmChecklistTemplates>>[number];

interface PmTemplateClientProps {
  initialTemplates: TemplateRecord[];
  pmTypes: { id: string; name: string }[];
}

export function PmTemplateClient({
  initialTemplates,
  pmTypes,
}: PmTemplateClientProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form states
  const [editingId, setEditingId] = React.useState<string | undefined>();
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<EquipmentCategory>("HEAVY_EQUIPMENT");
  const [pmTypeId, setPmTypeId] = React.useState("");
  const [items, setItems] = React.useState<TemplateItem[]>([
    { label: "" },
  ]);

  const filteredTemplates = React.useMemo(() => {
    if (selectedCategory === "ALL") return initialTemplates;
    return initialTemplates.filter((t) => t.category === selectedCategory);
  }, [initialTemplates, selectedCategory]);

  const openCreateDialog = () => {
    setEditingId(undefined);
    setName("");
    setCategory("HEAVY_EQUIPMENT");
    setPmTypeId(pmTypes[0]?.id || "");
    setItems([
      { label: "Periksa level oli mesin & filter" },
      { label: "Periksa sistem pendingin / radiator & coolant" },
      { label: "Periksa sistem hidrolik & kebocoran selang" },
      { label: "Pengecekan baterai / aki & koneksi kabel" },
      { label: "Pembersihan filter udara (air cleaner)" },
    ]);
    setDialogOpen(true);
  };

  const openEditDialog = (t: TemplateRecord) => {
    setEditingId(t.id);
    setName(t.name);
    setCategory(t.category);
    setPmTypeId(t.pmTypeId);
    setItems(
      t.items.length > 0
        ? t.items.map((i) => ({ id: i.id, label: i.label }))
        : [{ label: "" }]
    );
    setDialogOpen(true);
  };

  const addItem = () => {
    setItems([...items, { label: "" }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      toast.error("Template minimal harus memiliki 1 item checklist.");
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItemLabel = (index: number, label: string) => {
    const updated = [...items];
    updated[index].label = label;
    setItems(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama template wajib diisi.");
      return;
    }
    if (!pmTypeId) {
      toast.error("Tipe PM wajib dipilih.");
      return;
    }

    const validItems = items
      .map((i, idx) => ({ label: i.label.trim(), sortOrder: idx }))
      .filter((i) => i.label.length > 0);

    if (validItems.length === 0) {
      toast.error("Wajib mengisi minimal 1 item checklist yang valid.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: PmChecklistTemplateInput = {
        id: editingId,
        name: name.trim(),
        category,
        pmTypeId,
        isActive: true,
        items: validItems,
      };

      const res = await savePmChecklistTemplate(payload);
      if (res.success) {
        toast.success(editingId ? "Template checklist berhasil diperbarui" : "Template checklist berhasil dibuat");
        setDialogOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menyimpan template");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat menyimpan template.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top filter & action bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={selectedCategory === "ALL" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("ALL")}
          >
            Semua Kategori ({initialTemplates.length})
          </Button>
          {(Object.keys(CATEGORY_LABELS) as EquipmentCategory[]).map((cat) => {
            const count = initialTemplates.filter((t) => t.category === cat).length;
            return (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
              >
                {CATEGORY_LABELS[cat]} ({count})
              </Button>
            );
          })}
        </div>

        <Button onClick={openCreateDialog} className="shrink-0 gap-2">
          <Plus className="w-4 h-4" />
          Template Baru
        </Button>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <Card className="text-center py-12 border-dashed">
          <CardContent className="space-y-3">
            <ListChecks className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-lg font-medium text-slate-800">Belum Ada Template Checklist</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Buat template checklist pemeliharaan untuk kategori unit dan interval PM tertentu.
            </p>
            <Button onClick={openCreateDialog} variant="outline" className="gap-2 mt-2">
              <Plus className="w-4 h-4" />
              Buat Template Sekarang
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((t) => (
            <Card key={t.id} className="flex flex-col shadow-sm border-slate-200 hover:border-slate-300 transition-colors">
              <CardHeader className="pb-3 border-b bg-slate-50/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <Badge variant="outline" className="bg-white font-medium">
                      {CATEGORY_LABELS[t.category] || t.category}
                    </Badge>
                    <CardTitle className="text-base font-semibold text-slate-900 line-clamp-1">
                      {t.name}
                    </CardTitle>
                    <CardDescription className="text-xs text-primary font-medium">
                      {t.pmType.name}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-slate-900"
                    onClick={() => openEditDialog(t)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <FileCheck2 className="w-3.5 h-3.5" />
                    Item Checklist ({t.items.length})
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700 max-h-48 overflow-y-auto pr-1">
                    {t.items.map((item, idx) => (
                      <li key={item.id} className="flex items-start gap-2 bg-slate-50 p-1.5 rounded border border-slate-100">
                        <span className="font-mono text-slate-400 shrink-0 w-4 text-right">
                          {idx + 1}.
                        </span>
                        <span className="leading-snug">{item.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2 border-t flex items-center justify-between text-xs text-slate-500">
                  <span>Status:</span>
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Aktif
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Create / Edit Template */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Template Checklist PM" : "Buat Template Checklist PM Baru"}
              </DialogTitle>
              <DialogDescription>
                Standarisasi item pemeriksaan yang harus diisi teknisi saat melakukan servis PM.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="templateName">Nama Template *</Label>
                <Input
                  id="templateName"
                  placeholder="Contoh: Checklist Servis 250 Jam Excavator & Crane"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Kategori Equipment *</Label>
                  <Select
                    value={category}
                    onValueChange={(val: EquipmentCategory) => setCategory(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CATEGORY_LABELS) as EquipmentCategory[]).map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {CATEGORY_LABELS[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Tipe Servis PM *</Label>
                  <Select value={pmTypeId} onValueChange={setPmTypeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Tipe PM" />
                    </SelectTrigger>
                    <SelectContent>
                      {pmTypes.map((pt) => (
                        <SelectItem key={pt.id} value={pt.id}>
                          {pt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dynamic Checklist Items */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Daftar Item Pemeriksaan ({items.length})</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    className="h-8 gap-1 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Item
                  </Button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400 w-5 text-right shrink-0">
                        {idx + 1}.
                      </span>
                      <Input
                        value={item.label}
                        onChange={(e) => updateItemLabel(idx, e.target.value)}
                        placeholder={`Deskripsi checklist item #${idx + 1}`}
                        className="text-sm"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(idx)}
                        disabled={items.length <= 1}
                        className="h-9 w-9 text-slate-400 hover:text-red-600 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? "Simpan Perubahan" : "Buat Template"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
