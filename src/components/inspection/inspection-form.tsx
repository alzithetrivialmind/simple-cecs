"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ClipboardCheck,
  Gauge,
  AlertTriangle,
  Loader2,
  FileText,
  XCircle,
  CheckCircle2,
  AlertCircle,
  FileCheck,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InspectionResult } from "@prisma/client";
import { inspectionSchema, InspectionInput } from "@/lib/validations/inspection";
import { createInspection } from "@/server/actions/inspection";
import { uploadFormData } from "@/server/actions/upload";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-guard";

interface EquipmentOption {
  id: string;
  code: string;
  name: string;
  category: string;
  currentHourMeter: number;
}

interface InspectionFormProps {
  equipments: EquipmentOption[];
  inspectionTypes: { id: string; name: string }[];
  inspectors: { id: string; name: string; nik: string }[];
  currentUserId: string;
  defaultEquipmentId?: string;
}

const DRAFT_KEY = "cecs_draft_inspection_form";

export function InspectionForm({
  equipments,
  inspectionTypes,
  inspectors,
  currentUserId,
  defaultEquipmentId,
}: InspectionFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedEquipment, setSelectedEquipment] = React.useState<EquipmentOption | null>(
    equipments.find((e) => e.id === defaultEquipmentId) || null
  );

  // File upload state
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const [uploadedFile, setUploadedFile] = React.useState<{
    key: string;
    name: string;
    size: number;
    mime: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InspectionInput>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      equipmentId: defaultEquipmentId || "",
      inspectionTypeId: inspectionTypes[0]?.id || "",
      inspectorId: currentUserId,
      inspectionDate: new Date(),
      hourMeter: selectedEquipment?.currentHourMeter || 0,
      result: InspectionResult.PASS,
      finding: "",
      recommendation: "",
      certificateNumber: "",
    },
  });

  const watchResult = watch("result");
  const watchEquipmentId = watch("equipmentId");

  // Sync selected equipment & default hour meter
  React.useEffect(() => {
    if (watchEquipmentId) {
      const eq = equipments.find((e) => e.id === watchEquipmentId);
      if (eq) {
        setSelectedEquipment(eq);
        setValue("hourMeter", eq.currentHourMeter);
      }
    }
  }, [watchEquipmentId, equipments, setValue]);

  // Load draft from localStorage
  React.useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft && !defaultEquipmentId) {
        const parsed = JSON.parse(draft);
        if (parsed.equipmentId) setValue("equipmentId", parsed.equipmentId);
        if (parsed.inspectionTypeId) setValue("inspectionTypeId", parsed.inspectionTypeId);
        if (parsed.result) setValue("result", parsed.result);
        if (parsed.finding) setValue("finding", parsed.finding);
        if (parsed.recommendation) setValue("recommendation", parsed.recommendation);
        if (parsed.certificateNumber) setValue("certificateNumber", parsed.certificateNumber);
      }
    } catch {
      // ignore
    }
  }, [defaultEquipmentId, setValue]);

  // Save draft
  const formValues = watch();
  React.useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formValues));
    } catch {
      // ignore
    }
  }, [formValues]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Batas server adalah 10MB (serverActions.bodySizeLimit); memakai angka
    // yang sama di sini supaya berkas tidak ditolak setelah selesai terkirim.
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Ukuran file maksimal 10MB.");
      return;
    }

    setUploadingFile(true);
    try {
      // Sebelumnya di-POST ke /api/files/upload, yang tidak pernah ada —
      // hanya ada handler GET pada /api/files/[...key], jadi permintaan ini
      // selalu dibalas 405 dan unggah lampiran inspeksi tidak pernah bekerja.
      // Kini memakai server action yang sudah dijaga requireAuth() dan
      // validasi tipe berkas.
      const formData = new FormData();
      formData.append("file", file);

      const res = await uploadFormData(formData, "inspections");

      if (!res.success || !res.fileKey) {
        toast.error(res.error || "Gagal mengunggah dokumen.");
        return;
      }

      setUploadedFile({
        key: res.fileKey,
        name: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
      });

      setValue("attachmentKey", res.fileKey);
      setValue("attachmentName", file.name);
      setValue("attachmentSize", file.size);
      setValue("attachmentMime", file.type);
      toast.success("Dokumen lampiran berhasil diunggah.");
    } catch {
      toast.error("Terjadi kesalahan saat mengunggah dokumen.");
    } finally {
      setUploadingFile(false);
      // Supaya berkas yang sama bisa dipilih ulang setelah gagal
      e.target.value = "";
    }
  };

  const onSubmit = async (data: InspectionInput) => {
    // Validate hour meter
    if (selectedEquipment && data.hourMeter < selectedEquipment.currentHourMeter) {
      toast.error(
        `Hour meter (${data.hourMeter} Jam) tidak boleh lebih kecil dari data saat ini (${selectedEquipment.currentHourMeter} Jam).`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createInspection(data);
      if (res.success && res.inspectionId) {
        localStorage.removeItem(DRAFT_KEY);
        if (res.createdBreakdown) {
          toast.warning(
            `Inspeksi #${res.code} dicatat sebagai FAIL. Otomatis membuat Laporan Kerusakan #${res.createdBreakdown} dan Work Order tindak lanjut.`
          );
        } else {
          toast.success(`Inspeksi #${res.code} berhasil disimpan.`);
        }
        router.push(`/inspection/${res.inspectionId}`);
      } else {
        toast.error(res.error || "Gagal menyimpan inspeksi.");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat memproses inspeksi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 1. Unit & Header Data */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4 border-b bg-slate-50/50">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            Informasi Unit & Pelaksanaan
          </CardTitle>
          <CardDescription>
            Tentukan unit yang diinspeksi, tipe inspeksi, dan jam operasi mesin.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Equipment selection */}
            <div className="space-y-1.5">
              <Label htmlFor="equipmentId">Unit Equipment *</Label>
              <Select
                value={watch("equipmentId")}
                onValueChange={(val) => setValue("equipmentId", val)}
              >
                <SelectTrigger id="equipmentId">
                  <SelectValue placeholder="Pilih unit alat / kendaraan" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {equipments.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      <span className="font-semibold">{eq.code}</span> - {eq.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.equipmentId && (
                <p className="text-xs text-red-600">{errors.equipmentId.message}</p>
              )}
            </div>

            {/* Inspection Type */}
            <div className="space-y-1.5">
              <Label htmlFor="inspectionTypeId">Tipe Inspeksi *</Label>
              <Select
                value={watch("inspectionTypeId")}
                onValueChange={(val) => setValue("inspectionTypeId", val)}
              >
                <SelectTrigger id="inspectionTypeId">
                  <SelectValue placeholder="Pilih tipe inspeksi" />
                </SelectTrigger>
                <SelectContent>
                  {inspectionTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.inspectionTypeId && (
                <p className="text-xs text-red-600">{errors.inspectionTypeId.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Inspection Date */}
            <div className="space-y-1.5">
              <Label htmlFor="inspectionDate">Tanggal Inspeksi *</Label>
              <Input
                id="inspectionDate"
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                onChange={(e) => {
                  if (e.target.value) {
                    setValue("inspectionDate", new Date(e.target.value));
                  }
                }}
              />
              {errors.inspectionDate && (
                <p className="text-xs text-red-600">{errors.inspectionDate.message}</p>
              )}
            </div>

            {/* Hour Meter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="hourMeter">Hour Meter Saat Ini (Jam) *</Label>
                {selectedEquipment && (
                  <span className="text-xs text-muted-foreground">
                    Tersimpan: {selectedEquipment.currentHourMeter} Jam
                  </span>
                )}
              </div>
              <div className="relative">
                <Gauge className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <Input
                  id="hourMeter"
                  type="number"
                  min={selectedEquipment?.currentHourMeter || 0}
                  className="pl-9 font-mono"
                  placeholder="Contoh: 1250"
                  {...register("hourMeter", { valueAsNumber: true })}
                />
              </div>
              {errors.hourMeter && (
                <p className="text-xs text-red-600">{errors.hourMeter.message}</p>
              )}
            </div>

            {/* Inspector */}
            <div className="space-y-1.5">
              <Label htmlFor="inspectorId">Inspektor / Penanggung Jawab *</Label>
              <Select
                value={watch("inspectorId")}
                onValueChange={(val) => setValue("inspectorId", val)}
              >
                <SelectTrigger id="inspectorId">
                  <SelectValue placeholder="Pilih Inspektor" />
                </SelectTrigger>
                <SelectContent>
                  {inspectors.map((ins) => (
                    <SelectItem key={ins.id} value={ins.id}>
                      {ins.name} ({ins.nik})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Hasil & Temuan Inspeksi */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4 border-b bg-slate-50/50">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Hasil Evaluasi & Kesimpulan
          </CardTitle>
          <CardDescription>
            Pilih kesimpulan kelaikan unit dan jelaskan catatan/temuan jika ada.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          {/* Result Radio */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Hasil Pemeriksaan *</Label>
            <RadioGroup
              value={watchResult}
              onValueChange={(val: string) => setValue("result", val as InspectionResult)}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <div>
                <RadioGroupItem
                  value={InspectionResult.PASS}
                  id="res-pass"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="res-pass"
                  className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-emerald-50/40 peer-data-[state=checked]:border-emerald-600 peer-data-[state=checked]:bg-emerald-50/70 [&:has([data-state=checked])]:border-emerald-600 cursor-pointer"
                >
                  <CheckCircle2 className="mb-2 h-6 w-6 text-emerald-600" />
                  <div className="text-center">
                    <div className="font-bold text-slate-900 text-sm">Lulus</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Unit laik beroperasi penuh tanpa kendala
                    </div>
                  </div>
                </Label>
              </div>

              <div>
                <RadioGroupItem
                  value={InspectionResult.PASS_WITH_REMARK}
                  id="res-remark"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="res-remark"
                  className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-amber-50/40 peer-data-[state=checked]:border-amber-600 peer-data-[state=checked]:bg-amber-50/70 [&:has([data-state=checked])]:border-amber-600 cursor-pointer"
                >
                  <AlertTriangle className="mb-2 h-6 w-6 text-amber-600" />
                  <div className="text-center">
                    <div className="font-bold text-slate-900 text-sm">Lulus dengan catatan</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Laik beroperasi namun perlu monitoring
                    </div>
                  </div>
                </Label>
              </div>

              <div>
                <RadioGroupItem
                  value={InspectionResult.FAIL}
                  id="res-fail"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="res-fail"
                  className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-red-50/40 peer-data-[state=checked]:border-red-600 peer-data-[state=checked]:bg-red-50/70 [&:has([data-state=checked])]:border-red-600 cursor-pointer"
                >
                  <XCircle className="mb-2 h-6 w-6 text-red-600" />
                  <div className="text-center">
                    <div className="font-bold text-slate-900 text-sm">Gagal</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Unit berbahaya & wajib perbaikan segera
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* FAIL Warning alert */}
          {watchResult === InspectionResult.FAIL && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-900">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold block text-sm">
                  Peringatan Sistem: Trigger Otomatis Work Order
                </span>
                <span>
                  Menyimpan inspeksi dengan hasil <strong>Gagal</strong> akan secara otomatis:
                </span>
                <ul className="list-disc list-inside ml-1">
                  <li>Mengubah status unit menjadi <strong>Rusak</strong>.</li>
                  <li>Membuat Tiket Kerusakan (Priority: HIGH).</li>
                  <li>Menerbitkan <strong>Work Order Tindak Lanjut Inspeksi</strong>.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Finding */}
          <div className="space-y-1.5">
            <Label htmlFor="finding">
              Temuan / Catatan Inspeksi {watchResult === InspectionResult.FAIL ? "*" : "(Opsional)"}
            </Label>
            <Textarea
              id="finding"
              rows={3}
              placeholder="Deskripsikan kondisi komponen, visual inspection, atau parameter yang diukur..."
              {...register("finding")}
            />
            {errors.finding && (
              <p className="text-xs text-red-600">{errors.finding.message}</p>
            )}
          </div>

          {/* Recommendation */}
          <div className="space-y-1.5">
            <Label htmlFor="recommendation">Rekomendasi Tindak Lanjut (Opsional)</Label>
            <Textarea
              id="recommendation"
              rows={2}
              placeholder="Contoh: Penggantian seal cylinder hidrolik pada servis PM berikutnya..."
              {...register("recommendation")}
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Sertifikasi & Lampiran Dokumen */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4 border-b bg-slate-50/50">
          <CardTitle className="text-base flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-primary" />
            Sertifikat & Dokumen Pendukung
          </CardTitle>
          <CardDescription>
            Isi nomor sertifikasi izin operasi dan unggah scan sertifikat / form inspeksi (PDF/Foto).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="certificateNumber">Nomor Sertifikat / SKK (Opsional)</Label>
              <Input
                id="certificateNumber"
                placeholder="Contoh: CERT-0001"
                {...register("certificateNumber")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="validUntil">Masa Berlaku Hingga (Opsional)</Label>
              <Input
                id="validUntil"
                type="date"
                onChange={(e) => {
                  if (e.target.value) {
                    setValue("validUntil", new Date(e.target.value));
                  } else {
                    setValue("validUntil", undefined);
                  }
                }}
              />
            </div>
          </div>

          {/* File Upload to MinIO */}
          <div className="space-y-2 pt-2">
            <Label>Unggah Dokumen Sertifikat / Laporan (PDF atau Gambar)</Label>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Input
                type="file"
                accept=".pdf,image/*"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                className="file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              {uploadingFile && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Mengunggah ke MinIO...
                </div>
              )}
            </div>

            {uploadedFile && (
              <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-200">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span className="font-medium">{uploadedFile.name}</span>
                <span className="text-slate-400">
                  ({(uploadedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Batal
        </Button>
        <Button type="submit" disabled={isSubmitting} className="min-w-[140px] gap-2">
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <ClipboardCheck className="w-4 h-4" />
              Simpan Hasil Inspeksi
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
