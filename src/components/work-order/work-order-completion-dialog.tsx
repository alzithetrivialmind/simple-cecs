"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Camera, Plus, Trash2, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhotoCaptureDialog } from "@/components/shared/photo-capture-dialog";
import { technicianQuickCloseWorkOrder } from "@/server/actions/work-order";

export interface PartOption {
  id: string;
  partNumber: string;
  description: string;
  unit: string;
}

interface WorkOrderCompletionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: string;
  workOrderCode: string;
  equipmentName: string;
  initialRootCause?: string | null;
  initialCorrectiveAction?: string | null;
  initialRemark?: string | null;
  createdAt?: Date;
  breakdownReportedAt?: Date | null;
  partsList: PartOption[];
  onSuccess?: () => void;
}

export function WorkOrderCompletionDialog({
  isOpen,
  onOpenChange,
  workOrderId,
  workOrderCode,
  equipmentName,
  initialRootCause = "",
  initialCorrectiveAction = "",
  initialRemark = "",
  createdAt,
  breakdownReportedAt,
  partsList = [],
  onSuccess,
}: WorkOrderCompletionDialogProps) {
  const router = useRouter();

  const [woRootCause, setWoRootCause] = React.useState(initialRootCause || "");
  const [woCorrectiveAction, setWoCorrectiveAction] = React.useState(
    initialCorrectiveAction || ""
  );
  const [woRemark, setWoRemark] = React.useState(initialRemark || "");
  const [issuedParts, setIssuedParts] = React.useState<
    Array<{ partId: string; qty: number }>
  >([]);
  const [woPhotoUrl, setWoPhotoUrl] = React.useState<string | null>(null);
  const [woPhotoKey, setWoPhotoKey] = React.useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Calculate estimated downtime
  const startTime = breakdownReportedAt || createdAt || new Date();
  const diffMs = Math.max(0, new Date().getTime() - new Date(startTime).getTime());
  const downtimeHours = (diffMs / (1000 * 60 * 60)).toFixed(1);
  const downtimeMinutes = Math.floor(diffMs / (1000 * 60));

  // Sync initial values when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      if (initialRootCause) setWoRootCause(initialRootCause);
      if (initialCorrectiveAction) setWoCorrectiveAction(initialCorrectiveAction);
      if (initialRemark) setWoRemark(initialRemark);
    }
  }, [isOpen, initialRootCause, initialCorrectiveAction, initialRemark]);

  const handleAddPartRow = () => {
    if (partsList.length === 0) {
      toast.error("Belum ada master spare part yang terdaftar di sistem.");
      return;
    }
    setIssuedParts((prev) => [...prev, { partId: partsList[0].id, qty: 1 }]);
  };

  const handleUpdatePartRow = (index: number, partId: string, qty: number) => {
    setIssuedParts((prev) => {
      const next = [...prev];
      next[index] = { partId, qty: Math.max(1, qty) };
      return next;
    });
  };

  const handleRemovePartRow = (index: number) => {
    setIssuedParts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!woRootCause.trim() || woRootCause.trim().length < 3) {
      toast.error("Mohon isi akar masalah / temuan kerusakan minimal 3 karakter.");
      return;
    }

    if (!woCorrectiveAction.trim() || woCorrectiveAction.trim().length < 3) {
      toast.error("Mohon isi tindakan perbaikan yang telah dilakukan minimal 3 karakter.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await technicianQuickCloseWorkOrder({
        workOrderId,
        rootCause: woRootCause.trim(),
        correctiveAction: woCorrectiveAction.trim(),
        remark: woRemark.trim() || undefined,
        partsIssued: issuedParts,
        photoKey: woPhotoKey || undefined,
      });

      if (!res.success) {
        toast.error(res.error || "Gagal menyelesaikan Work Order.");
        return;
      }

      toast.success(
        `Work Order #${workOrderCode} berhasil diselesaikan dan ditutup! Total downtime: ${res.downtimeMinutes} menit. Status unit kembali READY.`
      );
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan sistem saat menyimpan hasil perbaikan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              <DialogTitle className="text-base sm:text-lg font-bold">
                Penyelesaian Perbaikan Work Order
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Lengkapi data hasil perbaikan, spare part yang dipasang, dan foto selesai untuk menutup WO #{workOrderCode} ({equipmentName}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Downtime Info Pill */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">
              <div className="flex items-center gap-2 font-medium">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Estimasi Total Downtime Unit:</span>
              </div>
              <span className="font-mono font-bold text-sm">
                {downtimeHours} Jam ({downtimeMinutes} Menit)
              </span>
            </div>

            {/* Akar Masalah */}
            <div className="space-y-1">
              <label className="font-bold text-foreground">
                Akar Masalah / Temuan Kerusakan <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="Contoh: Seal cylinder hydraulic aus karena gesekan"
                value={woRootCause}
                onChange={(e) => setWoRootCause(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Tindakan Perbaikan */}
            <div className="space-y-1">
              <label className="font-bold text-foreground">
                Tindakan Perbaikan yang Dilakukan <span className="text-rose-500">*</span>
              </label>
              <Textarea
                rows={3}
                placeholder="Contoh: Ganti seal kit cylinder baru, flushing jalur oli, dan bleeding sistem hidrolik"
                value={woCorrectiveAction}
                onChange={(e) => setWoCorrectiveAction(e.target.value)}
                className="text-xs resize-none"
              />
            </div>

            {/* Catatan / Rekomendasi Tambahan (Opsional) */}
            <div className="space-y-1">
              <label className="font-bold text-foreground">
                Catatan / Rekomendasi Tambahan (Opsional)
              </label>
              <Textarea
                rows={2}
                placeholder="Catatan untuk operator atau jadwal monitoring selanjutnya..."
                value={woRemark}
                onChange={(e) => setWoRemark(e.target.value)}
                className="text-xs resize-none"
              />
            </div>

            {/* Spare Part yang Dipakai (Issued Parts) */}
            <div className="space-y-2 p-3 bg-muted/40 rounded-xl border">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">
                  Spare Part yang Dipakai ({issuedParts.length})
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddPartRow}
                  className="h-7 text-[11px] gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Part
                </Button>
              </div>

              {issuedParts.length === 0 ? (
                <div className="text-[11px] text-muted-foreground italic">
                  Tidak ada spare part yang diganti / dipakai.
                </div>
              ) : (
                <div className="space-y-2">
                  {issuedParts.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex-1">
                        <Select
                          value={item.partId}
                          onValueChange={(val) =>
                            handleUpdatePartRow(idx, val, item.qty)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {partsList.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.partNumber} - {p.description} ({p.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-20">
                        <Input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) =>
                            handleUpdatePartRow(
                              idx,
                              item.partId,
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="h-8 text-xs text-center"
                          placeholder="Qty"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemovePartRow(idx)}
                        className="h-8 w-8 text-rose-500 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Foto Hasil Perbaikan */}
            <div className="space-y-1.5">
              <label className="font-bold text-foreground">
                Foto Dokumentasi Selesai (After Repair)
              </label>
              {woPhotoUrl ? (
                <div className="relative w-full h-36 rounded-lg overflow-hidden border bg-black group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={woPhotoUrl}
                    alt="Foto Selesai"
                    className="w-full h-full object-contain"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setWoPhotoUrl(null);
                      setWoPhotoKey(null);
                    }}
                    className="absolute top-2 right-2 h-7 px-2 text-xs"
                  >
                    Ganti Foto
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCameraOpen(true)}
                  className="w-full h-16 border-dashed border flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Camera className="h-5 w-5 text-emerald-600" />
                  <span>Ambil Foto Hasil Perbaikan dari Kamera</span>
                </Button>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="w-full sm:w-auto h-10 text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full sm:w-auto h-10 gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Selesaikan & Tutup WO (Close)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Camera Capture Dialog */}
      <PhotoCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onSuccess={(url, fileKey) => {
          setWoPhotoUrl(url);
          setWoPhotoKey(fileKey || null);
          setCameraOpen(false);
        }}
        title="Foto Dokumentasi Selesai (After Repair)"
        description="Ambil foto atau unggah bukti unit yang telah selesai diperbaiki"
        folder="work-orders"
      />
    </>
  );
}
