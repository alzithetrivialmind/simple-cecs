"use client";

import { ORG_NAME } from "@/lib/brand";
import Link from "next/link";
import { AppCredit } from "@/components/shared/app-credit";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  Wrench,
  Gauge,
  CalendarCheck,
  ClipboardCheck,
  Boxes,
  FileBarChart,
  Users,
  Database,
  History,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Role } from "@prisma/client";
import { canAccessReports, isReportPath } from "@/lib/roles";
import { logoutAction } from "@/server/actions/auth";

interface SidebarProps {
  userRole?: Role;
}

const mainNavItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Equipment",
    href: "/equipment",
    icon: Truck,
  },
  {
    title: "Work order",
    href: "/work-order",
    icon: Wrench,
  },
  {
    title: "Hour meter",
    href: "/hour-meter",
    icon: Gauge,
  },
  {
    title: "Preventive",
    href: "/preventive",
    icon: CalendarCheck,
  },
  {
    title: "Inspeksi",
    href: "/inspection",
    icon: ClipboardCheck,
  },
  {
    title: "Spare part",
    href: "/spare-part",
    icon: Boxes,
  },
  {
    title: "Laporan",
    href: "/report",
    icon: FileBarChart,
  },
];

const adminNavItems = [
  {
    title: "Pengguna",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Master Data",
    href: "/admin/master",
    icon: Database,
  },
  {
    title: "Audit log",
    href: "/admin/logs",
    icon: History,
  },
];

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = userRole === "ADMIN";
  const isOperator = userRole === "OPERATOR";

  const filteredNavItems = mainNavItems.filter((item) => {
    if (isOperator) {
      return ["/dashboard", "/equipment", "/hour-meter"].includes(item.href);
    }
    // Laporan hanya untuk manajemen; sumber kebenarannya di @/lib/roles
    // sehingga selalu sejalan dengan guard di server dan middleware.
    if (isReportPath(item.href)) {
      return canAccessReports(userRole);
    }
    return true;
  });

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-40 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Brand Header */}
      <div className="flex items-center gap-3 h-16 px-4 border-b border-sidebar-border/60">
        <Image
          src="/logo.png"
          alt={ORG_NAME}
          width={32}
          height={32}
          priority
          className="h-8 w-auto object-contain shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="font-bold tracking-wide text-sm text-white truncate leading-tight">CECS</div>
          <div className="text-[10px] text-sky-300 font-medium tracking-tight truncate leading-tight">
            {ORG_NAME}
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <div className="flex-1 flex flex-col justify-between overflow-y-auto px-4 py-4 space-y-6">
        <nav className="space-y-1">
          <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">
            {isOperator ? "Operasional Alat" : "Operasional"}
          </div>
          {filteredNavItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]",
                  isActive
                    ? "relative bg-sidebar-accent text-white font-semibold before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r before:bg-sidebar-primary"
                    : "text-slate-300 hover:bg-sidebar-accent/50 hover:text-white"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive ? "text-sidebar-primary" : "text-slate-400"
                  )}
                />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* Show Admin navigation only if user is ADMIN */}
        {isAdmin && (
          <nav className="space-y-1 pt-4 border-t border-sidebar-border/60">
            <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">
              Administrasi
            </div>
            {adminNavItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]",
                    isActive
                      ? "relative bg-sidebar-accent text-white font-semibold before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r before:bg-sidebar-primary"
                      : "text-slate-300 hover:bg-sidebar-accent/50 hover:text-white"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      isActive ? "text-sidebar-primary" : "text-slate-400"
                    )}
                  />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {/* System Footer & Logout */}
      <div className="p-3 border-t border-sidebar-border/60 space-y-1">
        <Link
          href="/settings"
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-sidebar-accent/60 hover:text-white transition-colors"
        >
          <Settings className="h-4 w-4 shrink-0 text-slate-400" />
          <span>Akun saya</span>
        </Link>
        <button
          type="button"
          onClick={async () => {
            await logoutAction();
          }}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-rose-200 hover:bg-rose-500/20 hover:text-white transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0 text-rose-300" />
          <span>Keluar</span>
        </button>
        <div className="px-3 pt-2 text-xs text-slate-300">
          <p className="font-medium">{ORG_NAME}</p>
          <AppCredit className="text-left text-slate-400 [&_a]:text-slate-200" />
        </div>
      </div>
    </aside>
  );
}
