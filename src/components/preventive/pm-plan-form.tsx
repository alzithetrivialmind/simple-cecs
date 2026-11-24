"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PmBasis } from "@prisma/client";
import { CalendarCheck, Loader2, Gauge, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { pmPlanSchema, PmPlanInput } from "@/lib/validations/pm";
import { createPmPlan } from "@/server/actions/pm";

interface EquipmentOption {
  id: string;
  code: string;
  name: string;
  currentHourMeter: number;
}

interface PmTypeOption {
  id: string;
  name: string;
}

interface PmPlanFormProps {
  equipments: EquipmentOption[];
  pmTypes: PmTypeOption[];
  defaultEquipmentId?: string;
}

export function PmPlanForm({
  equipments,
  pmTypes,
  defaultEquipmentId,
}: PmPlanFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const selectedInitial = equipments.find((e) => e.id === defaultEquipmentId);

  const form = useForm<PmPlanInput>({
    resolver: zodResolver(pmPlanSchema),
    defaultValues: {
      equipmentId: defaultEquipmentId || "",
      pmTypeId: "",
      basis: PmBasis.HOUR_METER,
      intervalHour: 250,
      intervalDays: 90,
      lastDoneHour: selectedInitial?.currentHourMeter || 0,
      lastDoneDate: null,
      isActive: true,
    },
  });

  const selectedBasis = form.watch("basis");
  const selectedEqId = form.watch("equipmentId");
  const selectedEq = equipments.find((e) => e.id === selectedEqId);

  React.useEffect(() => {
    if (selectedEq) {
      form.setValue("lastDoneHour", selectedEq.currentHourMeter);
    }
  }, [selectedEq, form]);

  const onSubmit = async (values: PmPlanInput) => {
    setIsSubmitting(true);
    try {
      const res = await createPmPlan(values);
      if (res.success) {
        toast.success("Jadwal PM berhasil ditambahkan ke unit!");
        router.push("/preventive");
      } else {
        toast.error(res.error || "Gagal membuat jadwal PM.");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat menyimpan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl mx-auto pb-16">
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-foreground">
                Atur Jadwal Preventive Maintenance (PM Plan)
              </CardTitle>
              <CardDescription className="text-xs">
                Tentukan interval perawatan berkala untuk unit peralatan teknik.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-5">
          {/* 1. Pilih Unit Equipment */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Unit Equipment <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.watch("equipmentId")}
              onValueChange={(val) => form.setValue("equipmentId", val, { shouldValidate: true })}
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="-- Pilih Unit Equipment --" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {equipments.map((eq) => (
                  <SelectItem key={eq.id} value={eq.id} className="py-2.5">
                    <span className="font-semibold text-sm">[{eq.code}]</span> {eq.name}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({eq.currentHourMeter} Jam)
                    </span>
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

          {/* 2. Pilih Tipe PM */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Tipe Preventive Maintenance <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.watch("pmTypeId")}
              onValueChange={(val) => form.setValue("pmTypeId", val, { shouldValidate: true })}
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="-- Pilih Tipe PM --" />
              </SelectTrigger>
              <SelectContent>
                {pmTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="py-2">
                    PM {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.pmTypeId && (
              <p className="text-xs font-medium text-destructive">
                {form.formState.errors.pmTypeId.message}
              </p>
            )}
          </div>

          {/* 3. Basis Interval: Hour Meter vs Kalender */}
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-sm font-semibold">
              Basis Penentuan Jadwal <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => form.setValue("basis", PmBasis.HOUR_METER)}
                className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-left ${
                  selectedBasis === PmBasis.HOUR_METER
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <Gauge className="h-5 w-5" />
                <span className="text-sm">Berdasarkan Jam Operasi</span>
                <span className="text-[11px] font-normal opacity-80">
                  (Hour Meter, misal 250 Jam)
                </span>
              </button>

              <button
                type="button"
                onClick={() => form.setValue("basis", PmBasis.CALENDAR)}
                className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-left ${
                  selectedBasis === PmBasis.CALENDAR
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <Calendar className="h-5 w-5" />
                <span className="text-sm">Berdasarkan Waktu Kalender</span>
                <span className="text-[11px] font-normal opacity-80">
                  (Hari / Bulan, misal 90 Hari)
                </span>
              </button>
            </div>
          </div>

          {/* 4. Parameter Sesuai Basis Terpilih */}
          {selectedBasis === PmBasis.HOUR_METER ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  Interval Perawatan (Tiap Berapa Jam?) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  placeholder="Contoh: 250"
                  className="h-11 font-mono text-base"
                  {...form.register("intervalHour")}
                />
                {form.formState.errors.intervalHour && (
                  <p className="text-xs font-medium text-destructive">
                    {form.formState.errors.intervalHour.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  Hour Meter Terakhir Dilakukan (Baseline)
                </Label>
                <Input
                  type="number"
                  placeholder="Contoh: 1000"
                  className="h-11 font-mono text-base"
                  {...form.register("lastDoneHour")}
                />
                <span className="text-[11px] text-muted-foreground">
                  Jadwal jatuh tempo: HM Terakhir + Interval
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  Interval Kalender (Tiap Berapa Hari?) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  placeholder="Contoh: 90 (3 Bulan)"
                  className="h-11 font-mono text-base"
                  {...form.register("intervalDays")}
                />
                {form.formState.errors.intervalDays && (
                  <p className="text-xs font-medium text-destructive">
                    {form.formState.errors.intervalDays.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  Tanggal Terakhir Dilakukan (Baseline)
                </Label>
                <Input
                  type="date"
                  className="h-11 text-base"
                  {...form.register("lastDoneDate")}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-12 min-h-[44px]"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="h-12 min-h-[44px] gap-2 font-semibold shadow-md"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <CalendarCheck className="h-5 w-5" />
                  Simpan Jadwal PM
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
