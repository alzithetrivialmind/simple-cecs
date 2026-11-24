"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarCheck,
  CheckSquare,
  Square,
  Loader2,
  Gauge,
  CheckCircle2,
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
import { Badge } from "@/components/ui/badge";
import { executePmSchema, ExecutePmInput } from "@/lib/validations/pm";
import { executePmPlan, getPmPlanById } from "@/server/actions/pm";
import { UserAvatar } from "@/components/shared/user-avatar";

interface ChecklistItemState {
  itemId: string;
  label: string;
  checked: boolean;
  note: string;
}

type PmPlanDetailData = NonNullable<Awaited<ReturnType<typeof getPmPlanById>>>;

interface PmExecuteFormProps {
  plan: PmPlanDetailData;
  technicians: { id: string; name: string; nik: string; avatarUrl?: string | null }[];
  currentUserId?: string;
}

export function PmExecuteForm({
  plan,
  technicians,
  currentUserId,
}: PmExecuteFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Initialize checklist items from template or default fallback
  const initialItems: ChecklistItemState[] = React.useMemo(() => {
    if (plan.checklistTemplate?.items && plan.checklistTemplate.items.length > 0) {
      return plan.checklistTemplate.items.map((i) => ({
        itemId: i.id,
        label: i.label,
        checked: false,
        note: "",
      }));
    }
    // Fallback standard items if no template configured
    return [
      { itemId: "1", label: "Pemeriksaan dan penggantian oli mesin / pelumas", checked: false, note: "" },
      { itemId: "2", label: "Penggantian filter oli, filter bahan bakar, dan filter udara", checked: false, note: "" },
      { itemId: "3", label: "Pemeriksaan sistem kelistrikan, aki, dan kabel", checked: false, note: "" },
      { itemId: "4", label: "Pengecekan sistem hidrolik, selang, dan potensi kebocoran", checked: false, note: "" },
      { itemId: "5", label: "Pelumasan grease pada seluruh joint / bearing", checked: false, note: "" },
      { itemId: "6", label: "Uji fungsi instrumen, rem, kemudi, dan safety device", checked: false, note: "" },
    ];
  }, [plan]);

  const [checklist, setChecklist] = React.useState<ChecklistItemState[]>(initialItems);

  const form = useForm<ExecutePmInput>({
    resolver: zodResolver(executePmSchema),
    defaultValues: {
      pmPlanId: plan.id,
      technicianId: currentUserId || null,
      hourMeter: plan.equipment.currentHourMeter || 0,
      executedAt: new Date(),
      results: initialItems,
      generalNote: "",
    },
  });

  const toggleCheck = (idx: number) => {
    setChecklist((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const updateItemNote = (idx: number, noteText: string) => {
    setChecklist((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, note: noteText } : item
      )
    );
  };

  const allChecked = checklist.length > 0 && checklist.every((i) => i.checked);
  const toggleAll = () => {
    setChecklist((prev) =>
      prev.map((item) => ({ ...item, checked: !allChecked }))
    );
  };

  // Sync checklist state with react-hook-form
  React.useEffect(() => {
    form.setValue("results", checklist, { shouldValidate: true });
  }, [checklist, form]);

  const checkedCount = checklist.filter((i) => i.checked).length;

  const onSubmit = async (values: ExecutePmInput) => {
    setIsSubmitting(true);
    try {
      const res = await executePmPlan(values);
      if (res.success && res.workOrderId) {
        toast.success(
          `Eksekusi PM ${plan.pmType.name} berhasil! Work Order #${res.workOrderCode} tersimpan.`
        );
        router.push(`/work-order/${res.workOrderId}`);
      } else {
        toast.error(res.error || "Gagal mengeksekusi PM.");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat menyimpan hasil PM.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-3xl mx-auto pb-16">
      {/* Plan Header Card */}
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-blue-50/50 dark:bg-blue-950/20 border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-foreground">
                  Eksekusi PM {plan.pmType.name}
                </CardTitle>
                <CardDescription className="text-xs">
                  Pengisian lembar verifikasi checklist perawatan berkala di lapangan.
                </CardDescription>
              </div>
            </div>

            <Badge variant="outline" className="w-fit text-xs font-semibold">
              Basis: {plan.basis === "HOUR_METER" ? `${plan.intervalHour} Jam` : `${plan.intervalDays} Hari`}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-5">
          {/* Unit Info Box */}
          <div className="p-4 rounded-xl bg-muted/40 border grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block">Unit Equipment:</span>
              <span className="font-bold text-foreground text-sm block">
                [{plan.equipment.code}] {plan.equipment.name}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Lokasi / Dept:</span>
              <span className="font-medium text-foreground block">
                {plan.equipment.location?.name || "-"} • {plan.equipment.department?.name || "-"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Hour Meter Terkini:</span>
              <span className="font-mono font-bold text-foreground text-sm flex items-center gap-1 mt-0.5">
                <Gauge className="h-3.5 w-3.5 text-blue-500" />
                {plan.equipment.currentHourMeter.toLocaleString("id-ID")} Jam
              </span>
            </div>
          </div>

          {/* Input Pelaksana & Jam Operasi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                Teknisi Pelaksana Eksekusi <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch("technicianId") || "NONE"}
                onValueChange={(val) => form.setValue("technicianId", val === "NONE" ? null : val)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Pilih Teknisi" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          src={t.avatarUrl}
                          name={t.name}
                          nik={t.nik}
                          size="xs"
                        />
                        <span>
                          {t.name} ({t.nik})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                Hour Meter Saat Pelaksanaan PM (Jam) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={plan.equipment.currentHourMeter}
                className="h-11 font-mono text-base"
                {...form.register("hourMeter")}
              />
              {form.formState.errors.hourMeter && (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.hourMeter.message}
                </p>
              )}
            </div>
          </div>

          {/* Checklist Section */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  Item Checklist Perawatan ({checkedCount}/{checklist.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Centang item yang telah selesai diperiksa dan dikerjakan.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium"
                onClick={toggleAll}
              >
                {allChecked ? "Batal Centang Semua" : "Centang Semua"}
              </Button>
            </div>

            <div className="space-y-2.5">
              {checklist.map((item, idx) => (
                <div
                  key={item.itemId || idx}
                  className={`p-3.5 rounded-xl border transition-colors ${
                    item.checked
                      ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                      : "bg-card border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleCheck(idx)}
                      className="mt-0.5 shrink-0 text-foreground focus:outline-none cursor-pointer select-none p-1 -m-1"
                      aria-label={item.checked ? "Batal centang" : "Centang item"}
                    >
                      {item.checked ? (
                        <CheckSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Square className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                      )}
                    </button>

                    <div className="flex-1 space-y-2">
                      <div
                        onClick={() => toggleCheck(idx)}
                        className={`text-sm font-medium cursor-pointer select-none ${
                          item.checked
                            ? "text-emerald-900 dark:text-emerald-300 line-through opacity-80"
                            : "text-foreground"
                        }`}
                      >
                        {idx + 1}. {item.label}
                      </div>

                      <Input
                        placeholder="Catatan hasil pengecekan / kondisi komponen (opsional)..."
                        value={item.note}
                        onChange={(e) => updateItemNote(idx, e.target.value)}
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* General Notes */}
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs font-semibold">Catatan Keseluruhan Eksekusi (Opsional)</Label>
            <Textarea
              placeholder="Catatan umum hasil PM, kondisi oli bekas, rekomendasi servis berikutnya..."
              rows={2}
              className="resize-none text-sm"
              {...form.register("generalNote")}
            />
          </div>

          {/* Submit Actions */}
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
              className="h-12 min-h-[44px] gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Menyimpan Eksekusi PM...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Selesaikan & Simpan Eksekusi PM
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
