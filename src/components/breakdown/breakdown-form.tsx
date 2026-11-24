"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Priority } from "@prisma/client";
import {
  AlertTriangle,
  Camera,
  Loader2,
  Trash2,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  breakdownRequestSchema,
  BreakdownRequestInput,
} from "@/lib/validations/breakdown";
import { cn } from "@/lib/utils";
import { createBreakdownRequest } from "@/server/actions/breakdown";
import { uploadEquipmentPhoto } from "@/server/actions/equipment";

interface EquipmentOption {
  id: string;
  code: string;
  name: string;
  category: string;
  currentHourMeter: number;
}

interface BreakdownFormProps {
  equipments: EquipmentOption[];
  defaultEquipmentId?: string;
}

const LOCAL_STORAGE_KEY = "cecs_breakdown_draft";


const PRIORITY_OPTIONS: {
  value: Priority;
  label: string;
  hint: string;
  dotClass: string;
  activeClass: string;
}[] = [
  {
    value: Priority.LOW,
    label: "Rendah",
    hint: "Tidak urgent",
    dotClass: "bg-slate-400",
    activeClass: "border-slate-500 bg-slate-600 text-white",
  },
  {
    value: Priority.MEDIUM,
    label: "Sedang",
    hint: "Normal",
    dotClass: "bg-blue-500",
    activeClass: "border-blue-600 bg-blue-600 text-white",
  },
  {
    value: Priority.HIGH,
    label: "Tinggi",
    hint: "Menghambat kerja",
    dotClass: "bg-orange-500",
    activeClass: "border-orange-600 bg-orange-500 text-white",
  },
  {
    value: Priority.CRITICAL,
    label: "Kritis",
    hint: "Stop operasi",
    dotClass: "bg-red-600",
    activeClass: "border-red-700 bg-red-600 text-white",
  },
];

export function BreakdownForm({
  equipments,
  defaultEquipmentId,
}: BreakdownFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = React.useState(false);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);

  const selectedInitialEquipment = equipments.find(
    (e) => e.id === defaultEquipmentId
  );

  const form = useForm<BreakdownRequestInput>({
    resolver: zodResolver(breakdownRequestSchema),
    defaultValues: {
      equipmentId: defaultEquipmentId || "",
      problem: "",
      priority: Priority.MEDIUM,
      hourMeter: selectedInitialEquipment?.currentHourMeter || 0,
      reportedAt: new Date(),
      photoKey: null,
      photoName: null,
      photoSize: null,
      photoMime: null,
    },
  });

  const selectedEquipmentId = form.watch("equipmentId");
  const selectedEquipment = equipments.find((e) => e.id === selectedEquipmentId);

  // Restore draft from localStorage on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved && !defaultEquipmentId) {
        const parsed = JSON.parse(saved);
        if (parsed.equipmentId) form.setValue("equipmentId", parsed.equipmentId);
        if (parsed.problem) form.setValue("problem", parsed.problem);
        if (parsed.priority) form.setValue("priority", parsed.priority);
        if (parsed.hourMeter) form.setValue("hourMeter", Number(parsed.hourMeter));
        if (parsed.photoKey) {
          form.setValue("photoKey", parsed.photoKey);
          form.setValue("photoName", parsed.photoName);
          form.setValue("photoSize", parsed.photoSize);
          form.setValue("photoMime", parsed.photoMime);
          setPhotoPreview(`/api/files/${parsed.photoKey}`);
        }
        toast.info("Draf laporan sebelumnya telah dimuat kembali.");
      }
    } catch {
      // Ignore JSON parse errors
    }
  }, [form, defaultEquipmentId]);

  // Auto-save form draft to localStorage
  const formValues = form.watch();
  React.useEffect(() => {
    if (formValues.problem || formValues.equipmentId) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formValues));
      } catch {
        // Ignore localStorage quota errors
      }
    }
  }, [formValues]);

  // Update hour meter when equipment changes if hour meter is smaller
  React.useEffect(() => {
    if (selectedEquipment) {
      const currentVal = form.getValues("hourMeter");
      if (currentVal === undefined || currentVal < selectedEquipment.currentHourMeter) {
        form.setValue("hourMeter", selectedEquipment.currentHourMeter);
      }
    }
  }, [selectedEquipment, form]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 10MB");
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await uploadEquipmentPhoto(formData);
      if (res.success && res.fileKey) {
        form.setValue("photoKey", res.fileKey);
        form.setValue("photoName", file.name);
        form.setValue("photoSize", file.size);
        form.setValue("photoMime", file.type);
        setPhotoPreview(res.url || `/api/files/${res.fileKey}`);
        toast.success("Foto bukti kerusakan berhasil diunggah.");
      } else {
        toast.error(res.error || "Gagal mengunggah foto.");
      }
    } catch {
      toast.error("Terjadi kesalahan saat mengunggah foto.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    form.setValue("photoKey", null);
    form.setValue("photoName", null);
    form.setValue("photoSize", null);
    form.setValue("photoMime", null);
    setPhotoPreview(null);
  };

  const onSubmit = async (values: BreakdownRequestInput) => {
    setIsSubmitting(true);
    try {
      const res = await createBreakdownRequest(values);
      if (res.success && res.workOrderId) {
        // Clear draft
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        toast.success(
          `Laporan ${res.breakdownCode} berhasil dikirim! Work Order #${res.workOrderCode} otomatis dibuat.`
        );
        router.push(`/work-order/${res.workOrderId}`);
      } else {
        toast.error(res.error || "Gagal mengirim laporan breakdown.");
      }
    } catch {
      toast.error("Terjadi kesalahan pada sistem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-2xl mx-auto">
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-red-50/50 dark:bg-red-950/20 border-b pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg sm:text-xl font-bold text-foreground">
                Lapor Kerusakan Unit (Breakdown)
              </CardTitle>
              <CardDescription className="text-xs">
                Laporkan kendala atau kerusakan unit secara instan.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-5">
          {/* 1. Pilih Unit Equipment */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center justify-between">
              <span>Unit Equipment <span className="text-destructive">*</span></span>
              {selectedEquipment && (
                <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                  <Gauge className="h-3.5 w-3.5 text-blue-500" />
                  HM Saat ini: {selectedEquipment.currentHourMeter.toLocaleString("id-ID")} Jam
                </span>
              )}
            </Label>
            <Select
              value={form.watch("equipmentId")}
              onValueChange={(val) => form.setValue("equipmentId", val, { shouldValidate: true })}
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="-- Pilih Unit yang Rusak --" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {equipments.map((eq) => (
                  <SelectItem key={eq.id} value={eq.id} className="py-2.5">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">
                        [{eq.code}] {eq.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {eq.category} • {eq.currentHourMeter} Jam
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.equipmentId && (
              <p className="text-xs font-medium text-destructive">
                {form.formState.errors.equipmentId.message}
              </p>
            )}
          </div>

          {/* 2. Deskripsi Masalah / Gejala Kerusakan */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Deskripsi Kerusakan / Gejala <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Jelaskan secara detail bagian yang rusak, suara aneh, kebocoran, atau kendala operasi..."
              rows={4}
              className="resize-none text-base"
              {...form.register("problem")}
            />
            {form.formState.errors.problem && (
              <p className="text-xs font-medium text-destructive">
                {form.formState.errors.problem.message}
              </p>
            )}
          </div>

          {/* 3. Tingkat Prioritas: tombol besar, bukan dropdown (UI-SPEC) */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Tingkat Prioritas <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Tingkat Prioritas">
              {PRIORITY_OPTIONS.map((opt) => {
                const active = form.watch("priority") === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() =>
                      form.setValue("priority", opt.value, { shouldValidate: true })
                    }
                    className={cn(
                      "min-h-[56px] rounded-xl border-2 px-3 py-2 text-left transition-colors",
                      active ? opt.activeClass : "border-border bg-background hover:bg-muted/50"
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", active ? "bg-white" : opt.dotClass)} />
                      {opt.label}
                    </span>
                    <span className={cn("block text-xs mt-0.5", active ? "opacity-90" : "text-muted-foreground")}>
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Hour Meter */}
          <div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Hour Meter Saat Rusak (Jam) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={selectedEquipment?.currentHourMeter || 0}
                className="h-12 font-mono text-base"
                {...form.register("hourMeter")}
              />
              {selectedEquipment && (
                <p className="text-[11px] text-muted-foreground">
                  Min. {selectedEquipment.currentHourMeter} Jam (tidak boleh mundur).
                </p>
              )}
              {form.formState.errors.hourMeter && (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.hourMeter.message}
                </p>
              )}
            </div>
          </div>

          {/* 5. Upload Foto Bukti Lapangan */}
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-sm font-semibold flex items-center justify-between">
              <span>Foto Bukti Kerusakan (Opsional)</span>
              <span className="text-xs font-normal text-muted-foreground">Max 10MB</span>
            </Label>

            {photoPreview ? (
              <div className="relative rounded-xl border overflow-hidden bg-muted/40 aspect-video max-h-56 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Bukti Kerusakan"
                  className="w-full h-full object-contain"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 shadow-md"
                  onClick={handleRemovePhoto}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/60 hover:bg-muted/30 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={isUploadingPhoto}
                />
                {isUploadingPhoto ? (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground py-2">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <span className="text-xs">Mengunggah foto ke storage...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <div className="p-3 rounded-full bg-muted text-muted-foreground">
                      <Camera className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      Ambil Foto / Upload Berkas
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Kamera smartphone atau file galeri JPG / PNG
                    </span>
                  </div>
                )}
              </label>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Tombol aksi menempel di bawah layar, di atas bottom navigation */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] lg:bottom-4 z-30 -mx-4 sm:mx-0 border-t sm:border sm:rounded-xl bg-background/95 backdrop-blur px-4 py-3 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <Button
          type="button"
          variant="outline"
          className="hidden sm:inline-flex h-12 min-h-[44px]"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Batal
        </Button>
        <Button
          type="submit"
          className="w-full sm:w-auto h-14 sm:h-12 gap-2 bg-red-600 hover:bg-red-700 text-white text-base font-semibold shadow-md"
          disabled={isSubmitting || isUploadingPhoto}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Mengirim Laporan...
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5" />
              Kirim Laporan Kerusakan
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
