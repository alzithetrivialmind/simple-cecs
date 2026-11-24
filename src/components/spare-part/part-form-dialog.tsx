"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { EquipmentCategory, PartSystem } from "@prisma/client";
import { partSchema, PartInput } from "@/lib/validations/part";
import { savePart } from "@/server/actions/part";

const SYSTEM_LABELS: Record<PartSystem, string> = {
  ENGINE: "Engine / Mesin",
  HYDRAULIC: "Hidrolik",
  ELECTRICAL: "Elektrikal",
  UNDERCARRIAGE: "Undercarriage / Roda",
  TRANSMISSION: "Transmisi / Power Train",
  OTHERS: "Lain-lain",
};

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  HEAVY_EQUIPMENT: "Alat Berat",
  VEHICLE: "Kendaraan",
  GENERATOR: "Genset",
  COMPRESSOR: "Kompresor",
  PUMP: "Pompa",
  WELDING_MACHINE: "Mesin Las",
  OTHER_POWERED_EQUIPMENT: "Lain-lain",
};

interface PartFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partToEdit?: PartInput & { id: string } | null;
}

export function PartFormDialog({
  open,
  onOpenChange,
  partToEdit,
}: PartFormDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PartInput>({
    resolver: zodResolver(partSchema),
    defaultValues: {
      partNumber: "",
      description: "",
      manufacturer: "",
      altPartNumber: "",
      system: PartSystem.OTHERS,
      unit: "PCS",
      compatibleCategories: [],
    },
  });

  React.useEffect(() => {
    if (partToEdit) {
      reset({
        id: partToEdit.id,
        partNumber: partToEdit.partNumber,
        description: partToEdit.description,
        manufacturer: partToEdit.manufacturer || "",
        altPartNumber: partToEdit.altPartNumber || "",
        system: partToEdit.system,
        unit: partToEdit.unit || "PCS",
        compatibleCategories: partToEdit.compatibleCategories || [],
      });
    } else {
      reset({
        partNumber: "",
        description: "",
        manufacturer: "",
        altPartNumber: "",
        system: PartSystem.OTHERS,
        unit: "PCS",
        compatibleCategories: [],
      });
    }
  }, [partToEdit, reset, open]);

  const selectedCategories = watch("compatibleCategories") || [];

  const toggleCategory = (cat: EquipmentCategory) => {
    if (selectedCategories.includes(cat)) {
      setValue(
        "compatibleCategories",
        selectedCategories.filter((c) => c !== cat)
      );
    } else {
      setValue("compatibleCategories", [...selectedCategories, cat]);
    }
  };

  const onSubmit = async (data: PartInput) => {
    setIsSubmitting(true);
    try {
      const res = await savePart(data);
      if (res.success) {
        toast.success(
          partToEdit
            ? "Data suku cadang berhasil diperbarui"
            : "Suku cadang baru berhasil didaftarkan"
        );
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menyimpan suku cadang.");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat menyimpan spare part.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>
              {partToEdit ? "Edit Master Suku Cadang" : "Daftarkan Suku Cadang Baru"}
            </DialogTitle>
            <DialogDescription>
              Katalog part OEM dan kompatibilitas komponen alat tanpa data biaya/stok gudang.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="partNumber">Nomor Part (OEM / P/N) *</Label>
                <Input
                  id="partNumber"
                  placeholder="Contoh: 1R-0716, LF9009"
                  className="font-mono uppercase"
                  {...register("partNumber")}
                />
                {errors.partNumber && (
                  <p className="text-xs text-red-600">{errors.partNumber.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="altPartNumber">Nomor Part Alternatif / Cross Ref</Label>
                <Input
                  id="altPartNumber"
                  placeholder="Contoh: P550388, HF6510"
                  className="font-mono uppercase"
                  {...register("altPartNumber")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Deskripsi / Nama Part *</Label>
              <Input
                id="description"
                placeholder="Contoh: Oil Filter Element Engine C7.1"
                {...register("description")}
              />
              {errors.description && (
                <p className="text-xs text-red-600">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Sistem Komponen *</Label>
                <Select
                  value={watch("system")}
                  onValueChange={(val: PartSystem) => setValue("system", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Sistem" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SYSTEM_LABELS) as PartSystem[]).map((sys) => (
                      <SelectItem key={sys} value={sys}>
                        {SYSTEM_LABELS[sys]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.system && (
                  <p className="text-xs text-red-600">{errors.system.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manufacturer">Merk / Pabrikan</Label>
                <Input
                  id="manufacturer"
                  placeholder="Caterpillar, Komatsu..."
                  {...register("manufacturer")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="unit">Satuan *</Label>
                <Input
                  id="unit"
                  placeholder="PCS, SET, LTR"
                  className="uppercase"
                  {...register("unit")}
                />
                {errors.unit && (
                  <p className="text-xs text-red-600">{errors.unit.message}</p>
                )}
              </div>
            </div>

            {/* Compatible Categories */}
            <div className="space-y-2 pt-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" />
                Kompatibilitas Kategori Unit
              </Label>
              <p className="text-xs text-muted-foreground">
                Pilih kategori unit yang dapat menggunakan suku cadang ini.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {(Object.keys(CATEGORY_LABELS) as EquipmentCategory[]).map((cat) => {
                  const isSelected = selectedCategories.includes(cat);
                  return (
                    <Button
                      key={cat}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleCategory(cat)}
                      className="text-xs h-8"
                    >
                      {CATEGORY_LABELS[cat]}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {partToEdit ? "Simpan Perubahan" : "Simpan Suku Cadang"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
