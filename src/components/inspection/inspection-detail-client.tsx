"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Gauge,
  FileText,
  Download,
  MapPin,
  User,
  ShieldCheck,
  Wrench,
  ExternalLink,
  ArrowLeft,
  FileCheck2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InspectionResult } from "@prisma/client";
import { formatDate } from "@/lib/utils";
import { getInspectionById, deleteInspection } from "@/server/actions/inspection";
import { UserAvatar } from "@/components/shared/user-avatar";
import { toast } from "sonner";

type InspectionDetailData = NonNullable<Awaited<ReturnType<typeof getInspectionById>>>;

interface InspectionDetailProps {
  inspection: InspectionDetailData;
  userRole?: string;
}

export function InspectionDetailClient({ inspection, userRole }: InspectionDetailProps) {
  const router = useRouter();

  const getResultBadge = (res: InspectionResult) => (
    <StatusBadge kind="inspection" status={res} className="text-sm" />
  );

  const getCertStatus = (validUntil: Date | null) => {
    if (!validUntil) return null;
    const now = new Date();
    const expiry = new Date(validUntil);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
          Sertifikat Kedaluwarsa ({Math.abs(diffDays)} hari yang lalu)
        </span>
      );
    } else if (diffDays <= 30) {
      return (
        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
          Masa Berlaku Tinggal {diffDays} Hari
        </span>
      );
    } else {
      return (
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          Sertifikat Aktif (Hingga {formatDate(validUntil)})
        </span>
      );
    }
  };

  const handleDelete = async () => {
    if (confirm(`Apakah Anda yakin ingin menghapus Inspeksi ${inspection.code}?`)) {
      try {
        const res = await deleteInspection(inspection.id);
        if (res.success) {
          toast.success("Inspeksi berhasil dihapus.");
          router.push("/inspection");
        } else {
          toast.error(res.error || "Gagal menghapus inspeksi.");
        }
      } catch {
        toast.error("Terjadi kesalahan sistem");
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header Card */}
      <Card className="overflow-hidden">
        <div className="border-b p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {inspection.code}, {inspection.inspectionType.name}
                </span>
              </div>
              <h1 className="font-condensed text-3xl font-bold leading-tight tracking-tight">
                {inspection.equipment.code}
              </h1>
              <p className="font-medium">{inspection.equipment.name}</p>
            </div>

            <div className="flex items-center gap-3">
              {getResultBadge(inspection.result)}
              {userRole === "ADMIN" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="h-10 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Hapus
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Info Grid */}
        <CardContent className="grid grid-cols-2 gap-4 border-b p-4 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Tanggal Inspeksi
            </div>
            <div className="font-semibold text-slate-800 mt-1">
              {formatDate(inspection.inspectionDate)}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5" />
              Hour Meter Unit
            </div>
            <div className="font-mono font-semibold text-slate-800 mt-1">
              {inspection.hourMeter.toLocaleString("id-ID")} Jam
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground font-medium flex items-center gap-1 mb-1.5">
              <User className="w-3.5 h-3.5" />
              Inspektor
            </div>
            <div className="flex items-center gap-2">
              <UserAvatar
                name={inspection.inspector.name}
                avatarUrl={inspection.inspector.avatarUrl}
                size="sm"
              />
              <div>
                <div className="font-semibold text-slate-800 text-sm">
                  {inspection.inspector.name}
                </div>
                <div className="text-xs text-slate-400">NIK: {inspection.inspector.nik}</div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              Lokasi / Dept
            </div>
            <div className="font-semibold text-slate-800 mt-1">
              {inspection.equipment.location?.name || "-"}
            </div>
            <div className="text-xs text-slate-400">
              {inspection.equipment.department?.name || "-"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certificate Details (if any) */}
      {inspection.certificateNumber && (
        <Card className="shadow-sm border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3 border-b border-blue-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2 text-blue-950">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                Sertifikat Kelaikan / Izin Operasi
              </CardTitle>
              {getCertStatus(inspection.validUntil)}
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-500">Nomor Registrasi / SKK:</span>
              <div className="font-mono font-bold text-slate-900 text-base mt-0.5">
                {inspection.certificateNumber}
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-500">Masa Berlaku Hingga:</span>
              <div className="font-semibold text-slate-900 mt-0.5">
                {inspection.validUntil ? formatDate(inspection.validUntil) : "-"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Findings & Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Finding Card */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 border-b bg-slate-50/50">
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-primary" />
              Temuan Pemeriksaan (Findings)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {inspection.finding ? (
              <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                {inspection.finding}
              </p>
            ) : (
              <p className="text-sm text-slate-400 italic">
                Tidak ada temuan anomali atau kerusakan khusus.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recommendation Card */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 border-b bg-slate-50/50">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              Rekomendasi Tindak Lanjut
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {inspection.recommendation ? (
              <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                {inspection.recommendation}
              </p>
            ) : (
              <p className="text-sm text-slate-400 italic">
                Tidak ada rekomendasi khusus. Unit dapat beroperasi normal.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attachments Section */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 border-b bg-slate-50/50">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Dokumen Lampiran ({inspection.attachments?.length || 0})
          </CardTitle>
          <CardDescription>
            Scan sertifikat pengesahan, formulir checklist inspeksi lapangan, atau dokumentasi foto.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {!inspection.attachments || inspection.attachments.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400 italic">
              Tidak ada dokumen lampiran yang diunggah untuk inspeksi ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {inspection.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 rounded bg-white shadow-xs border">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {att.fileName}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{(att.sizeBytes / 1024).toFixed(1)} KB</span>
                        <span>•</span>
                        <div className="flex items-center gap-1.5">
                          <UserAvatar
                            name={att.uploadedBy.name}
                            avatarUrl={att.uploadedBy.avatarUrl}
                            size="xs"
                          />
                          <span>Oleh {att.uploadedBy.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button size="sm" variant="ghost" asChild className="h-8 shrink-0">
                    <a
                      href={`/api/files/${att.fileKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="gap-1 text-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Unduh
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" asChild className="gap-2">
          <Link href="/inspection">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Daftar Inspeksi
          </Link>
        </Button>

        <Button asChild className="gap-2">
          <Link href={`/equipment/${inspection.equipment.id}`}>
            Lihat Profil Unit {inspection.equipment.code}
            <ExternalLink className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
