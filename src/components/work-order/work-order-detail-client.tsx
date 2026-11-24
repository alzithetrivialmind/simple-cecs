"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  WorkOrderStatus,
  WorkOrderType,
  Priority,
} from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  Camera,
  Play,
  Pause,
  Loader2,
  History,
  FileText,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { WORK_ORDER_TYPE } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTimeIndo } from "@/lib/utils";
import {
  WorkOrderCompletionDialog,
  PartOption,
} from "./work-order-completion-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { PhotoCaptureDialog } from "@/components/shared/photo-capture-dialog";
import {
  assignWorkOrder,
  updateWorkOrderStatus,
  updateDiagnosis,
  updateRepairResult,
  saveWorkOrderCapturedPhoto,
  deleteWorkOrder,
} from "@/server/actions/work-order";

interface TechnicianOption {
  id: string;
  name: string;
  nik: string;
  role: string;
  avatarUrl?: string | null;
}

export interface AttachmentItem {
  id: string;
  kind: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface PartUsageItem {
  id: string;
  qty: number;
  part: {
    id: string;
    partNumber: string;
    description: string;
    unit: string;
  };
}

export interface StatusHistoryItem {
  id: string;
  fromStatus: WorkOrderStatus | null;
  toStatus: WorkOrderStatus;
  changedAt: Date;
  note: string | null;
  changedBy: {
    id: string;
    name: string;
    nik: string;
    role: string;
    avatarUrl?: string | null;
  };
}

export interface WorkOrderDetailData {
  id: string;
  code: string;
  type: WorkOrderType;
  status: WorkOrderStatus;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  closedAt: Date | null;
  downtimeMinutes: number | null;
  assignedToId: string | null;
  externalServiceBy: string | null;
  equipment: {
    id: string;
    code: string;
    name: string;
    department?: { id: string; name: string } | null;
    location?: { id: string; name: string } | null;
  };
  breakdownRequest?: {
    id: string;
    code: string;
    problem: string;
    priority: Priority;
    reportedAt: Date;
    reportedBy: { id: string; name: string; nik: string; avatarUrl?: string | null };
  } | null;
  assignedTo?: { id: string; name: string; nik: string; role: string; avatarUrl?: string | null } | null;
  closedBy?: { id: string; name: string; nik: string; role: string; avatarUrl?: string | null } | null;
  diagnosis?: {
    finding: string;
    rootCause: string;
    recommendation?: string | null;
  } | null;
  repairResult?: {
    correctiveAction: string;
    remark?: string | null;
  } | null;
  attachments?: AttachmentItem[];
  partUsages?: PartUsageItem[];
  statusHistory: StatusHistoryItem[];
}

interface WorkOrderDetailProps {
  workOrder: WorkOrderDetailData;
  technicians: TechnicianOption[];
  partsList?: PartOption[];
  userRole?: string;
}


export function WorkOrderDetailClient({
  workOrder,
  technicians,
  partsList = [],
  userRole,
}: WorkOrderDetailProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState("overview");
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = React.useState(false);

  // Auto-open completion dialog if redirected with ?action=complete, or focus diagnosis if ?action=diagnose
  React.useEffect(() => {
    const action = searchParams?.get("action");
    if (action === "complete") {
      setIsCompletionDialogOpen(true);
    } else if (action === "diagnose") {
      setActiveTab("overview");
      setTimeout(() => {
        const el = document.getElementById("diagnosis-section");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const input = document.getElementById("finding-input");
          if (input) {
            input.focus();
          }
        }
      }, 200);
    }
  }, [searchParams]);

  // Quick Assignment State
  const [assignedTechId, setAssignedTechId] = React.useState<string>(
    workOrder.assignedToId || "NONE"
  );
  const [isAssigning, setIsAssigning] = React.useState(false);

  // Diagnosis Form State
  const [finding, setFinding] = React.useState(workOrder.diagnosis?.finding || "");
  const [rootCause, setRootCause] = React.useState(workOrder.diagnosis?.rootCause || "");
  const [recommendation, setRecommendation] = React.useState(
    workOrder.diagnosis?.recommendation || ""
  );
  const [isSavingDiagnosis, setIsSavingDiagnosis] = React.useState(false);

  // Repair Result Form State
  const [correctiveAction, setCorrectiveAction] = React.useState(
    workOrder.repairResult?.correctiveAction || ""
  );
  const [remark, setRemark] = React.useState(workOrder.repairResult?.remark || "");
  const [isSavingRepair, setIsSavingRepair] = React.useState(false);

  // Attachment Upload State
  const [uploadKind, setUploadKind] = React.useState<string>("PHOTO");
  const [isWoPhotoDialogOpen, setIsWoPhotoDialogOpen] = React.useState(false);

  const handleWoPhotoCaptureSuccess = async (url: string, fileKey?: string) => {
    if (!fileKey) return;
    try {
      const res = await saveWorkOrderCapturedPhoto({
        workOrderId: workOrder.id,
        fileKey,
        kind: uploadKind,
      });
      if (res.success) {
        toast.success("Foto dokumentasi perbaikan berhasil disimpan!");
      } else {
        toast.error(res.error || "Gagal menyimpan foto dokumentasi.");
      }
    } catch {
      toast.error("Terjadi kesalahan saat menyimpan foto.");
    }
  };

  const canManage = userRole === "ADMIN" || userRole === "SUPERVISOR";
  const canPerform = canManage || userRole === "TECHNICIAN";
  const isClosed = workOrder.status === WorkOrderStatus.CLOSED;

  const handleStatusChange = async (
    targetStatus: WorkOrderStatus,
    defaultNote?: string
  ) => {
    setIsUpdatingStatus(true);
    try {
      const res = await updateWorkOrderStatus({
        workOrderId: workOrder.id,
        toStatus: targetStatus,
        note: defaultNote,
      });

      if (res.success) {
        toast.success(`Status Work Order berhasil diubah ke ${targetStatus}`);
      } else {
        toast.error(res.error || "Gagal mengubah status.");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat memperbarui status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAssignSubmit = async (techId: string) => {
    setAssignedTechId(techId);
    setIsAssigning(true);
    try {
      const res = await assignWorkOrder({
        workOrderId: workOrder.id,
        assignedToId: techId === "NONE" ? null : techId,
      });

      if (res.success) {
        toast.success("Penugasan teknisi berhasil diperbarui!");
      } else {
        toast.error(res.error || "Gagal menugaskan teknisi.");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem.");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSaveDiagnosis = async () => {
    if (!finding.trim() || !rootCause.trim()) {
      toast.error("Temuan teknis dan akar penyebab wajib diisi.");
      return;
    }

    setIsSavingDiagnosis(true);
    try {
      const res = await updateDiagnosis({
        workOrderId: workOrder.id,
        finding,
        rootCause,
        recommendation,
      });

      if (res.success) {
        toast.success("Data diagnosis berhasil disimpan!");
      } else {
        toast.error(res.error || "Gagal menyimpan diagnosis.");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem.");
    } finally {
      setIsSavingDiagnosis(false);
    }
  };

  const handleSaveRepairResult = async () => {
    if (!correctiveAction.trim()) {
      toast.error("Tindakan perbaikan wajib diisi.");
      return;
    }

    setIsSavingRepair(true);
    try {
      const res = await updateRepairResult({
        workOrderId: workOrder.id,
        correctiveAction,
        remark,
      });

      if (res.success) {
        toast.success("Hasil perbaikan berhasil disimpan!");
      } else {
        toast.error(res.error || "Gagal menyimpan hasil perbaikan.");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem.");
    } finally {
      setIsSavingRepair(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Apakah Anda yakin ingin menghapus Work Order ${workOrder.code}?`)) {
      try {
        const res = await deleteWorkOrder(workOrder.id);
        if (res.success) {
          toast.success("Work Order berhasil dihapus.");
          router.push("/work-order");
        } else {
          toast.error(res.error || "Gagal menghapus Work Order.");
        }
      } catch {
        toast.error("Terjadi kesalahan sistem");
      }
    }
  };

  const status = workOrder.status as WorkOrderStatus;

  // Satu aksi utama per status (UI-SPEC). Tutup WO hanya untuk supervisor/admin.
  const primaryAction: { label: string; onClick: () => void; disabled?: boolean; note?: string } | null =
    isClosed || !canPerform
      ? null
      : status === WorkOrderStatus.OPEN
        ? {
            label: "Mulai kerjakan",
            onClick: () => handleStatusChange(WorkOrderStatus.IN_PROGRESS, "Teknisi mulai mengerjakan."),
          }
        : status === WorkOrderStatus.WAITING_PART
          ? {
              label: "Lanjutkan pengerjaan",
              onClick: () => handleStatusChange(WorkOrderStatus.IN_PROGRESS, "Part tersedia, pengerjaan dilanjutkan."),
            }
          : status === WorkOrderStatus.IN_PROGRESS
            ? { label: canManage ? "Selesaikan & tutup WO" : "Tandai selesai", onClick: () => setIsCompletionDialogOpen(true) }
            : {
                label: "Tutup WO",
                onClick: () => setIsCompletionDialogOpen(true),
                disabled: !canManage,
                note: canManage ? undefined : "Menunggu supervisor menutup WO.",
              };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-16">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/work-order"
          className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 px-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Work order
        </Link>
        {userRole === "ADMIN" && (
          <Button
            variant="ghost"
            onClick={handleDelete}
            className="h-10 gap-1.5 px-3 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Hapus
          </Button>
        )}
      </div>

      {/* Header WO */}
      <section className="rounded-lg border bg-card">
        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="font-condensed text-3xl font-bold leading-none tracking-tight sm:text-4xl">{workOrder.code}</h1>
            <StatusBadge kind="workOrder" status={status} className="text-sm" />
            {workOrder.breakdownRequest && <StatusBadge kind="priority" status={workOrder.breakdownRequest.priority} />}
          </div>
          <Link href={`/equipment/${workOrder.equipment.id}`} className="block hover:underline">
            <span className="font-condensed text-xl font-bold">{workOrder.equipment.code}</span>{" "}
            <span className="font-medium">{workOrder.equipment.name}</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            {WORK_ORDER_TYPE[workOrder.type as WorkOrderType]}, dibuat {formatDateTimeIndo(workOrder.createdAt)}
            {workOrder.equipment.location?.name && `, ${workOrder.equipment.location.name}`}
          </p>
        </div>

        <dl className="grid grid-cols-2 border-t text-sm [&>div]:p-3 [&>div:first-child]:border-r">
          <div>
            <dt className="text-muted-foreground">Teknisi</dt>
            <dd className="mt-0.5 flex items-center gap-2 font-medium">
              {workOrder.assignedTo ? (
                <>
                  <UserAvatar
                    src={workOrder.assignedTo.avatarUrl}
                    name={workOrder.assignedTo.name}
                    nik={workOrder.assignedTo.nik}
                    size="xs"
                  />
                  <span className="truncate">{workOrder.assignedTo.name}</span>
                </>
              ) : (
                <span className="text-muted-foreground">{workOrder.externalServiceBy || "Belum ditugaskan"}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Downtime</dt>
            <dd className="mt-0.5 font-medium tabular-nums">
              {isClosed && workOrder.downtimeMinutes !== null
                ? `${(workOrder.downtimeMinutes / 60).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jam`
                : "Dihitung saat WO ditutup"}
            </dd>
          </div>
        </dl>

        {!isClosed && canManage && (
          <div className="border-t p-3">
            <label className="mb-1 block text-sm text-muted-foreground" htmlFor="wo-assign">
              Tugaskan teknisi
            </label>
            <Select value={assignedTechId} onValueChange={handleAssignSubmit} disabled={isAssigning}>
              <SelectTrigger id="wo-assign" className="h-11">
                <SelectValue placeholder="Pilih teknisi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Belum ditugaskan</SelectItem>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </section>

      {/* Aksi utama: menempel di bawah layar HP */}
      {primaryAction && (
        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 lg:bottom-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="h-12 flex-1 gap-2 text-base font-semibold sm:flex-none sm:px-6"
              onClick={primaryAction.onClick}
              disabled={isUpdatingStatus || primaryAction.disabled}
            >
              {status === WorkOrderStatus.OPEN || status === WorkOrderStatus.WAITING_PART ? (
                <Play className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              {primaryAction.label}
            </Button>
            {status === WorkOrderStatus.IN_PROGRESS && (
              <Button
                variant="outline"
                className="h-12 gap-2"
                onClick={() => handleStatusChange(WorkOrderStatus.WAITING_PART, "Menunggu part.")}
                disabled={isUpdatingStatus}
              >
                <Pause className="h-4 w-4" />
                Tunggu part
              </Button>
            )}
          </div>
          {primaryAction.note && <p className="mt-1.5 text-sm text-muted-foreground">{primaryAction.note}</p>}
        </div>
      )}

      {/* Main Tabbed Detail View */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex w-full h-12 p-1 bg-muted rounded-xl lg:grid lg:grid-cols-5">
          <TabsTrigger value="overview" className="text-xs">
            Diagnosis
          </TabsTrigger>
          <TabsTrigger value="repair" className="text-xs">
            Hasil Perbaikan
          </TabsTrigger>
          <TabsTrigger value="attachments" className="text-xs">
            Foto & Dokumen ({workOrder.attachments?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="parts" className="text-xs">
            Spare Part ({workOrder.partUsages?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs">
            Riwayat Status
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Diagnosis & Problem */}
        <TabsContent value="overview" className="space-y-4">
          {workOrder.breakdownRequest && (
            <Card className="border-red-200 dark:border-red-950 bg-red-50/30 dark:bg-red-950/10">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Laporan Kerusakan Awal ({workOrder.breakdownRequest.code})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2 text-xs">
                <p className="text-foreground text-sm font-medium">
                  &quot;{workOrder.breakdownRequest.problem}&quot;
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <UserAvatar
                    src={workOrder.breakdownRequest.reportedBy.avatarUrl}
                    name={workOrder.breakdownRequest.reportedBy.name}
                    nik={workOrder.breakdownRequest.reportedBy.nik}
                    size="sm"
                  />
                  <div className="text-xs">
                    <div className="font-semibold text-foreground">
                      Pelapor: {workOrder.breakdownRequest.reportedBy.name} ({workOrder.breakdownRequest.reportedBy.nik})
                    </div>
                    <div className="text-muted-foreground">
                      Waktu Lapor: {formatDateTimeIndo(workOrder.breakdownRequest.reportedAt)}
                    </div>
                  </div>
                </div>

                {/* Foto Lampiran Kerusakan */}
                {workOrder.attachments && workOrder.attachments.filter((a) => a.kind === "PHOTO_BEFORE" || a.kind === "PHOTO").length > 0 && (
                  <div className="pt-3 border-t border-red-200/60 dark:border-red-900/40">
                    <span className="text-[11px] font-bold text-red-800 dark:text-red-300 block mb-1.5">
                      Lampiran Foto Kerusakan:
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      {workOrder.attachments
                        .filter((a) => a.kind === "PHOTO_BEFORE" || a.kind === "PHOTO")
                        .map((att) => (
                          <a
                            key={att.id}
                            href={`/api/files/${att.fileKey}`}
                            target="_blank"
                            rel="noreferrer"
                            className="group relative rounded-xl border border-red-300 dark:border-red-800 overflow-hidden w-28 h-28 bg-black block shadow-sm hover:border-red-500 transition-colors"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/files/${att.fileKey}`}
                              alt={att.fileName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-x-0 bottom-0 p-1 bg-black/60 text-[9px] text-white truncate text-center">
                              Lihat Foto
                            </div>
                          </a>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card
            id="diagnosis-section"
            className={
              searchParams?.get("action") === "diagnose"
                ? "ring-2 ring-blue-500 shadow-md transition-all"
                : ""
            }
          >
            <CardHeader className="p-4 sm:p-6 pb-3">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span>Diagnosis Teknis Lapangan</span>
                {searchParams?.get("action") === "diagnose" && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold animate-pulse">
                    Mode Input Temuan
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Temuan Masalah (Finding)</Label>
                <Textarea
                  id="finding-input"
                  placeholder="Temuan fisik kerusakan saat inspeksi teknisi..."
                  rows={3}
                  value={finding}
                  onChange={(e) => setFinding(e.target.value)}
                  disabled={isClosed || !canPerform}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Penyebab Utama (Root Cause)</Label>
                <Textarea
                  placeholder="Analisa penyebab utama kerusakan (contoh: keausan seal, kebocoran oli, overheat)..."
                  rows={3}
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  disabled={isClosed || !canPerform}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Rekomendasi Tindakan Lanjut (Opsional)</Label>
                <Textarea
                  placeholder="Rekomendasi pencegahan atau servis berkala berikutnya..."
                  rows={2}
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  disabled={isClosed || !canPerform}
                  className="resize-none"
                />
              </div>

              {!isClosed && canPerform && (
                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleSaveDiagnosis}
                    disabled={isSavingDiagnosis}
                    className="gap-1.5"
                  >
                    {isSavingDiagnosis ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Simpan Diagnosis
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Repair Result */}
        <TabsContent value="repair" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-3">
              <CardTitle className="text-base font-bold">
                Tindakan & Hasil Perbaikan (Repair Result)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  Tindakan Perbaikan (Corrective Action) <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  placeholder="Jelaskan tindakan perbaikan yang telah dikerjakan oleh teknisi..."
                  rows={4}
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  disabled={isClosed || !canPerform}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Catatan Tambahan (Remark)</Label>
                <Textarea
                  placeholder="Catatan pengetesan fungsi, tes jalan, atau parameter normal..."
                  rows={2}
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  disabled={isClosed || !canPerform}
                  className="resize-none"
                />
              </div>

              {/* Foto Bukti Hasil Perbaikan */}
              {workOrder.attachments && workOrder.attachments.filter((a) => a.kind === "PHOTO_AFTER" || a.kind === "PHOTO").length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs font-semibold block text-foreground">
                    Lampiran Foto Hasil Perbaikan / Pengerjaan:
                  </Label>
                  <div className="flex flex-wrap gap-2.5">
                    {workOrder.attachments
                      .filter((a) => a.kind === "PHOTO_AFTER" || a.kind === "PHOTO")
                      .map((att) => (
                        <a
                          key={att.id}
                          href={`/api/files/${att.fileKey}`}
                          target="_blank"
                          rel="noreferrer"
                          className="group relative rounded-xl border overflow-hidden w-28 h-28 bg-black block shadow-sm hover:border-primary transition-colors"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/files/${att.fileKey}`}
                            alt={att.fileName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-x-0 bottom-0 p-1 bg-black/60 text-[9px] text-white truncate text-center">
                            Lihat Foto
                          </div>
                        </a>
                      ))}
                  </div>
                </div>
              )}

              {/* Timestamp Tracking */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-muted/40 text-xs">
                <div>
                  <span className="text-muted-foreground block">Mulai Pengerjaan:</span>
                  <span className="font-semibold text-foreground">
                    {workOrder.startedAt ? formatDateTimeIndo(workOrder.startedAt) : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Selesai Pengerjaan:</span>
                  <span className="font-semibold text-foreground">
                    {workOrder.finishedAt ? formatDateTimeIndo(workOrder.finishedAt) : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Ditutup (Closed):</span>
                  <span className="font-semibold text-foreground">
                    {workOrder.closedAt ? formatDateTimeIndo(workOrder.closedAt) : "-"}
                  </span>
                </div>
              </div>

              {!isClosed && canPerform && (
                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleSaveRepairResult}
                    disabled={isSavingRepair}
                    className="gap-1.5"
                  >
                    {isSavingRepair ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Simpan Hasil Perbaikan
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Attachments (MinIO) */}
        <TabsContent value="attachments" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">
                  Dokumentasi Foto & Berkas Lampiran
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Foto kondisi sebelum perbaikan, proses pengerjaan, dan kondisi selesai.
                </p>
              </div>

              {!isClosed && canPerform && (
                <div className="flex items-center gap-2">
                  <Select value={uploadKind} onValueChange={setUploadKind}>
                    <SelectTrigger className="h-9 text-xs w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PHOTO_BEFORE">Foto Sebelum</SelectItem>
                      <SelectItem value="PHOTO_AFTER">Foto Selesai</SelectItem>
                      <SelectItem value="PHOTO">Foto Umum</SelectItem>
                      <SelectItem value="DOCUMENT">Dokumen</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsWoPhotoDialogOpen(true)}
                    className="gap-1.5 h-9 bg-primary hover:bg-primary/90 text-white font-semibold cursor-pointer"
                  >
                    <Camera className="h-4 w-4" />
                    Ambil / Unggah Foto
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-4 sm:p-6 pt-0">
              {!workOrder.attachments || workOrder.attachments.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-xl text-muted-foreground text-xs">
                  Belum ada foto atau dokumen yang diunggah.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {workOrder.attachments.map((att: AttachmentItem) => (
                    <a
                      key={att.id}
                      href={`/api/files/${att.fileKey}`}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative rounded-xl border overflow-hidden aspect-square bg-muted block hover:border-primary/60 transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/files/${att.fileKey}`}
                        alt={att.fileName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-white text-[11px] truncate">
                        <Badge variant="outline" className="text-[9px] bg-black/40 text-white border-white/20 mb-1">
                          {att.kind}
                        </Badge>
                        <p className="truncate">{att.fileName}</p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Spare Parts (Ready for M5) */}
        <TabsContent value="parts" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-3">
              <CardTitle className="text-base font-bold">
                Penggunaan Suku Cadang (Spare Part)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {!workOrder.partUsages || workOrder.partUsages.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-xl text-muted-foreground text-xs">
                  Tidak ada pemakaian spare part yang dicatat pada Work Order ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {workOrder.partUsages.map((pu: PartUsageItem) => (
                    <div
                      key={pu.id}
                      className="flex items-center justify-between p-3 rounded-lg border text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-primary">
                          {pu.part.partNumber}
                        </span>
                        <p className="font-medium text-foreground">{pu.part.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-sm">
                          {pu.qty} {pu.part.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: Status History (Audit Trail) */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                Histori Perubahan Status & Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                {workOrder.statusHistory.map((hist: StatusHistoryItem) => (
                  <div key={hist.id} className="relative space-y-1">
                    <div className="absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs font-semibold">
                        {hist.toStatus}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTimeIndo(hist.changedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      <UserAvatar
                        src={hist.changedBy.avatarUrl}
                        name={hist.changedBy.name}
                        nik={hist.changedBy.nik}
                        size="xs"
                      />
                      <p className="text-xs text-foreground font-medium">
                        Oleh: <strong>{hist.changedBy.name}</strong> ({hist.changedBy.nik})
                      </p>
                    </div>
                    {hist.note && (
                      <p className="text-xs text-muted-foreground bg-muted/40 p-2 rounded-lg italic">
                        &quot;{hist.note}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Single Unified Completion & Close Dialog Component */}
      <WorkOrderCompletionDialog
        isOpen={isCompletionDialogOpen}
        onOpenChange={setIsCompletionDialogOpen}
        workOrderId={workOrder.id}
        workOrderCode={workOrder.code}
        equipmentName={`[${workOrder.equipment.code}] ${workOrder.equipment.name}`}
        initialRootCause={
          workOrder.breakdownRequest?.problem
            ? `Pemeriksaan kendala: ${workOrder.breakdownRequest.problem}`
            : workOrder.diagnosis?.rootCause || ""
        }
        initialCorrectiveAction={workOrder.repairResult?.correctiveAction || ""}
        initialRemark={workOrder.repairResult?.remark || ""}
        createdAt={workOrder.createdAt}
        breakdownReportedAt={workOrder.breakdownRequest?.reportedAt}
        partsList={partsList}
      />

      {/* WO Photo Capture Dialog (Camera / Upload) */}
      <PhotoCaptureDialog
        open={isWoPhotoDialogOpen}
        onOpenChange={setIsWoPhotoDialogOpen}
        onSuccess={handleWoPhotoCaptureSuccess}
        title={`Dokumentasi Work Order ${workOrder.code}`}
        description="Ambil foto kondisi perbaikan dengan kamera langsung (belakang/depan) atau unggah berkas dari perangkat."
        folder="work-orders"
      />
    </div>
  );
}
