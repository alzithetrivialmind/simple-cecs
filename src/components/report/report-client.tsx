"use client";

import * as React from "react";
import {
  Download,
  Clock,
  Wrench,
  CheckCircle2,
  Activity,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { formatDateIndo } from "@/lib/utils";
import {
  getDowntimeReport,
  getPmComplianceReport,
  getPartUsageReport,
} from "@/server/actions/report";

type DowntimeData = Awaited<ReturnType<typeof getDowntimeReport>>;
type PmComplianceData = Awaited<ReturnType<typeof getPmComplianceReport>>;
type PartUsageData = Awaited<ReturnType<typeof getPartUsageReport>>;

interface ReportClientProps {
  downtimeData: DowntimeData;
  pmData: PmComplianceData;
  partUsageData: PartUsageData;
}

export function ReportClient({
  downtimeData,
  pmData,
  partUsageData,
}: ReportClientProps) {
  const [activeTab, setActiveTab] = React.useState("downtime");

  return (
    <div className="space-y-6">
      {/* Top Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <TabsList className="flex w-full sm:grid sm:grid-cols-3 sm:w-[500px]">
            <TabsTrigger value="downtime" className="gap-1.5 text-xs sm:text-sm">
              <Clock className="w-4 h-4" />
              Downtime & MTTR
            </TabsTrigger>
            <TabsTrigger value="pm" className="gap-1.5 text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4" />
              PM Compliance
            </TabsTrigger>
            <TabsTrigger value="parts" className="gap-1.5 text-xs sm:text-sm">
              <Wrench className="w-4 h-4" />
              Pemakaian Part
            </TabsTrigger>
          </TabsList>

          <Button asChild variant="outline" className="gap-2 shrink-0">
            <a href={`/api/export/report-excel?type=${activeTab}`} download>
              <Download className="w-4 h-4 text-emerald-600" />
              Export Laporan Excel (.xlsx)
            </a>
          </Button>
        </div>

        {/* 1. DOWNTIME & RELIABILITY TAB */}
        <TabsContent value="downtime" className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="shadow-sm border-l-4 border-l-red-500">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Total Downtime
                </span>
                <div className="text-2xl sm:text-3xl font-bold text-red-600">
                  {downtimeData.totalDowntimeHours} <span className="text-base font-normal text-slate-500">Jam</span>
                </div>
                <p className="text-xs text-slate-400">
                  {downtimeData.totalDowntimeMinutes.toLocaleString("id-ID")} Menit (30 Hari Terakhir)
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-amber-500">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Kejadian Breakdown
                </span>
                <div className="text-2xl sm:text-3xl font-bold text-amber-600">
                  {downtimeData.totalIncidents} <span className="text-base font-normal text-slate-500">Insiden</span>
                </div>
                <p className="text-xs text-slate-400">Kasus kerusakan alat ditangani</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-blue-500">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  MTTR (Mean Time to Repair)
                </span>
                <div className="text-2xl sm:text-3xl font-bold text-blue-600">
                  {downtimeData.mttrHours} <span className="text-base font-normal text-slate-500">Jam</span>
                </div>
                <p className="text-xs text-slate-400">Rata-rata durasi perbaikan per insiden</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-emerald-500">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  MTBF (Mean Time Between Failures)
                </span>
                <div className="text-2xl sm:text-3xl font-bold text-emerald-600">
                  {downtimeData.mtbfHours.toLocaleString("id-ID")} <span className="text-base font-normal text-slate-500">Jam</span>
                </div>
                <p className="text-xs text-slate-400">Rata-rata interval operasional antar kerusakan</p>
              </CardContent>
            </Card>
          </div>

          {/* Downtime By Category Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b bg-slate-50/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Downtime Terbesar per Kategori Unit
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {downtimeData.byCategory.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">Tidak ada catatan downtime pada periode ini.</p>
                ) : (
                  <div className="space-y-3">
                    {downtimeData.byCategory.map((cat) => {
                      const percentage = ((cat.downtimeMinutes / (downtimeData.totalDowntimeMinutes || 1)) * 100).toFixed(1);
                      return (
                        <div key={cat.category} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span>{cat.category} ({cat.count}x kejadian)</span>
                            <span className="font-mono text-slate-700">
                              {(cat.downtimeMinutes / 60).toFixed(1)} Jam ({percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div
                              className="bg-red-500 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b bg-slate-50/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Top Unit dengan Downtime Tertinggi
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {downtimeData.byEquipment.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">Semua unit beroperasi lancar tanpa downtime.</p>
                ) : (
                  <div className="space-y-2">
                    {downtimeData.byEquipment.slice(0, 5).map((eq) => (
                      <div
                        key={eq.equipment.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border bg-slate-50 text-xs"
                      >
                        <div>
                          <span className="font-mono font-bold text-slate-900">{eq.equipment.code}</span>
                          <span className="text-slate-500 ml-1.5">{eq.equipment.name}</span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="font-bold text-red-600">{(eq.downtimeMinutes / 60).toFixed(1)} Jam</span>
                          <span className="text-slate-400 ml-1">({eq.count}x)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Downtime Work Orders Detail Table */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-slate-50/50">
              <CardTitle className="text-base">Rincian Perbaikan & Downtime Mesin</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>No. WO</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Penyebab Kerusakan</TableHead>
                      <TableHead>Tindakan Perbaikan</TableHead>
                      <TableHead className="text-right">Downtime (Jam)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {downtimeData.workOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-slate-400">
                          Tidak ada work order closed dalam periode laporan ini.
                        </TableCell>
                      </TableRow>
                    ) : (
                      downtimeData.workOrders.map((wo) => (
                        <TableRow key={wo.id}>
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            {wo.code}
                          </TableCell>
                          <TableCell>
                            <div className="font-bold text-xs">{wo.equipment.code}</div>
                            <div className="text-[11px] text-slate-500">{wo.equipment.name}</div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-700 max-w-xs">
                            {wo.diagnosis?.rootCause || wo.breakdownRequest?.problem || "-"}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700 max-w-xs">
                            {wo.repairResult?.correctiveAction || "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-red-600">
                            {((wo.downtimeMinutes || 0) / 60).toFixed(1)} Jam
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. PM COMPLIANCE TAB */}
        <TabsContent value="pm" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="shadow-sm border-l-4 border-l-emerald-500">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  PM Compliance Rate
                </span>
                <div className="text-3xl font-bold text-emerald-600">
                  {pmData.complianceRate}%
                </div>
                <p className="text-xs text-slate-400">Tingkat kepatuhan jadwal preventif</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-blue-500">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Total Rencana PM
                </span>
                <div className="text-3xl font-bold text-slate-900">
                  {pmData.totalPlans}
                </div>
                <p className="text-xs text-slate-400">Jadwal PM aktif terdaftar</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-amber-500">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Jatuh Tempo (Due)
                </span>
                <div className="text-3xl font-bold text-amber-600">
                  {pmData.dueCount}
                </div>
                <p className="text-xs text-slate-400">Siap dieksekusi segera</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-red-500">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Terlambat (Overdue)
                </span>
                <div className="text-3xl font-bold text-red-600">
                  {pmData.overdueCount}
                </div>
                <p className="text-xs text-slate-400">Perlu penanganan prioritas</p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-slate-50/50">
              <CardTitle className="text-base">Daftar Kepatuhan Jadwal Preventive Maintenance</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Unit Equipment</TableHead>
                      <TableHead>Tipe Servis</TableHead>
                      <TableHead>Basis & Interval</TableHead>
                      <TableHead>Titik Jatuh Tempo</TableHead>
                      <TableHead>Status Kepatuhan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pmData.plans.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-bold text-xs">{p.equipment.code}</div>
                          <div className="text-[11px] text-slate-500">{p.equipment.name}</div>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{p.pmType.name}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {p.basis === "HOUR_METER" ? `Tiap ${p.intervalHour} Jam` : `Tiap ${p.intervalDays} Hari`}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {p.basis === "HOUR_METER"
                            ? `${p.nextDueHour?.toLocaleString("id-ID")} Jam`
                            : formatDateIndo(p.nextDueDate)}
                        </TableCell>
                        <TableCell>
                          {p.status === "OVERDUE" ? (
                            <Badge className="bg-red-600 text-white text-xs">TELAT (OVERDUE)</Badge>
                          ) : p.status === "DUE" ? (
                            <Badge className="bg-amber-500 text-white text-xs">Jatuh tempo</Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-xs">
                              AMAN
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. PART USAGE TAB */}
        <TabsContent value="parts" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="shadow-sm border-l-4 border-l-blue-500">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Total Komponen Terpakai
                </span>
                <div className="text-3xl font-bold text-blue-600">
                  {partUsageData.totalQuantity} <span className="text-base font-normal text-slate-500">Unit/Pcs</span>
                </div>
                <p className="text-xs text-slate-400">Total pemakaian part dalam 30 hari</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-purple-500">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Frekuensi Penggantian
                </span>
                <div className="text-3xl font-bold text-purple-600">
                  {partUsageData.totalUsagesCount} <span className="text-base font-normal text-slate-500">Kali</span>
                </div>
                <p className="text-xs text-slate-400">Pencatatan pemakaian pada Work Order</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-emerald-500">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Sistem Paling Dominan
                </span>
                <div className="text-xl sm:text-2xl font-bold text-emerald-700 truncate">
                  {partUsageData.bySystem[0]?.system || "ENGINE"}
                </div>
                <p className="text-xs text-slate-400">
                  {partUsageData.bySystem[0]?.totalQty || 0} unit part terpasang
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By System Chart / Breakdown */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b bg-slate-50/50">
                <CardTitle className="text-base">Distribusi Pemakaian per Sistem Komponen</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {partUsageData.bySystem.map((sys) => {
                  const pct = ((sys.totalQty / (partUsageData.totalQuantity || 1)) * 100).toFixed(1);
                  return (
                    <div key={sys.system} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>{sys.system}</span>
                        <span className="font-mono text-slate-700">
                          {sys.totalQty} Pcs ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Top 10 Replaced Parts */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b bg-slate-50/50">
                <CardTitle className="text-base">10 Spare Part Paling Sering Diganti</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {partUsageData.topParts.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">Belum ada data pemakaian part.</p>
                ) : (
                  <div className="space-y-2">
                    {partUsageData.topParts.map((tp) => (
                      <div
                        key={tp.part.id}
                        className="flex items-center justify-between p-2 rounded-lg border bg-slate-50 text-xs"
                      >
                        <div>
                          <span className="font-mono font-bold text-slate-900">{tp.part.partNumber}</span>
                          <span className="text-slate-500 ml-1.5">{tp.part.description}</span>
                        </div>
                        <span className="font-mono font-bold text-primary">
                          {tp.totalQty} {tp.part.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
