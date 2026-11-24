"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, AlertCircle, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  closeWorkOrderSchema,
  CloseWorkOrderInput,
} from "@/lib/validations/work-order";
import { closeWorkOrder } from "@/server/actions/work-order";

interface WorkOrderCloseDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: string;
  workOrderCode: string;
  equipmentName: string;
  initialCorrectiveAction?: string | null;
  initialRemark?: string | null;
  attachmentCount: number;
  createdAt: Date;
  breakdownReportedAt?: Date | null;
}

export function WorkOrderCloseDialog({
  isOpen,
  onOpenChange,
  workOrderId,
  workOrderCode,
  equipmentName,
  initialCorrectiveAction,
  initialRemark,
  attachmentCount,
  createdAt,
  breakdownReportedAt,
}: WorkOrderCloseDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CloseWorkOrderInput>({
    resolver: zodResolver(closeWorkOrderSchema),
    defaultValues: {
      workOrderId,
      correctiveAction: initialCorrectiveAction || "",
      remark: initialRemark || "",
      note: "",
    },
  });

  // Reset values when opened with initial props
  React.useEffect(() => {
    form.setValue("workOrderId", workOrderId);
    if (initialCorrectiveAction) {
      form.setValue("correctiveAction", initialCorrectiveAction);
    }
  }, [isOpen, workOrderId, initialCorrectiveAction, form]);

  const hasPhotos = attachmentCount > 0;

  // Calculate estimated downtime
  const startTime = breakdownReportedAt || createdAt;
  const diffMs = Math.max(0, new Date().getTime() - new Date(startTime).getTime());
  const downtimeHours = (diffMs / (1000 * 60 * 60)).toFixed(1);
  const downtimeMinutes = Math.floor(diffMs / (1000 * 60));

  const onSubmit = async (values: CloseWorkOrderInput) => {
    if (!hasPhotos) {
      toast.error(
        "Wajib mengunggah minimal 1 foto dokumentasi perbaikan di tab 'Foto & Dokumen' sebelum menutup Work Order."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await closeWorkOrder(values);
      if (res.success) {
        toast.success(
          `Work Order #${workOrderCode} berhasil ditutup! Unit ${equipmentName} kembali ke status READY. Total downtime: ${res.downtimeMinutes} menit.`
        );
        onOpenChange(false);
      } else {
        toast.error(res.error || "Gagal menutup Work Order.");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
            <DialogTitle className="text-xl">Tutup Work Order (Close WO)</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Menutup WO #{workOrderCode} untuk unit <strong>{equipmentName}</strong>. Unit akan otomatis dikembalikan ke status <strong>READY</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Downtime Info Pill */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-300">
            <div className="flex items-center gap-1.5 font-medium">
              <Clock className="h-4 w-4 text-blue-600" />
              <span>Estimasi Total Downtime Unit:</span>
            </div>
            <span className="font-mono font-bold text-sm">
              {downtimeHours} Jam ({downtimeMinutes} Menit)
            </span>
          </div>

          {/* Photo attachment validation banner */}
          {!hasPhotos && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <strong>Belum ada foto dokumentasi!</strong>
                <p>Silakan unggah minimal 1 foto perbaikan pada tab Foto & Dokumen sebelum menutup Work Order.</p>
              </div>
            </div>
          )}

          {/* Corrective Action */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              Tindakan Perbaikan (Corrective Action) <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Jelaskan tindakan teknis yang telah dilakukan mekanik hingga unit normal kembali..."
              rows={3}
              className="resize-none text-sm"
              {...form.register("correctiveAction")}
            />
            {form.formState.errors.correctiveAction && (
              <p className="text-xs font-medium text-destructive">
                {form.formState.errors.correctiveAction.message}
              </p>
            )}
          </div>

          {/* Catatan Tambahan Supervisor */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Catatan / Rekomendasi Tambahan (Opsional)</Label>
            <Textarea
              placeholder="Catatan untuk operator atau jadwal monitoring selanjutnya..."
              rows={2}
              className="resize-none text-sm"
              {...form.register("remark")}
            />
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
              disabled={isSubmitting || !hasPhotos}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menutup WO...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Setujui & Tutup WO
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
