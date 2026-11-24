"use client";

import * as React from "react";
import Link from "next/link";
import {
  Wrench,
  AlertTriangle,
  ClipboardCheck,
  Gauge,
  CheckCircle2,
  ExternalLink,
  PlayCircle,
  StopCircle,
  FileText,
  Camera,
  Search,
  Download,
  X,
  Maximize2,
  Clock,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DetailedTimelineEvent,
  TimelineAttachment,
  TimelineCategory,
} from "@/server/actions/timeline";
import { formatDateTimeIndo } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";

interface EquipmentTimelineViewProps {
  events: DetailedTimelineEvent[];
  equipmentCode?: string;
  equipmentName?: string;
}

export function EquipmentTimelineView({
  events,
  equipmentCode,
  equipmentName,
}: EquipmentTimelineViewProps) {
  const [selectedCategory, setSelectedCategory] = React.useState<TimelineCategory>("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activePhoto, setActivePhoto] = React.useState<TimelineAttachment | null>(null);

  // Filter events by category and search query
  const filteredEvents = React.useMemo(() => {
    return events.filter((ev) => {
      // Category filter
      if (selectedCategory !== "ALL" && ev.category !== selectedCategory) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = ev.title.toLowerCase().includes(q);
        const matchDesc = ev.description.toLowerCase().includes(q);
        const matchUser = ev.user?.name.toLowerCase().includes(q) || ev.user?.nik?.toLowerCase().includes(q);
        const matchCode = ev.metadata?.code?.toLowerCase().includes(q);
        return matchTitle || matchDesc || matchUser || matchCode;
      }

      return true;
    });
  }, [events, selectedCategory, searchQuery]);

  // Counts for tabs
  const counts = React.useMemo(() => {
    return {
      ALL: events.length,
      USAGE: events.filter((e) => e.category === "USAGE").length,
      BREAKDOWN_WO: events.filter((e) => e.category === "BREAKDOWN_WO").length,
      HOUR_METER: events.filter((e) => e.category === "HOUR_METER").length,
      INSPECTION: events.filter((e) => e.category === "INSPECTION").length,
    };
  }, [events]);

  const getEventIcon = (type: DetailedTimelineEvent["type"]) => {
    switch (type) {
      case "USAGE_START":
        return <PlayCircle className="w-4 h-4 text-emerald-600" />;
      case "USAGE_END":
        return <StopCircle className="w-4 h-4 text-amber-600" />;
      case "BREAKDOWN":
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      case "WORK_ORDER_CREATED":
        return <FileText className="w-4 h-4 text-indigo-600" />;
      case "WORK_ORDER_STARTED":
        return <Wrench className="w-4 h-4 text-amber-600" />;
      case "WORK_ORDER_CLOSED":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case "HOUR_METER":
        return <Gauge className="w-4 h-4 text-blue-600" />;
      case "INSPECTION":
        return <ClipboardCheck className="w-4 h-4 text-purple-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-600" />;
    }
  };

  const getNodeBg = (type: DetailedTimelineEvent["type"]) => {
    switch (type) {
      case "USAGE_START":
      case "WORK_ORDER_CLOSED":
        return "bg-emerald-50 border-emerald-500 text-emerald-600";
      case "USAGE_END":
      case "WORK_ORDER_STARTED":
        return "bg-amber-50 border-amber-500 text-amber-600";
      case "BREAKDOWN":
        return "bg-rose-50 border-rose-500 text-rose-600";
      case "WORK_ORDER_CREATED":
        return "bg-indigo-50 border-indigo-500 text-indigo-600";
      case "HOUR_METER":
        return "bg-blue-50 border-blue-500 text-blue-600";
      case "INSPECTION":
        return "bg-purple-50 border-purple-500 text-purple-600";
      default:
        return "bg-slate-50 border-slate-400 text-slate-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border rounded-xl p-4 shadow-xs">
        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={selectedCategory === "ALL" ? "default" : "outline"}
            onClick={() => setSelectedCategory("ALL")}
            className="h-8 text-xs font-semibold"
          >
            Semua ({counts.ALL})
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "USAGE" ? "default" : "outline"}
            onClick={() => setSelectedCategory("USAGE")}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            Pemakaian ({counts.USAGE})
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "BREAKDOWN_WO" ? "default" : "outline"}
            onClick={() => setSelectedCategory("BREAKDOWN_WO")}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <Wrench className="w-3.5 h-3.5" />
            Kerusakan & WO ({counts.BREAKDOWN_WO})
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "HOUR_METER" ? "default" : "outline"}
            onClick={() => setSelectedCategory("HOUR_METER")}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <Gauge className="w-3.5 h-3.5" />
            Hour Meter ({counts.HOUR_METER})
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "INSPECTION" ? "default" : "outline"}
            onClick={() => setSelectedCategory("INSPECTION")}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Inspeksi ({counts.INSPECTION})
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari aktivitas, nama user, kode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Timeline Stream */}
      {filteredEvents.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center text-muted-foreground space-y-2">
          <Clock className="w-10 h-10 mx-auto opacity-40 text-muted-foreground" />
          <p className="text-sm font-medium">Tidak ada aktivitas yang sesuai dengan filter.</p>
          <p className="text-xs text-muted-foreground">Coba ubah kata kunci pencarian atau pilih kategori Semua.</p>
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {filteredEvents.map((ev) => {
            const hasAttachments = ev.attachments && ev.attachments.length > 0;

            return (
              <div key={ev.id} className="relative group">
                {/* Node Icon */}
                <div
                  className={`absolute -left-[27px] sm:-left-[31px] top-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 flex items-center justify-center shadow-xs transition-transform group-hover:scale-110 ${getNodeBg(
                    ev.type
                  )}`}
                >
                  {getEventIcon(ev.type)}
                </div>

                {/* Card Event Content */}
                <div className="bg-card hover:bg-muted/40 p-4 rounded-xl border shadow-xs transition-colors space-y-2.5">
                  {/* Card Top: Title, Date, Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {ev.title}
                      </span>
                      <Badge variant={ev.badgeVariant || "secondary"} className="text-[10px] px-2 py-0">
                        {ev.badgeText}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground font-mono">
                      <Clock className="h-3 w-3" />
                      <span>{formatDateTimeIndo(ev.date)}</span>
                    </div>
                  </div>

                  {/* Card Body: Description */}
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    {ev.description}
                  </p>

                  {/* Card Metadata / Stats if any */}
                  {ev.metadata && (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-muted-foreground">
                      {ev.metadata.hourMeter !== undefined && (
                        <span className="bg-muted px-2 py-0.5 rounded font-mono font-medium">
                          HM: {ev.metadata.hourMeter.toLocaleString("id-ID")} Jam
                        </span>
                      )}
                      {ev.metadata.durationMinutes !== undefined && ev.metadata.durationMinutes !== null && (
                        <span className="bg-muted px-2 py-0.5 rounded font-medium text-emerald-700 dark:text-emerald-400">
                          Durasi: {Math.floor(ev.metadata.durationMinutes / 60)}j {ev.metadata.durationMinutes % 60}m
                        </span>
                      )}
                      {ev.metadata.downtimeMinutes !== undefined && ev.metadata.downtimeMinutes !== null && (
                        <span className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded font-medium">
                          Downtime: {Math.floor(ev.metadata.downtimeMinutes / 60)}j {ev.metadata.downtimeMinutes % 60}m
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actor / User Identity & Attachment Actions */}
                  <div className="pt-2 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    {/* User Identity with Avatar */}
                    {ev.user ? (
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          src={ev.user.avatarUrl}
                          name={ev.user.name}
                          nik={ev.user.nik}
                          size="sm"
                          className="shrink-0 ring-1 ring-border"
                        />
                        <div className="flex flex-col leading-tight">
                          <span className="font-semibold text-foreground">
                            {ev.user.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            NIK: {ev.user.nik || "-"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                        <UserIcon className="h-3.5 w-3.5" />
                        <span>Sistem Otomatis</span>
                      </div>
                    )}

                    {/* Action Buttons: View Photo Attachment & View Details */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* View Photo Buttons */}
                      {hasAttachments &&
                        ev.attachments.map((att, idx) => (
                          <Button
                            key={att.id || idx}
                            variant="outline"
                            size="sm"
                            onClick={() => setActivePhoto(att)}
                            className="h-7 px-2 text-xs gap-1.5 font-medium border-primary/30 text-primary hover:bg-primary/10"
                            title="Klik untuk melihat foto lampiran"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            <span>
                              {ev.attachments.length > 1
                                ? `Lihat Foto (${idx + 1})`
                                : "Lihat Lampiran Foto"}
                            </span>
                          </Button>
                        ))}

                      {/* Detail Link (if WO or Inspection) */}
                      {ev.linkUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-7 px-2 text-xs text-primary gap-1"
                        >
                          <Link href={ev.linkUrl}>
                            <span>Detail</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Photo Viewer Dialog */}
      <Dialog open={!!activePhoto} onOpenChange={(open) => !open && setActivePhoto(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-background">
          <DialogHeader className="p-4 pb-3 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" />
                <span>{activePhoto?.title || "Foto Lampiran"}</span>
              </DialogTitle>
            </div>
            {activePhoto?.uploadedBy && (
              <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                <UserAvatar
                  src={activePhoto.uploadedBy.avatarUrl}
                  name={activePhoto.uploadedBy.name}
                  nik={activePhoto.uploadedBy.nik}
                  size="xs"
                  className="shrink-0"
                />
                <span>
                  Diunggah oleh <strong className="text-foreground">{activePhoto.uploadedBy.name}</strong>
                  {activePhoto.uploadedAt && ` pada ${formatDateTimeIndo(activePhoto.uploadedAt)}`}
                </span>
              </div>
            )}
          </DialogHeader>

          {/* Photo Display */}
          <div className="relative bg-slate-950 flex items-center justify-center min-h-[320px] max-h-[70vh] overflow-hidden p-2">
            {activePhoto?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activePhoto.url}
                alt={activePhoto.title}
                className="max-h-[68vh] max-w-full object-contain rounded"
              />
            ) : (
              <span className="text-slate-400 text-xs">Foto tidak dapat dimuat.</span>
            )}
          </div>

          {/* Dialog Footer Actions */}
          <div className="p-3 border-t bg-muted/30 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {equipmentCode && `${equipmentCode} • `}{equipmentName || "CECS Asset"}
            </span>

            <div className="flex items-center gap-2">
              {activePhoto?.url && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-8 text-xs gap-1.5"
                  >
                    <a href={activePhoto.url} target="_blank" rel="noopener noreferrer">
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span>Ukuran Penuh</span>
                    </a>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-8 text-xs gap-1.5"
                  >
                    <a href={activePhoto.url} download>
                      <Download className="h-3.5 w-3.5" />
                      <span>Unduh</span>
                    </a>
                  </Button>
                </>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={() => setActivePhoto(null)}
                className="h-8 text-xs"
              >
                Tutup
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
