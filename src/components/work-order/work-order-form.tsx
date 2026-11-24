"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { WorkOrderType } from "@prisma/client";
import { Wrench, Loader2, CalendarCheck, ClipboardList, AlertTriangle } from "lucide-react";
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
  createWorkOrderSchema,
  CreateWorkOrderInput,
} from "@/lib/validations/work-order";
import { createWorkOrder } from "@/server/actions/work-order";

interface EquipmentOption {
  id: string;
  code: string;
  name: string;
  category: string;
}

interface TechnicianOption {
  id: string;
  name: string;
  nik: string;
}

interface WorkOrderFormProps {
  equipments: EquipmentOption[];
  technicians: TechnicianOption[];
  defaultEquipmentId?: string;
}

export function WorkOrderForm({
  equipments,
  technicians,
  defaultEquipmentId,
}: WorkOrderFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CreateWorkOrderInput>({
    resolver: zodResolver(createWorkOrderSchema),
    defaultValues: {
      equipmentId: defaultEquipmentId || "",
      type: WorkOrderType.CORRECTIVE,
      assignedToId: null,
      externalServiceBy: null,
      problem: "",
    },
  });

  const onSubmit = async (values: CreateWorkOrderInput) => {
    setIsSubmitting(true);
    try {
      const res = await createWorkOrder(values);
      if (res.success && res.data) {
        toast.success(`Work Order #${res.data.code} berhasil dibuat!`);
        router.push(`/work-order/${res.data.id}`);
      } else {
        toast.error(res.error || "Gagal membuat Work Order.");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat membuat Work Order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl mx-auto pb-16">
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-foreground">
                Buat Work Order Baru
              </CardTitle>
              <CardDescription className="text-xs">
                Terbitkan perintah kerja teknis baru untuk unit equipment.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-5">
          {/* Unit Equipment */}
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
                  <SelectItem key={eq.id} value={eq.id} className="py-2">
                    <span className="font-semibold text-sm">[{eq.code}]</span> {eq.name}
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

          {/* Tipe Work Order */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Tipe Work Order <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.watch("type")}
              onValueChange={(val) =>
                form.setValue("type", val as WorkOrderType, { shouldValidate: true })
              }
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Pilih Tipe Work Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={WorkOrderType.CORRECTIVE}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span>CORRECTIVE (Perbaikan Kerusakan)</span>
                  </div>
                </SelectItem>
                <SelectItem value={WorkOrderType.PREVENTIVE}>
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-blue-500" />
                    <span>PREVENTIVE (Perawatan Rutin)</span>
                  </div>
                </SelectItem>
                <SelectItem value={WorkOrderType.INSPECTION_FOLLOW_UP}>
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-amber-500" />
                    <span>INSPECTION FOLLOW UP (Tindak Lanjut Temuan)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.type && (
              <p className="text-xs font-medium text-destructive">
                {form.formState.errors.type.message}
              </p>
            )}
          </div>

          {/* Deskripsi Masalah / Lingkup Pekerjaan */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Deskripsi Masalah / Instruksi Pekerjaan <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Jelaskan detail keluhan, instruksi pengerjaan, atau lingkup perbaikan..."
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

          {/* Penugasan Teknisi atau Servis Luar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tugaskan Teknisi Internal</Label>
              <Select
                value={form.watch("assignedToId") || "NONE"}
                onValueChange={(val) =>
                  form.setValue("assignedToId", val === "NONE" ? null : val)
                }
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="-- Pilih Teknisi --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">-- Belum Ditugaskan --</SelectItem>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.nik})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Atau Servis Eksternal (Vendor/Bengkel Luar)</Label>
              <Input
                placeholder="Contoh: Nama bengkel"
                className="h-12 text-base"
                {...form.register("externalServiceBy")}
              />
            </div>
          </div>

          {/* Action Buttons */}
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
                  <Wrench className="h-5 w-5" />
                  Terbitkan Work Order
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
