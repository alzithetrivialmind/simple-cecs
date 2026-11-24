"use client";

import * as React from "react";
import Link from "next/link";
import { canInputData } from "@/lib/roles";
import { useRouter } from "next/navigation";
import {
  EquipmentCategory,
  EquipmentStatus,
  Ownership,
} from "@prisma/client";
import {
  Gauge,
  Calendar,
  Settings,
  Edit2,
  Trash2,
  QrCode,
  PlusCircle,
  Clock,
  Wrench,
  FileText,
  Camera,
  ImageIcon,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  ExternalLink,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { CATEGORY_LABELS } from "@/lib/labels";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateIndo, formatDateTimeIndo } from "@/lib/utils";
import { toast } from "sonner";
import { deleteEquipment } from "@/server/actions/equipment";
import { updateEquipmentPhoto } from "@/server/actions/profile";
import { PhotoCaptureDialog } from "@/components/shared/photo-capture-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { DetailedTimelineEvent } from "@/server/actions/timeline";
import { EquipmentTimelineView } from "./equipment-timeline-view";

import {
  EquipmentFieldHub,
  FieldHubActiveSession,
  FieldHubPartItem,
  FieldHubTechnicianItem,
  FieldHubUser,
  FieldHubWorkOrder,
} from "./equipment-field-hub";

interface AttachmentItem {
  id: string;
  kind: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedBy: { name: string; avatarUrl?: string | null };
}

interface HourMeterLogItem {
  id: string;
  readingDate: Date;
  hourMeter: number;
  source: string;
  remark: string | null;
  createdBy: { name: string; nik: string; avatarUrl?: string | null };
}

interface WorkOrderSummary {
  id: string;
  code: string;
  type: string;
  status: string;
  createdAt: Date;
  downtimeMinutes: number | null;
  assignedTo: { name: string; nik: string; avatarUrl?: string | null } | null;
  repairResult: { correctiveAction: string } | null;
}

interface BreakdownSummary {
  id: string;
  code: string;
  problem: string;
  priority: string;
  reportedAt: Date;
  reportedBy: { name: string; nik: string; avatarUrl?: string | null };
}

function formatLiters(v: number | null): string {
  return v === null ? "-" : `${v.toLocaleString("id-ID", { maximumFractionDigits: 2 })} L`;
}

function SpecRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="break-words text-right font-medium">{value || "-"}</dd>
    </div>
  );
}

interface EquipmentDetailProps {
  equipment: {
    id: string;
    code: string;
    name: string;
    category: EquipmentCategory;
    status: EquipmentStatus;
    ownership: Ownership;
    assetNumber: string | null;
    supplier: string | null;
    manufacturer: string | null;
    model: string | null;
    serialNumber: string | null;
    yearOfManufacture: number | null;
    inServiceDate: Date | null;
    engineModel: string | null;
    engineSerialNumber: string | null;
    transmission: string | null;
    capacity: string | null;
    operatingWeight: string | null;
    fuelType: string | null;
    engineManufacturer: string | null;
    enginePower: string | null;
    maxTorque: string | null;
    cylinderCount: string | null;
    engineDisplacement: string | null;
    hydraulicSystem: string | null;
    maxTravelSpeed: string | null;
    gradeability: string | null;
    turningRadius: string | null;
    dimensions: string | null;
    engineOilCapacity: number | null;
    transmissionOilCapacity: number | null;
    hydraulicOilCapacity: number | null;
    fuelTankCapacity: number | null;
    notes: string | null;
    currentHourMeter: number;
    photoUrl: string | null;
    department: { id: string; name: string } | null;
    location: { id: string; name: string } | null;
    hourMeterLogs: HourMeterLogItem[];
    attachments: AttachmentItem[];
    workOrders?: WorkOrderSummary[];
    breakdowns?: BreakdownSummary[];
  };
  userRole?: string;
  currentUser?: FieldHubUser | null;
  activeSession?: FieldHubActiveSession | null;
  activeWorkOrders?: FieldHubWorkOrder[];
  partsList?: FieldHubPartItem[];
  techniciansList?: FieldHubTechnicianItem[];
  timelineEvents?: DetailedTimelineEvent[];
}


function getAttachmentCategory(mimeType?: string | null, fileName?: string | null): "IMAGE" | "PDF" | "DOC" | "OTHER" {
  const mime = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();
  if (mime.startsWith("image/") || name.match(/\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i)) {
    return "IMAGE";
  }
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return "PDF";
  }
  if (
    mime.includes("word") ||
    mime.includes("excel") ||
    mime.includes("sheet") ||
    mime.includes("document") ||
    mime.includes("presentation") ||
    mime.includes("text") ||
    name.match(/\.(doc|docx|xls|xlsx|csv|txt|rtf|ppt|pptx)$/i)
  ) {
    return "DOC";
  }
  return "OTHER";
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function EquipmentDetailClient({
  equipment,
  userRole,
  currentUser,
  activeSession,
  activeWorkOrders = [],
  partsList = [],
  techniciansList = [],
  timelineEvents = [],
}: EquipmentDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState("overview");

  const canEdit = userRole === "ADMIN" || userRole === "SUPERVISOR";
  const canDelete = userRole === "ADMIN";

  const [currentStatus, setCurrentStatus] = React.useState<EquipmentStatus>(equipment.status);
  const [currentHourMeter, setCurrentHourMeter] = React.useState<number>(equipment.currentHourMeter);

  // Attachment filtering and sorting state
  const [fileTypeFilter, setFileTypeFilter] = React.useState<"ALL" | "IMAGE" | "PDF" | "DOC">("ALL");
  const [fileSearchQuery, setFileSearchQuery] = React.useState("");
  const [fileSortBy, setFileSortBy] = React.useState<"NEWEST" | "OLDEST" | "NAME_ASC" | "NAME_DESC">("NEWEST");

  // Attachment stats for filter badges
  const fileStats = React.useMemo(() => {
    let images = 0;
    let pdfs = 0;
    let docs = 0;
    let others = 0;

    for (const att of equipment.attachments || []) {
      const cat = getAttachmentCategory(att.mimeType, att.fileName);
      if (cat === "IMAGE") images++;
      else if (cat === "PDF") pdfs++;
      else if (cat === "DOC") docs++;
      else others++;
    }

    return {
      all: equipment.attachments?.length || 0,
      images,
      pdfs,
      docs,
      others,
    };
  }, [equipment.attachments]);

  // Filtered and sorted attachments
  const filteredAttachments = React.useMemo(() => {
    return (equipment.attachments || [])
      .filter((att) => {
        const cat = getAttachmentCategory(att.mimeType, att.fileName);
        if (fileTypeFilter === "IMAGE" && cat !== "IMAGE") return false;
        if (fileTypeFilter === "PDF" && cat !== "PDF") return false;
        if (fileTypeFilter === "DOC" && cat !== "DOC" && cat !== "OTHER") return false;

        if (fileSearchQuery.trim()) {
          const q = fileSearchQuery.toLowerCase();
          const matchName = (att.fileName || "").toLowerCase().includes(q);
          const matchUploader = (att.uploadedBy?.name || "").toLowerCase().includes(q);
          if (!matchName && !matchUploader) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (fileSortBy === "NEWEST") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (fileSortBy === "OLDEST") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (fileSortBy === "NAME_ASC") {
          return (a.fileName || "").localeCompare(b.fileName || "");
        }
        if (fileSortBy === "NAME_DESC") {
          return (b.fileName || "").localeCompare(a.fileName || "");
        }
        return 0;
      });
  }, [equipment.attachments, fileTypeFilter, fileSearchQuery, fileSortBy]);

  React.useEffect(() => {
    setCurrentStatus(equipment.status);
  }, [equipment.status]);

  React.useEffect(() => {
    setCurrentHourMeter(equipment.currentHourMeter);
  }, [equipment.currentHourMeter]);

  const [photoUrl, setPhotoUrl] = React.useState<string | null>(equipment.photoUrl);
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = React.useState(false);

  const handlePhotoSuccess = async (url: string) => {
    setPhotoUrl(url);
    try {
      const res = await updateEquipmentPhoto(equipment.id, url);
      if (res.success) {
        toast.success("Foto unit berhasil diperbarui.");
      } else {
        toast.error(res.error || "Gagal memperbarui foto unit.");
      }
    } catch {
      toast.error("Terjadi kesalahan saat menyimpan foto unit.");
    }
  };


  const handleDelete = async () => {
    if (
      confirm(
        `Apakah Anda yakin ingin menghapus unit "${equipment.code} - ${equipment.name}"?`
      )
    ) {
      try {
        const res = await deleteEquipment(equipment.id);
        if (res.success) {
          toast.success("Unit berhasil dihapus (soft delete)");
          router.push("/equipment");
        } else {
          toast.error(res.error || "Gagal menghapus unit");
        }
      } catch {
        toast.error("Terjadi kesalahan sistem");
      }
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Navigasi + aksi kecil */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/equipment"
          className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 px-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Equipment
        </Link>
        <div className="flex items-center gap-1.5">
          {canEdit && (
            <Button asChild variant="outline" className="h-10 gap-1.5 px-3">
              <Link href={`/equipment/${equipment.id}/edit`}>
                <Edit2 className="h-4 w-4" />
                Edit
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="h-10 gap-1.5 px-3">
            <Link href={`/equipment/qr?id=${equipment.id}`}>
              <QrCode className="h-4 w-4" />
              QR
            </Link>
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              onClick={handleDelete}
              className="h-10 w-10 p-0 text-destructive hover:bg-destructive/10"
              aria-label="Hapus unit"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Identitas unit */}
      <section className="rounded-lg border bg-card">
        <div className="flex gap-4 p-4">
          <button
            type="button"
            onClick={() => canEdit && setIsPhotoDialogOpen(true)}
            disabled={!canEdit}
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted sm:h-28 sm:w-28"
            aria-label={canEdit ? (photoUrl ? "Ganti foto unit" : "Ambil foto unit") : "Foto unit"}
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={equipment.name} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                <Camera className="h-6 w-6" />
                {canEdit && <span className="text-[11px] font-medium">Ambil foto</span>}
              </span>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="font-condensed text-4xl font-bold leading-none tracking-tight">{equipment.code}</h1>
              <StatusBadge kind="equipment" status={currentStatus} className="text-sm" />
            </div>
            <p className="mt-1 text-base font-medium leading-snug">{equipment.name}</p>
            <p className="text-sm text-muted-foreground">
              {[equipment.manufacturer, equipment.model, CATEGORY_LABELS[equipment.category]].filter(Boolean).join(", ")}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 border-t text-sm sm:grid-cols-4 [&>div]:border-border [&>div]:p-3 [&>div:nth-child(odd)]:border-r sm:[&>div]:border-r sm:[&>div:last-child]:border-r-0 [&>div:nth-child(-n+2)]:border-b sm:[&>div:nth-child(-n+2)]:border-b-0">
          <div>
            <dt className="text-muted-foreground">Hour meter</dt>
            <dd className="font-condensed text-2xl font-bold tabular-nums leading-tight">
              {currentHourMeter.toLocaleString("id-ID")} <span className="text-sm font-medium">jam</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Lokasi</dt>
            <dd className="font-medium">{equipment.location?.name || "Belum diisi"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Departemen</dt>
            <dd className="font-medium">{equipment.department?.name || "Belum diisi"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Kepemilikan</dt>
            <dd className="font-medium">{equipment.ownership === "OWNED" ? "Milik perusahaan" : "Rental"}</dd>
          </div>
        </dl>
      </section>

      {/* Aksi lapangan sesuai peran */}
      {/* Field Action Hub (Mode Lapangan Cepat untuk Operator, Teknisi, dan Supervisor) */}
      <EquipmentFieldHub
        equipment={{
          id: equipment.id,
          code: equipment.code,
          name: equipment.name,
          category: equipment.category,
          status: currentStatus,
          photoUrl: photoUrl,
          currentHourMeter: currentHourMeter,
          location: equipment.location,
          department: equipment.department,
        }}
        currentUser={currentUser || null}
        activeSession={activeSession || null}
        activeWorkOrders={activeWorkOrders}
        partsList={partsList}
        techniciansList={techniciansList}
        onEquipmentChange={(newStatus, newHm) => {
          setCurrentStatus(newStatus);
          if (newHm !== undefined) {
            setCurrentHourMeter(newHm);
          }
        }}
      />

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex w-full h-auto p-1 gap-1 md:grid md:grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 py-2">
            <Settings className="h-4 w-4" />
            <span>Spesifikasi</span>
          </TabsTrigger>
          <TabsTrigger value="attachments" className="flex items-center gap-1.5 py-2">
            <ImageIcon className="h-4 w-4" />
            <span>Foto & File</span>
          </TabsTrigger>
          <TabsTrigger value="hour-meter" className="flex items-center gap-1.5 py-2">
            <Gauge className="h-4 w-4" />
            <span>Hour Meter</span>
          </TabsTrigger>
          <TabsTrigger value="repairs" className="flex items-center gap-1.5 py-2 opacity-70">
            <Wrench className="h-4 w-4" />
            <span>Perbaikan</span>
          </TabsTrigger>
          <TabsTrigger value="pm" className="flex items-center gap-1.5 py-2 opacity-70">
            <Calendar className="h-4 w-4" />
            <span>PM</span>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-1.5 py-2 font-semibold">
            <Clock className="h-4 w-4 text-primary" />
            <span>Timeline</span>
            {timelineEvents.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                {timelineEvents.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* 1. SPESIFIKASI: hanya isian yang terisi */}
        <TabsContent value="overview" className="space-y-4">
          {(() => {
            const groups: { title: string; rows: [string, string | null][] }[] = [
              {
                title: "Identitas",
                rows: [
                  ["Merk", equipment.manufacturer],
                  ["Model", equipment.model],
                  ["No. seri", equipment.serialNumber],
                  ["Tahun pembuatan", equipment.yearOfManufacture ? String(equipment.yearOfManufacture) : null],
                  ["Mulai operasi", equipment.inServiceDate ? formatDateIndo(equipment.inServiceDate) : null],
                  ["No. aset", equipment.assetNumber],
                  ["Supplier", equipment.supplier],
                ],
              },
              {
                title: "Operasi",
                rows: [
                  ["Kapasitas", equipment.capacity],
                  ["Berat operasi", equipment.operatingWeight],
                  ["Bahan bakar", equipment.fuelType],
                  ["Transmisi", equipment.transmission],
                  ["Sistem hidrolik", equipment.hydraulicSystem],
                  ["Kecepatan maks", equipment.maxTravelSpeed],
                  ["Kemampuan menanjak", equipment.gradeability],
                  ["Radius putar", equipment.turningRadius],
                  ["Dimensi (PxLxT)", equipment.dimensions],
                ],
              },
              {
                title: "Mesin",
                rows: [
                  ["Pabrikan mesin", equipment.engineManufacturer],
                  ["Model mesin", equipment.engineModel],
                  ["No. seri mesin", equipment.engineSerialNumber],
                  ["Daya", equipment.enginePower],
                  ["Torsi maks", equipment.maxTorque],
                  ["Silinder", equipment.cylinderCount],
                  ["Volume silinder", equipment.engineDisplacement],
                ],
              },
              {
                title: "Kapasitas oli & BBM",
                rows: [
                  ["Oli mesin", equipment.engineOilCapacity === null ? null : formatLiters(equipment.engineOilCapacity)],
                  ["Oli transmisi", equipment.transmissionOilCapacity === null ? null : formatLiters(equipment.transmissionOilCapacity)],
                  ["Oli hidrolik", equipment.hydraulicOilCapacity === null ? null : formatLiters(equipment.hydraulicOilCapacity)],
                  ["Tangki BBM", equipment.fuelTankCapacity === null ? null : formatLiters(equipment.fuelTankCapacity)],
                ],
              },
            ];
            const emptyCount = groups.reduce((n, g) => n + g.rows.filter(([, v]) => !v).length, 0);
            const filled = groups
              .map((g) => ({ ...g, rows: g.rows.filter(([, v]) => !!v) }))
              .filter((g) => g.rows.length > 0);

            return (
              <>
                {filled.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {filled.map((g) => (
                      <section key={g.title} className="rounded-lg border bg-card">
                        <h3 className="border-b px-4 py-2.5 text-sm font-semibold">{g.title}</h3>
                        <dl className="divide-y px-4 text-sm">
                          {g.rows.map(([label, value]) => (
                            <SpecRow key={label} label={label} value={value} />
                          ))}
                        </dl>
                      </section>
                    ))}
                  </div>
                )}

                <section className="rounded-lg border bg-card">
                  <h3 className="border-b px-4 py-2.5 text-sm font-semibold">Catatan</h3>
                  <p className="whitespace-pre-wrap break-words p-4 text-sm">
                    {equipment.notes || <span className="text-muted-foreground">Belum ada catatan.</span>}
                  </p>
                </section>

                {emptyCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {emptyCount} data spesifikasi belum diisi.
                    {canEdit && (
                      <>
                        {" "}
                        <Link href={`/equipment/${equipment.id}/edit`} className="font-medium text-primary underline">
                          Lengkapi
                        </Link>
                      </>
                    )}
                  </p>
                )}
              </>
            );
          })()}
        </TabsContent>

        {/* 2. ATTACHMENT / FOTO TAB */}
        <TabsContent value="attachments" className="space-y-4">
          <Card className="border-border shadow-xs">
            <CardHeader className="p-4 sm:p-5 border-b space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Galeri Foto & Dokumen Lampiran
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Filter dan sortir dokumen, sertifikat, atau riwayat foto teknis unit.
                  </p>
                </div>
              </div>

              {/* Filter Pills / Tabs */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant={fileTypeFilter === "ALL" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFileTypeFilter("ALL")}
                  className="h-8 text-xs font-semibold gap-1.5 rounded-lg"
                >
                  <span>Semua</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      fileTypeFilter === "ALL"
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {fileStats.all}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant={fileTypeFilter === "IMAGE" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFileTypeFilter("IMAGE")}
                  className="h-8 text-xs font-semibold gap-1.5 rounded-lg"
                >
                  <ImageIcon className="h-3.5 w-3.5 text-blue-500" />
                  <span>Foto / Gambar</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      fileTypeFilter === "IMAGE"
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {fileStats.images}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant={fileTypeFilter === "PDF" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFileTypeFilter("PDF")}
                  className="h-8 text-xs font-semibold gap-1.5 rounded-lg"
                >
                  <FileText className="h-3.5 w-3.5 text-rose-500" />
                  <span>PDF</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      fileTypeFilter === "PDF"
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {fileStats.pdfs}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant={fileTypeFilter === "DOC" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFileTypeFilter("DOC")}
                  className="h-8 text-xs font-semibold gap-1.5 rounded-lg"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Dokumen</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      fileTypeFilter === "DOC"
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {fileStats.docs + fileStats.others}
                  </span>
                </Button>
              </div>

              {/* Search & Sort Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama berkas atau pengunggah..."
                    value={fileSearchQuery}
                    onChange={(e) => setFileSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:inline">Urutkan:</span>
                  <Select
                    value={fileSortBy}
                    onValueChange={(val: "NEWEST" | "OLDEST" | "NAME_ASC" | "NAME_DESC") =>
                      setFileSortBy(val)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEWEST">Terbaru Diunggah</SelectItem>
                      <SelectItem value="OLDEST">Terlama Diunggah</SelectItem>
                      <SelectItem value="NAME_ASC">Nama (A ke Z)</SelectItem>
                      <SelectItem value="NAME_DESC">Nama (Z ke A)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5">
              {filteredAttachments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
                  <FileText className="h-8 w-8 mx-auto opacity-40 text-muted-foreground" />
                  <p className="font-medium text-foreground">
                    Tidak ada berkas yang ditemukan.
                  </p>
                  <p className="text-muted-foreground">
                    {fileSearchQuery
                      ? `Tidak ada berkas yang cocok dengan pencarian "${fileSearchQuery}".`
                      : `Belum ada berkas untuk kategori yang dipilih.`}
                  </p>
                  {(fileTypeFilter !== "ALL" || fileSearchQuery) && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => {
                        setFileTypeFilter("ALL");
                        setFileSearchQuery("");
                      }}
                      className="text-xs text-primary"
                    >
                      Reset Filter & Tampilkan Semua
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {filteredAttachments.map((att) => {
                    const cat = getAttachmentCategory(att.mimeType, att.fileName);
                    const isImg = cat === "IMAGE";
                    const isPdf = cat === "PDF";

                    return (
                      <div
                        key={att.id}
                        className="group rounded-xl border bg-card hover:border-primary/50 transition-all flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-sm"
                      >
                        {/* Top Preview Area */}
                        {isImg ? (
                          <a
                            href={`/api/files/${att.fileKey}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="aspect-video bg-muted/60 overflow-hidden flex items-center justify-center relative block cursor-pointer group-hover:opacity-95"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/files/${att.fileKey}`}
                              alt={att.fileName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            <div className="absolute top-2 left-2">
                              <Badge variant="secondary" className="text-[10px] bg-background/80 backdrop-blur-xs font-semibold">
                                Gambar
                              </Badge>
                            </div>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-background/80 backdrop-blur-xs">
                              <ExternalLink className="h-3.5 w-3.5 text-foreground" />
                            </div>
                          </a>
                        ) : isPdf ? (
                          <a
                            href={`/api/files/${att.fileKey}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="aspect-video bg-rose-50/60 dark:bg-rose-950/20 border-b flex flex-col items-center justify-center relative p-3 cursor-pointer group-hover:bg-rose-100/60 transition-colors"
                          >
                            <div className="p-3 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 mb-1">
                              <FileText className="h-7 w-7" />
                            </div>
                            <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                              Dokumen PDF
                            </span>
                            <div className="absolute top-2 left-2">
                              <Badge className="text-[10px] bg-rose-600 text-white font-bold">
                                PDF
                              </Badge>
                            </div>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-background/80">
                              <ExternalLink className="h-3.5 w-3.5 text-foreground" />
                            </div>
                          </a>
                        ) : (
                          <a
                            href={`/api/files/${att.fileKey}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="aspect-video bg-blue-50/60 dark:bg-blue-950/20 border-b flex flex-col items-center justify-center relative p-3 cursor-pointer group-hover:bg-blue-100/60 transition-colors"
                          >
                            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 mb-1">
                              <FileSpreadsheet className="h-7 w-7" />
                            </div>
                            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                              Dokumen Teknis
                            </span>
                            <div className="absolute top-2 left-2">
                              <Badge className="text-[10px] bg-blue-600 text-white font-bold">
                                Dokumen
                              </Badge>
                            </div>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-background/80">
                              <ExternalLink className="h-3.5 w-3.5 text-foreground" />
                            </div>
                          </a>
                        )}

                        {/* File Info */}
                        <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                          <div>
                            <a
                              href={`/api/files/${att.fileKey}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-bold text-foreground hover:underline line-clamp-2 leading-tight block"
                              title={att.fileName}
                            >
                              {att.fileName}
                            </a>
                            {att.sizeBytes > 0 && (
                              <span className="text-[10px] text-muted-foreground block mt-0.5">
                                {formatFileSize(att.sizeBytes)}
                              </span>
                            )}
                          </div>

                          <div className="pt-2 border-t text-[10px] text-muted-foreground flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate">
                              <UserAvatar
                                src={att.uploadedBy?.avatarUrl}
                                name={att.uploadedBy?.name || "User"}
                                size="xs"
                                className="h-4 w-4 text-[8px] shrink-0"
                                showBorder={false}
                              />
                              <span className="truncate">{att.uploadedBy?.name || "User"}</span>
                            </div>
                            <span className="shrink-0">{formatDateIndo(att.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. HOUR METER LOG TAB */}
        <TabsContent value="hour-meter" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">
              Riwayat Pembacaan Jam Operasi (10 Terakhir)
            </h3>
            {canInputData(userRole) && (
              <Link href={`/hour-meter/new?equipmentId=${equipment.id}`}>
                <Button size="sm" className="gap-1.5 h-9">
                  <PlusCircle className="h-4 w-4" />
                  Input Hour Meter Baru
                </Button>
              </Link>
            )}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal Pembacaan</TableHead>
                  <TableHead>Hour Meter</TableHead>
                  <TableHead>Sumber Input</TableHead>
                  <TableHead>Dicatat Oleh</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipment.hourMeterLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                      Belum ada catatan log hour meter untuk unit ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  equipment.hourMeterLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-medium">
                        {formatDateTimeIndo(log.readingDate)}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-sm text-foreground">
                        {log.hourMeter.toLocaleString("id-ID")} Jam
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {log.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            src={log.createdBy.avatarUrl}
                            name={log.createdBy.name}
                            nik={log.createdBy.nik}
                            size="xs"
                            className="shrink-0 ring-1 ring-border"
                          />
                          <span className="font-medium text-foreground">
                            {log.createdBy.name} <span className="text-muted-foreground font-mono">({log.createdBy.nik})</span>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.remark || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* 4. REPAIR & WORK ORDER HISTORY TAB */}
        <TabsContent value="repairs" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">
              Riwayat Perbaikan & Perintah Kerja ({equipment.workOrders?.length || 0})
            </h3>
            {canInputData(userRole) && (
              <div className="flex items-center gap-2">
                <Link href={`/breakdown/new?equipmentId=${equipment.id}`}>
                  <Button size="sm" variant="destructive" className="gap-1.5 h-9">
                    <AlertTriangle className="h-4 w-4" />
                    Lapor Kerusakan
                  </Button>
                </Link>
                <Link href={`/work-order/new?equipmentId=${equipment.id}`}>
                  <Button size="sm" className="gap-1.5 h-9">
                    <PlusCircle className="h-4 w-4" />
                    Buat WO
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode WO</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Teknisi</TableHead>
                  <TableHead>Tindakan Perbaikan</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!equipment.workOrders || equipment.workOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                      Belum ada riwayat Work Order untuk unit ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  equipment.workOrders.map((wo) => (
                    <TableRow key={wo.id}>
                      <TableCell className="font-mono font-bold text-xs text-primary">
                        <Link href={`/work-order/${wo.id}`} className="hover:underline">
                          {wo.code}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{wo.type}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {wo.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {wo.assignedTo ? (
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              src={wo.assignedTo.avatarUrl}
                              name={wo.assignedTo.name}
                              nik={wo.assignedTo.nik}
                              size="xs"
                              className="shrink-0 ring-1 ring-border"
                            />
                            <span className="font-medium text-foreground">
                              {wo.assignedTo.name} <span className="text-muted-foreground font-mono">({wo.assignedTo.nik})</span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {wo.repairResult?.correctiveAction || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateIndo(wo.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {wo.status !== "DONE" && wo.status !== "CANCELED" && (
                            <>
                              <Link href={`/work-order/${wo.id}?action=diagnose`}>
                                <Button variant="outline" size="sm" className="h-7 text-xs px-2.5 gap-1 font-semibold border-border">
                                  <FileText className="h-3 w-3 text-blue-600" />
                                  Diagnose
                                </Button>
                              </Link>
                              <Link href={`/work-order/${wo.id}?action=complete`}>
                                <Button size="sm" className="h-7 text-xs px-2.5 gap-1 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Selesaikan
                                </Button>
                              </Link>
                            </>
                          )}
                          <Link href={`/work-order/${wo.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              Detail
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* 5. PM SCHEDULE PLACEHOLDER (M4) */}
        <TabsContent value="pm">
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-xs text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50 text-emerald-500" />
              Jadwal Preventive Maintenance (PM) dan Checklist akan aktif pada Milestone M4.
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. COMPLETE TIMELINE */}
        <TabsContent value="timeline" className="space-y-4">
          <EquipmentTimelineView
            events={timelineEvents}
            equipmentCode={equipment.code}
            equipmentName={equipment.name}
          />
        </TabsContent>
      </Tabs>

      {/* Equipment Photo Dialog (Camera / Upload) */}
      <PhotoCaptureDialog
        open={isPhotoDialogOpen}
        onOpenChange={setIsPhotoDialogOpen}
        onSuccess={handlePhotoSuccess}
        title={`Foto Unit ${equipment.code}`}
        description="Gunakan kamera langsung (belakang/depan) atau unggah berkas foto alat berat."
        folder="equipment"
      />
    </div>
  );
}
