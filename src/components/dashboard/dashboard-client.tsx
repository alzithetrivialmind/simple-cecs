"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, ClipboardCheck, Gauge } from "lucide-react";
import { EquipmentCategory } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { getDashboardData } from "@/server/actions/dashboard";

type DashboardPayload = Awaited<ReturnType<typeof getDashboardData>>;

interface DashboardClientProps {
  data: DashboardPayload;
}

const nf = new Intl.NumberFormat("id-ID");
const hoursFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const todayFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function DashboardClient({ data }: DashboardClientProps) {
  const { metrics } = data;
  const downUnits = metrics.breakdownUnits + metrics.underRepairUnits;
  const waitingPart = data.openWorkOrders.filter((wo) => wo.status === "WAITING_PART");

  return (
    <div className="space-y-6 pb-8">
      {/* Judul + aksi lapangan */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-condensed text-3xl font-bold leading-none tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">{todayFmt.format(new Date())}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button asChild className="col-span-2 h-12 bg-red-600 text-base hover:bg-red-700 sm:h-10 sm:text-sm">
            <Link href="/breakdown/new">
              <AlertTriangle className="h-5 w-5 sm:h-4 sm:w-4" />
              Lapor kerusakan
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 sm:h-10">
            <Link href="/hour-meter/new">
              <Gauge className="h-4 w-4" />
              Hour meter
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 sm:h-10">
            <Link href="/inspection/new">
              <ClipboardCheck className="h-4 w-4" />
              Inspeksi
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI: angka besar, bisa diketuk ke daftar terfilter */}
      <section
        aria-label="Ringkasan"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 xl:grid-cols-5"
      >
        <Kpi
          href="/equipment"
          label="Total unit"
          value={metrics.totalUnits}
          note={`${nf.format(metrics.totalFleetHours)} jam operasi`}
          className="col-span-2 sm:col-span-1"
        />
        <Kpi
          href="/equipment?status=READY"
          label="Siap operasi"
          value={metrics.readyUnits}
          note={metrics.totalUnits > 0 ? `${hoursFmt.format(metrics.readyRate)}% dari armada` : "Belum ada unit"}
        />
        <Kpi
          href="/equipment?status=DOWN"
          label="Rusak / perbaikan"
          value={downUnits}
          note={`${metrics.breakdownUnits} rusak, ${metrics.underRepairUnits} diperbaiki`}
          alert={downUnits > 0 ? "red" : undefined}
        />
        <Kpi
          href="/preventive?tab=OVERDUE"
          label="PM terlambat"
          value={metrics.pmOverdueCount}
          note={`${metrics.pmDueCount} jatuh tempo segera`}
          alert={metrics.pmOverdueCount > 0 ? "red" : undefined}
        />
        <Kpi
          href="/work-order?status=ACTIVE"
          label="WO terbuka"
          value={metrics.openWorkOrderCount}
          note={waitingPart.length > 0 ? `${waitingPart.length} menunggu part` : "Tidak ada yang menunggu part"}
          alert={waitingPart.length > 0 ? "orange" : undefined}
        />
      </section>

      {/* Grafik */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Breakdown per bulan"
          meta={`12 bulan terakhir, total ${data.breakdownsByMonth.reduce((s, m) => s + m.count, 0)}`}
        >
          <MonthBars months={data.breakdownsByMonth} />
        </Panel>
        <Panel title="Kesiapan per kategori" meta="Unit siap atau sedang dipakai">
          <CategoryBars stats={data.categoryStats} />
        </Panel>
      </div>

      {/* Notifikasi + downtime */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Perlu ditindak" flush>
          <ul className="divide-y">
            <Notice
              href="/equipment?status=BREAKDOWN"
              tone="red"
              count={metrics.activeBreakdownCount}
              label="Laporan kerusakan aktif"
              units={data.activeBreakdowns.map((b) => b.equipment.code)}
            />
            <Notice
              href="/preventive?tab=OVERDUE"
              tone="red"
              count={metrics.pmOverdueCount}
              label="PM terlambat"
              units={data.pmOverdueList.map((p) => p.equipment.code)}
            />
            <Notice
              href="/preventive?tab=DUE"
              tone="orange"
              count={metrics.pmDueCount}
              label="PM jatuh tempo segera"
              units={data.pmDueList.map((p) => p.equipment.code)}
            />
            <Notice
              href="/work-order?status=WAITING_PART"
              tone="orange"
              count={waitingPart.length}
              label="WO menunggu part"
              units={waitingPart.map((wo) => wo.equipment.code)}
            />
            <Notice
              href="/inspection"
              tone="orange"
              count={metrics.expiringCertCount}
              label="Sertifikat habis dalam 30 hari"
              units={data.expiringCertificates.map((c) => c.equipment.code)}
            />
          </ul>
        </Panel>

        <Panel title="Downtime tertinggi" meta="10 unit, 12 bulan terakhir">
          <DowntimeBars units={data.topDowntime} />
        </Panel>
      </div>
    </div>
  );
}

function Kpi({
  href,
  label,
  value,
  note,
  alert,
  className,
}: {
  href: string;
  label: string;
  value: number;
  note: string;
  alert?: "red" | "orange";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative block bg-card p-4 transition-colors hover:bg-muted/60 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        className
      )}
    >
      {alert && (
        <span
          aria-hidden
          className={cn("absolute inset-y-0 left-0 w-1", alert === "red" ? "bg-red-600" : "bg-orange-500")}
        />
      )}
      <span className="block text-sm font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          "mt-1 block font-condensed text-4xl font-bold leading-none tabular-nums",
          alert === "red" && "text-red-700",
          alert === "orange" && "text-orange-700"
        )}
      >
        {nf.format(value)}
      </span>
      <span className="mt-2 block text-xs leading-snug text-muted-foreground">{note}</span>
    </Link>
  );
}

function Panel({
  title,
  meta,
  flush,
  children,
}: {
  title: string;
  meta?: string;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b px-4 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
      </header>
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

function MonthBars({ months }: { months: DashboardPayload["breakdownsByMonth"] }) {
  const max = Math.max(1, ...months.map((m) => m.count));
  return (
    <div>
      <ul className="flex h-36 items-end gap-0.5 border-b border-foreground/20">
        {months.map((m) => (
          <li
            key={m.key}
            aria-label={`${m.label}: ${m.count} breakdown`}
            title={`${m.label}: ${m.count} breakdown`}
            className="group flex h-full flex-1 flex-col items-center justify-end"
          >
            {m.count > 0 && (
              <span className="mb-0.5 text-[11px] font-semibold tabular-nums">{m.count}</span>
            )}
            <div
              className="w-full max-w-7 rounded-t bg-primary group-hover:bg-primary/80"
              style={{ height: `${(m.count / max) * 85}%`, minHeight: m.count > 0 ? 4 : 0 }}
            />
          </li>
        ))}
      </ul>
      <div className="mt-1 flex gap-0.5" aria-hidden>
        {months.map((m, i) => (
          <span
            key={m.key}
            className={cn(
              "flex-1 text-center text-[11px] text-muted-foreground",
              // Di HP cukup selang-seling agar label bulan tidak bertabrakan
              i % 2 === 1 && "max-sm:invisible"
            )}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function CategoryBars({ stats }: { stats: DashboardPayload["categoryStats"] }) {
  const rows = (Object.keys(CATEGORY_LABELS) as EquipmentCategory[])
    .map((cat) => ({ cat, ...(stats[cat] ?? { total: 0, ready: 0 }) }))
    .filter((r) => r.total > 0);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada unit terdaftar.{" "}
        <Link href="/equipment/import" className="font-medium text-primary underline">
          Impor dari Excel
        </Link>{" "}
        untuk mulai.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = Math.round((r.ready / r.total) * 100);
        return (
          <li key={r.cat} title={`${CATEGORY_LABELS[r.cat]}: ${r.ready} dari ${r.total} siap`}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <Link href={`/equipment?category=${r.cat}`} className="font-medium hover:underline">
                {CATEGORY_LABELS[r.cat]}
              </Link>
              <span className="tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{pct}%</span> ({r.ready}/{r.total})
              </span>
            </div>
            <div className="mt-1 h-2 rounded bg-muted">
              <div className="h-full rounded bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function DowntimeBars({ units }: { units: DashboardPayload["topDowntime"] }) {
  if (units.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada WO yang ditutup dengan downtime dalam 12 bulan terakhir.
      </p>
    );
  }
  const max = Math.max(...units.map((u) => u.minutes));
  return (
    <ol className="space-y-2.5">
      {units.map((u) => {
        const hours = u.minutes / 60;
        return (
          <li key={u.id}>
            <Link href={`/equipment/${u.id}`} className="group block" title={`${u.code}: ${hoursFmt.format(hours)} jam`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-condensed text-base font-bold">{u.code}</span>{" "}
                  <span className="text-muted-foreground group-hover:underline">{u.name}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{hoursFmt.format(hours)} jam</span>
              </div>
              <div className="mt-1 h-2 rounded bg-muted">
                <div
                  className="h-full rounded bg-primary"
                  style={{ width: `${Math.max(2, (u.minutes / max) * 100)}%` }}
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function Notice({
  href,
  tone,
  count,
  label,
  units,
}: {
  href: string;
  tone: "red" | "orange";
  count: number;
  label: string;
  units: string[];
}) {
  const active = count > 0;
  const unique = [...new Set(units)];
  const shown = unique.slice(0, 3);
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-[56px] items-center gap-3 px-4 py-2.5 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span
          className={cn(
            "flex h-9 min-w-9 items-center justify-center rounded px-2 font-condensed text-xl font-bold tabular-nums",
            !active && "bg-muted text-muted-foreground",
            active && tone === "red" && "bg-red-600 text-white",
            active && tone === "orange" && "bg-orange-500 text-white"
          )}
        >
          {count}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm font-medium", !active && "text-muted-foreground")}>{label}</span>
          {shown.length > 0 && (
            <span className="block truncate text-xs text-muted-foreground">
              {shown.join(", ")}
              {unique.length > shown.length && ` dan ${unique.length - shown.length} lainnya`}
            </span>
          )}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
