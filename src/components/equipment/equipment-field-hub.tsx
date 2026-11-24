"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EquipmentStatus,
  Priority,
  Role,
  WorkOrderStatus,
  WorkOrderType,
} from "@prisma/client";
import {
  Play,
  Square,
  AlertTriangle,
  Wrench,
  CalendarCheck,
  ClipboardCheck,
  UserCheck,
  CheckCircle2,
  Camera,
  ChevronRight,
  ShieldAlert,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { PhotoCaptureDialog } from "@/components/shared/photo-capture-dialog";
import { toast } from "sonner";
import {
  startEquipmentUsage,
  finishEquipmentUsage,
} from "@/server/actions/usage-session";
import { createBreakdownRequest } from "@/server/actions/breakdown";
import {
  startWorkOrderExecution,
  assignWorkOrder,
} from "@/server/actions/work-order";
import { UserAvatar } from "@/components/shared/user-avatar";

export interface FieldHubEquipment {
  id: string;
  code: string;
  name: string;
  category: string;
  status: EquipmentStatus;
  photoUrl?: string | null;
  currentHourMeter: number;
  location?: { name: string } | null;
  department?: { name: string } | null;
}

export interface FieldHubUser {
  id: string;
  name: string;
  nik: string;
  role: Role;
  avatarUrl?: string | null;
}

export interface FieldHubActiveSession {
  id: string;
  operatorId: string;
  startAt: Date | string;
  startPhotoUrl: string;
  remarks?: string | null;
  operator: {
    id: string;
    name: string;
    nik: string;
    avatarUrl?: string | null;
  };
}

export interface FieldHubWorkOrder {
  id: string;
  code: string;
  type: WorkOrderType;
  status: WorkOrderStatus;
  assignedToId?: string | null;
  assignedTo?: { name: string; nik: string; avatarUrl?: string | null } | null;
  startedAt?: Date | string | null;
  breakdownRequest?: {
    problem: string;
    priority: Priority;
    reportedBy?: { name: string; avatarUrl?: string | null } | null;
  } | null;
}

export interface FieldHubPartItem {
  id: string;
  partNumber: string;
  description: string;
  unit: string;
}

export interface FieldHubTechnicianItem {
  id: string;
  name: string;
  nik: string;
  avatarUrl?: string | null;
}

interface EquipmentFieldHubProps {
  equipment: FieldHubEquipment;
  currentUser: FieldHubUser | null;
  activeSession: FieldHubActiveSession | null;
  activeWorkOrders: FieldHubWorkOrder[];
  partsList: FieldHubPartItem[];
  techniciansList: FieldHubTechnicianItem[];
  onEquipmentChange?: (newStatus: EquipmentStatus, newHourMeter?: number) => void;
}

export function EquipmentFieldHub({
  equipment,
  currentUser,
  activeSession: initialSession,
  activeWorkOrders: initialWorkOrders,
  techniciansList,
  onEquipmentChange,
}: EquipmentFieldHubProps) {
  const router = useRouter();

  // Local state
  const [activeSession, setActiveSession] = React.useState<FieldHubActiveSession | null>(
    initialSession
  );
  const [currentStatus, setCurrentStatus] = React.useState<EquipmentStatus>(
    equipment.status
  );
  const [currentHourMeter, setCurrentHourMeter] = React.useState<number>(
    equipment.currentHourMeter
  );
  const [workOrders, setWorkOrders] = React.useState<FieldHubWorkOrder[]>(
    initialWorkOrders
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    setActiveSession(initialSession);
  }, [initialSession]);

  React.useEffect(() => {
    setCurrentStatus(equipment.status);
  }, [equipment.status]);

  React.useEffect(() => {
    setCurrentHourMeter(equipment.currentHourMeter);
  }, [equipment.currentHourMeter]);

  React.useEffect(() => {
    setWorkOrders(initialWorkOrders);
  }, [initialWorkOrders]);

  // Camera dialog state
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [cameraPurpose, setCameraPurpose] = React.useState<
    "START_USAGE" | "FINISH_USAGE" | "BREAKDOWN"
  >("START_USAGE");

  // Operator Usage State
  const [startPhotoUrl, setStartPhotoUrl] = React.useState<string | null>(null);
  const [startRemarks, setStartRemarks] = React.useState("");
  const [startHourMeter, setStartHourMeter] = React.useState("");
  const [startDialogOpen, setStartDialogOpen] = React.useState(false);

  const [endPhotoUrl, setEndPhotoUrl] = React.useState<string | null>(null);
  const [endRemarks, setEndRemarks] = React.useState("");
  const [endHourMeter, setEndHourMeter] = React.useState("");
  const [finishDialogOpen, setFinishDialogOpen] = React.useState(false);

  // Breakdown Dialog State
  const [breakdownDialogOpen, setBreakdownDialogOpen] = React.useState(false);
  const [breakdownPhotoUrl, setBreakdownPhotoUrl] = React.useState<string | null>(null);
  const [breakdownPhotoKey, setBreakdownPhotoKey] = React.useState<string | null>(null);
  const [breakdownProblem, setBreakdownProblem] = React.useState("");
  const [breakdownPriority, setBreakdownPriority] = React.useState<Priority>(Priority.HIGH);

  // Supervisor Assign State
  const [assignWoId, setAssignWoId] = React.useState<string | null>(null);
  const [selectedTechId, setSelectedTechId] = React.useState("");
  const [assignDialogOpen, setAssignDialogOpen] = React.useState(false);

  // Timer for active session
  const [sessionDurationText, setSessionDurationText] = React.useState<string>("");

  React.useEffect(() => {
    if (!activeSession) {
      setSessionDurationText("");
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const start = new Date(activeSession.startAt).getTime();
      const diffMs = Math.max(0, now - start);
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      setSessionDurationText(
        hours > 0 ? `${hours} jam ${mins} menit` : `${mins} menit`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 30000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const userRole = currentUser?.role || Role.OPERATOR;
  const isOperator = userRole === Role.OPERATOR;
  const isTechnician = userRole === Role.TECHNICIAN;
  const isSupervisor = userRole === Role.SUPERVISOR || userRole === Role.ADMIN;

  // Handle Photo Success Callback
  const handlePhotoCaptured = (url: string, fileKey?: string) => {
    setCameraOpen(false);
    if (cameraPurpose === "START_USAGE") {
      setStartPhotoUrl(url);
      setStartHourMeter(String(currentHourMeter || ""));
      setStartDialogOpen(true);
    } else if (cameraPurpose === "FINISH_USAGE") {
      setEndPhotoUrl(url);
      setEndHourMeter(String(currentHourMeter || ""));
      setFinishDialogOpen(true);
    } else if (cameraPurpose === "BREAKDOWN") {
      setBreakdownPhotoUrl(url);
      setBreakdownPhotoKey(fileKey || null);
    }
  };

  // 1. Trigger Start Usage Camera
  const handleTriggerStartUsage = () => {
    setCameraPurpose("START_USAGE");
    setCameraOpen(true);
  };

  // Confirm Start Usage
  const handleConfirmStartUsage = async () => {
    if (!startPhotoUrl) {
      toast.error("Foto meteran dashboard wajib diambil.");
      return;
    }

    const parsedHm = startHourMeter.trim() ? parseInt(startHourMeter.trim(), 10) : undefined;
    if (parsedHm !== undefined && !isNaN(parsedHm)) {
      if (parsedHm < currentHourMeter) {
        toast.error(
          `Hour meter awal (${parsedHm} Jam) tidak boleh lebih kecil dari Hour meter saat ini (${currentHourMeter} Jam).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await startEquipmentUsage({
        equipmentId: equipment.id,
        startPhotoUrl,
        startHourMeter: parsedHm,
        remarks: startRemarks,
      });

      if (!res.success) {
        toast.error(res.error || "Gagal memulai pemakaian alat.");
        return;
      }

      const newHm = parsedHm !== undefined && !isNaN(parsedHm) ? Math.max(parsedHm, currentHourMeter) : currentHourMeter;

      const newSession: FieldHubActiveSession = {
        id: res.session?.id || `sess-${Date.now()}`,
        operatorId: currentUser?.id || res.session?.operatorId || "",
        startAt: res.session?.startAt || new Date().toISOString(),
        startPhotoUrl: res.session?.startPhotoUrl || startPhotoUrl,
        remarks: res.session?.remarks || (parsedHm ? `[HM Awal: ${parsedHm} Jam] ${startRemarks}`.trim() : startRemarks),
        operator: (res.session && "operator" in res.session && res.session.operator) ? {
          id: (res.session.operator as { id: string }).id,
          name: (res.session.operator as { name: string }).name,
          nik: (res.session.operator as { nik: string }).nik,
          avatarUrl: (res.session.operator as { avatarUrl?: string | null }).avatarUrl || null,
        } : {
          id: currentUser?.id || "",
          name: currentUser?.name || "Operator",
          nik: currentUser?.nik || "",
          avatarUrl: currentUser?.avatarUrl || null,
        },
      };

      // Instantly update local UI state (Zero lag!)
      setActiveSession(newSession);
      setCurrentStatus(EquipmentStatus.IN_USE);
      setCurrentHourMeter(newHm);
      onEquipmentChange?.(EquipmentStatus.IN_USE, newHm);

      toast.success("Sesi pemakaian berhasil dimulai. Jam kerja sedang berjalan!");
      setStartDialogOpen(false);
      setStartPhotoUrl(null);
      setStartRemarks("");
      setStartHourMeter("");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Trigger Finish Usage Camera
  const handleTriggerFinishUsage = () => {
    setCameraPurpose("FINISH_USAGE");
    setCameraOpen(true);
  };

  // Confirm Finish Usage
  const handleConfirmFinishUsage = async () => {
    if (!activeSession) return;
    if (!endPhotoUrl) {
      toast.error("Foto meteran dashboard akhir wajib diambil.");
      return;
    }

    const parsedHm = endHourMeter.trim() ? parseInt(endHourMeter.trim(), 10) : undefined;
    if (parsedHm !== undefined && !isNaN(parsedHm)) {
      if (parsedHm < currentHourMeter) {
        toast.error(
          `Hour meter akhir (${parsedHm} Jam) tidak boleh lebih kecil dari Hour meter saat ini (${currentHourMeter} Jam).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await finishEquipmentUsage({
        sessionId: activeSession.id,
        endPhotoUrl,
        finalHourMeter: parsedHm,
        remarks: endRemarks,
      });

      if (!res.success) {
        toast.error(res.error || "Gagal menyelesaikan pemakaian alat.");
        return;
      }

      const finalHm = res.finalHourMeter || (parsedHm !== undefined && !isNaN(parsedHm) ? Math.max(parsedHm, currentHourMeter) : currentHourMeter);

      // Instantly update local UI state (Zero lag!)
      setActiveSession(null);
      setCurrentStatus(EquipmentStatus.READY);
      setCurrentHourMeter(finalHm);
      onEquipmentChange?.(EquipmentStatus.READY, finalHm);

      const durMinutes = res.durationMinutes || 0;
      const h = Math.floor(durMinutes / 60);
      const m = durMinutes % 60;
      const hmMsg = ` • Hour Meter unit kini: ${finalHm} Jam`;
      toast.success(
        `Pemakaian selesai! Total durasi operasional: ${h > 0 ? `${h} jam ` : ""}${m} menit${hmMsg}.`
      );
      setFinishDialogOpen(false);
      setEndPhotoUrl(null);
      setEndRemarks("");
      setEndHourMeter("");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Submit Breakdown Report
  const handleSubmitBreakdown = async () => {
    if (!breakdownProblem.trim() || breakdownProblem.trim().length < 5) {
      toast.error("Mohon jelaskan kendala/kerusakan minimal 5 karakter.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createBreakdownRequest({
        equipmentId: equipment.id,
        problem: breakdownProblem.trim(),
        priority: breakdownPriority,
        photoKey: breakdownPhotoKey,
        photoName: breakdownPhotoKey ? "breakdown-photo.jpg" : undefined,
      });

      if (!res.success) {
        toast.error(res.error || "Gagal mengirim laporan breakdown.");
        return;
      }

      setCurrentStatus(EquipmentStatus.BREAKDOWN);
      onEquipmentChange?.(EquipmentStatus.BREAKDOWN);
      toast.success("Laporan kerusakan berhasil dikirim! Work Order otomatis diterbitkan ke Supervisor.");
      setBreakdownDialogOpen(false);
      setBreakdownProblem("");
      setBreakdownPhotoUrl(null);
      setBreakdownPhotoKey(null);
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan saat mengirim laporan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Technician: Start Work on WO
  const handleStartWork = async (woId: string) => {
    setIsSubmitting(true);
    try {
      const res = await startWorkOrderExecution(woId);
      if (!res.success) {
        toast.error(res.error || "Gagal memulai pengerjaan.");
        return;
      }

      setCurrentStatus(EquipmentStatus.UNDER_REPAIR);
      onEquipmentChange?.(EquipmentStatus.UNDER_REPAIR);
      toast.success("Status Work Order diubah menjadi 'Sedang Dikerjakan' (On Work). Unit masuk status perbaikan.");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Supervisor: Assign Work Order
  const handleConfirmAssignWo = async () => {
    if (!assignWoId || !selectedTechId) {
      toast.error("Pilih teknisi yang akan ditugaskan.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await assignWorkOrder({
        workOrderId: assignWoId,
        assignedToId: selectedTechId,
      });

      if (!res.success) {
        toast.error(res.error || "Gagal menugaskan teknisi.");
        return;
      }

      toast.success("Teknisi berhasil ditugaskan ke Work Order.");
      setAssignDialogOpen(false);
      setAssignWoId(null);
      setSelectedTechId("");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDown =
    currentStatus === EquipmentStatus.BREAKDOWN || currentStatus === EquipmentStatus.UNDER_REPAIR;

  return (
    <div className="space-y-5">
      {/* 1. Operator: pakai unit / lapor kerusakan */}
      {(isOperator || isSupervisor) && (
        <section className="space-y-2" aria-label="Pemakaian unit">
          {activeSession && (
            <div className="flex items-center gap-3 rounded-lg border border-green-700/30 bg-green-50 p-3">
              <UserAvatar
                src={activeSession.operator.avatarUrl}
                name={activeSession.operator.name}
                nik={activeSession.operator.nik}
                size="sm"
              />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">{activeSession.operator.name} sedang memakai unit</p>
                <p className="text-muted-foreground">Sudah {sessionDurationText || "baru saja"}</p>
              </div>
              {activeSession.startPhotoUrl && (
                <a
                  href={activeSession.startPhotoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block h-12 w-12 shrink-0 overflow-hidden rounded border bg-black"
                  title="Foto meteran awal"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeSession.startPhotoUrl} alt="Foto meteran awal" className="h-full w-full object-cover" />
                </a>
              )}
            </div>
          )}

          {isDown && (
            <p className="flex items-start gap-2 rounded-lg border border-red-600/30 bg-red-50 p-3 text-sm text-red-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              Unit tidak boleh dipakai sampai work order perbaikannya ditutup.
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {!activeSession && !isDown && (
              <Button
                size="lg"
                onClick={handleTriggerStartUsage}
                className="h-14 justify-start gap-3 px-4 text-base font-semibold"
              >
                <Camera className="h-5 w-5" />
                <span className="text-left leading-tight">
                  Mulai pakai unit
                  <span className="block text-xs font-normal opacity-90">Foto meteran dashboard</span>
                </span>
              </Button>
            )}

            {activeSession && (
              <Button
                size="lg"
                onClick={handleTriggerFinishUsage}
                className="h-14 justify-start gap-3 bg-orange-600 px-4 text-base font-semibold hover:bg-orange-700"
              >
                <Square className="h-5 w-5 fill-current" />
                <span className="text-left leading-tight">
                  Selesai pakai
                  <span className="block text-xs font-normal opacity-90">Foto meteran akhir</span>
                </span>
              </Button>
            )}

            <Button
              size="lg"
              variant="outline"
              onClick={() => setBreakdownDialogOpen(true)}
              className="h-14 justify-start gap-3 border-2 border-red-600 px-4 text-base font-semibold text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              <AlertTriangle className="h-5 w-5" />
              <span className="text-left leading-tight">
                Lapor kerusakan
                <span className="block text-xs font-normal text-muted-foreground">Work order dibuat otomatis</span>
              </span>
            </Button>
          </div>
        </section>
      )}

      {/* 2. Teknisi: work order aktif di unit ini */}
      {(isTechnician || isSupervisor) && (
        <section className="space-y-2" aria-label="Work order aktif">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Work order aktif</h2>
            <span className="text-sm text-muted-foreground">{workOrders.length}</span>
          </div>

          {workOrders.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Tidak ada work order terbuka untuk unit ini.
            </p>
          ) : (
            <ul className="space-y-2">
              {workOrders.map((wo) => {
                const isAssignedToMe = wo.assignedToId === currentUser?.id;
                const isOpen = wo.status === WorkOrderStatus.OPEN;

                return (
                  <li key={wo.id} className="rounded-lg border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/work-order/${wo.id}`} className="font-condensed text-lg font-bold hover:underline">
                        {wo.code}
                      </Link>
                      <StatusBadge kind="workOrder" status={wo.status} />
                      {wo.breakdownRequest?.priority && (
                        <StatusBadge kind="priority" status={wo.breakdownRequest.priority} />
                      )}
                    </div>

                    {wo.breakdownRequest && <p className="mt-1 text-sm">{wo.breakdownRequest.problem}</p>}

                    <p className="mt-1 text-xs text-muted-foreground">
                      {wo.assignedTo ? `Teknisi: ${wo.assignedTo.name}` : "Belum ada teknisi"}
                      {isAssignedToMe && <span className="font-semibold text-foreground"> (Anda)</span>}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      {isOpen ? (
                        <Button
                          onClick={() => handleStartWork(wo.id)}
                          disabled={isSubmitting}
                          className="col-span-2 h-11 gap-1.5"
                        >
                          <Wrench className="h-4 w-4" />
                          Mulai kerjakan
                        </Button>
                      ) : (
                        <Button asChild className="col-span-2 h-11 gap-1.5">
                          <Link href={`/work-order/${wo.id}?action=complete`}>
                            <CheckCircle2 className="h-4 w-4" />
                            Tandai selesai
                          </Link>
                        </Button>
                      )}
                      <Button asChild variant="outline" className="h-11 gap-1.5">
                        <Link href={`/work-order/${wo.id}?action=diagnose`}>
                          <FileText className="h-4 w-4" />
                          Diagnosis
                        </Link>
                      </Button>
                      {isSupervisor && isOpen && !wo.assignedToId ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setAssignWoId(wo.id);
                            setAssignDialogOpen(true);
                          }}
                          className="h-11 gap-1.5"
                        >
                          <UserCheck className="h-4 w-4" />
                          Tugaskan
                        </Button>
                      ) : (
                        <Button asChild variant="outline" className="h-11 gap-1.5">
                          <Link href={`/work-order/${wo.id}`}>
                            Buka WO
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="h-11 justify-start gap-2">
              <Link href={`/preventive?equipmentId=${equipment.id}`}>
                <CalendarCheck className="h-4 w-4 shrink-0" />
                Jadwal PM
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 justify-start gap-2">
              <Link href={`/inspection?equipmentId=${equipment.id}`}>
                <ClipboardCheck className="h-4 w-4 shrink-0" />
                Inspeksi
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* MODALS & DIALOGS */}
      {/* ========================================================================= */}

      {/* 1. Camera Capture Dialog */}
      <PhotoCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onSuccess={handlePhotoCaptured}
        title={
          cameraPurpose === "START_USAGE"
            ? "Foto Meteran Dashboard Awal"
            : cameraPurpose === "FINISH_USAGE"
            ? "Foto Meteran Dashboard Akhir"
            : cameraPurpose === "BREAKDOWN"
            ? "Foto Bagian Rusak / Kendala"
            : "Foto Hasil Selesai Perbaikan"
        }
        description="Arahkan kamera ke panel meteran dashboard mesin atau area kerusakan lalu tekan tombol jepret."
        folder={cameraPurpose === "BREAKDOWN" ? "breakdowns" : "work-orders"}
      />

      {/* 2. Confirm Start Usage Dialog */}
      <Dialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-emerald-600 fill-current" />
              <span>Konfirmasi Mulai Pemakaian</span>
            </DialogTitle>
            <DialogDescription>
              Periksa foto meteran dashboard awal dan verifikasi Hour Meter unit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            {startPhotoUrl && (
              <div className="relative w-full h-44 rounded-lg overflow-hidden border bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={startPhotoUrl}
                  alt="Dashboard Awal"
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Hour Meter Info & Input Field */}
            <div className="p-3 bg-muted/40 rounded-xl border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Hour Meter Terakhir Unit:</span>
                <span className="font-mono font-bold text-foreground">
                  {equipment.currentHourMeter.toLocaleString("id-ID")} Jam
                </span>
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Angka Hour Meter Awal (Jam)</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Verifikasi Mulai
                  </span>
                </label>
                <Input
                  type="number"
                  placeholder={`Contoh: ${equipment.currentHourMeter}`}
                  value={startHourMeter}
                  onChange={(e) => setStartHourMeter(e.target.value)}
                  min={equipment.currentHourMeter}
                  className="font-mono font-bold text-sm bg-background"
                />
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Ketik angka odometer yang terlihat pada foto di atas sebelum alat mulai dioperasikan.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Rencana Lokasi / Tujuan Pekerjaan (Opsional)
              </label>
              <Input
                placeholder="Contoh: Pemindahan material di Area B"
                value={startRemarks}
                onChange={(e) => setStartRemarks(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setStartDialogOpen(false);
                setStartPhotoUrl(null);
                setStartHourMeter("");
              }}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmStartUsage}
              disabled={isSubmitting}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Mulai Operasi Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Confirm Finish Usage Dialog */}
      <Dialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Square className="h-5 w-5 text-amber-600" />
              <span>Konfirmasi Selesai Pemakaian</span>
            </DialogTitle>
            <DialogDescription>
              Periksa foto meteran dashboard akhir dan perbarui Hour Meter unit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            {endPhotoUrl && (
              <div className="relative w-full h-44 rounded-lg overflow-hidden border bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={endPhotoUrl}
                  alt="Dashboard Akhir"
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Hour Meter Info & Input Field */}
            <div className="p-3 bg-muted/40 rounded-xl border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Hour Meter Saat Ini:</span>
                <span className="font-mono font-bold text-foreground">
                  {equipment.currentHourMeter.toLocaleString("id-ID")} Jam
                </span>
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Angka Hour Meter Akhir (Jam)</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Auto-Update Mesin
                  </span>
                </label>
                <Input
                  type="number"
                  placeholder={`Contoh: ${equipment.currentHourMeter}`}
                  value={endHourMeter}
                  onChange={(e) => setEndHourMeter(e.target.value)}
                  min={equipment.currentHourMeter}
                  className="font-mono font-bold text-sm bg-background"
                />
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Ketik angka odometer yang terlihat pada foto di atas. Angka tidak boleh lebih kecil dari {equipment.currentHourMeter} Jam.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Catatan Kondisi Unit Saat Selesai (Opsional)
              </label>
              <Input
                placeholder="Contoh: Operasi lancar, bahan bakar sisa 50%"
                value={endRemarks}
                onChange={(e) => setEndRemarks(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setFinishDialogOpen(false);
                setEndPhotoUrl(null);
                setEndHourMeter("");
              }}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmFinishUsage}
              disabled={isSubmitting}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan & Selesaikan Sesi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Breakdown Report Dialog */}
      <Dialog open={breakdownDialogOpen} onOpenChange={setBreakdownDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              Lapor Kerusakan / Kendala Unit
            </DialogTitle>
            <DialogDescription>
              Sistem akan otomatis menerbitkan Work Order dan menempatkan unit ke status Breakdown.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Foto Kendala */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Foto Bagian yang Rusak (Direkomendasikan)
              </label>
              {breakdownPhotoUrl ? (
                <div className="relative w-full h-40 rounded-lg overflow-hidden border bg-black group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={breakdownPhotoUrl}
                    alt="Foto Kendala"
                    className="w-full h-full object-contain"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setBreakdownPhotoUrl(null);
                      setBreakdownPhotoKey(null);
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
                  onClick={() => {
                    setCameraPurpose("BREAKDOWN");
                    setCameraOpen(true);
                  }}
                  className="w-full h-20 border-dashed border-2 flex flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Camera className="h-6 w-6 text-rose-500" />
                  <span>Ambil Foto Kerusakan dari Kamera HP</span>
                </Button>
              )}
            </div>

            {/* Keterangan Kendala */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Deskripsi Kendala / Kerusakan <span className="text-rose-500">*</span>
              </label>
              <Textarea
                rows={3}
                placeholder="Jelaskan apa yang rusak, contoh: Selang hidrolik arm bocor oli deras saat angkat beban, mesin mati tiba-tiba..."
                value={breakdownProblem}
                onChange={(e) => setBreakdownProblem(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Tingkat Prioritas */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Tingkat Urgensi
              </label>
              <Select
                value={breakdownPriority}
                onValueChange={(val) => setBreakdownPriority(val as Priority)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={Priority.LOW}>Rendah (Dapat menunggu)</SelectItem>
                  <SelectItem value={Priority.MEDIUM}>Sedang (Normal)</SelectItem>
                  <SelectItem value={Priority.HIGH}>Tinggi (Pekerjaan terhambat)</SelectItem>
                  <SelectItem value={Priority.CRITICAL}>Kritis (Operasional berhenti total)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setBreakdownDialogOpen(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              onClick={handleSubmitBreakdown}
              disabled={isSubmitting}
              className="gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Kirim Laporan & Terbitkan WO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* 6. Supervisor Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tugaskan Teknisi Mekanik</DialogTitle>
            <DialogDescription>
              Pilih teknisi yang bertanggung jawab mengerjakan perbaikan ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">
                Pilih Teknisi / Mekanik
              </label>
              <Select value={selectedTechId} onValueChange={setSelectedTechId}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="Pilih mekanik..." />
                </SelectTrigger>
                <SelectContent>
                  {techniciansList.map((t) => (
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
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmAssignWo}
              disabled={isSubmitting || !selectedTechId}
              className="gap-2 font-bold"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Tugaskan Teknisi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
