"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  Wrench,
  CalendarCheck,
  Menu,
  Gauge,
  ClipboardCheck,
  Boxes,
  FileBarChart,
  ShieldCheck,
  History,
  Settings,
  PlusCircle,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Role } from "@prisma/client";
import { canAccessReports } from "@/lib/roles";
import { logoutAction } from "@/server/actions/auth";

interface BottomNavProps {
  userRole?: Role;
}

const mobileBottomNavItems = [
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
    title: "PM",
    href: "/preventive",
    icon: CalendarCheck,
  },
];

export function BottomNav({ userRole }: BottomNavProps) {
  const pathname = usePathname();
  const [openDrawer, setOpenDrawer] = React.useState(false);
  const isAdmin = userRole === "ADMIN";
  const isOperator = userRole === "OPERATOR";

  const navItems = isOperator
    ? [
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Unit",
          href: "/equipment",
          icon: Truck,
        },
        {
          title: "Hour meter",
          href: "/hour-meter",
          icon: Gauge,
        },
        {
          title: "Profil",
          href: "/settings",
          icon: Settings,
        },
      ]
    : mobileBottomNavItems;

  const menuDrawerItems = [
    {
      title: "Hour meter",
      href: "/hour-meter",
      icon: Gauge,
      adminOnly: false,
    },
    {
      title: "Inspeksi",
      href: "/inspection",
      icon: ClipboardCheck,
      adminOnly: false,
    },
    {
      title: "Spare part",
      href: "/spare-part",
      icon: Boxes,
      adminOnly: false,
    },
    // Laporan hanya untuk manajemen (SUPERVISOR/ADMIN), sejalan dengan
    // guard di server action, route ekspor, dan middleware.
    ...(canAccessReports(userRole)
      ? [
          {
            title: "Laporan",
            href: "/report",
            icon: FileBarChart,
            adminOnly: false,
          },
        ]
      : []),
    {
      title: "Akun saya",
      href: "/settings",
      icon: Settings,
      adminOnly: false,
    },
    ...(isAdmin
      ? [
          {
            title: "Administrasi",
            href: "/admin/users",
            icon: ShieldCheck,
            adminOnly: true,
          },
          {
            title: "Audit log",
            href: "/admin/logs",
            icon: History,
            adminOnly: true,
          },
        ]
      : []),
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 border-t border-border backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto items-center px-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-1 rounded-md transition-colors min-h-[48px] min-w-[48px]",
                isActive
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className={cn("h-5 w-5 mb-0.5", isActive && "stroke-[2.5px]")}
              />
              <span className="text-[10px] tracking-tight">{item.title}</span>
            </Link>
          );
        })}

        {/* 5th Button: Menu Drawer Trigger */}
        <Sheet open={openDrawer} onOpenChange={setOpenDrawer}>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex flex-col items-center justify-center py-1 rounded-md transition-colors min-h-[48px] min-w-[48px]",
                openDrawer
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Buka Menu Tambahan"
            >
              <Menu className="h-5 w-5 mb-0.5" />
              <span className="text-[10px] tracking-tight">Menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <SheetHeader className="pb-3 text-left">
              <SheetTitle className="font-condensed text-2xl font-bold">Menu</SheetTitle>
            </SheetHeader>

            <Button asChild className="h-12 w-full bg-red-600 text-base hover:bg-red-700">
              <Link href="/breakdown/new" onClick={() => setOpenDrawer(false)}>
                <PlusCircle className="h-5 w-5" />
                Lapor kerusakan
              </Link>
            </Button>

            <ul className="mt-3 divide-y rounded-lg border">
              {menuDrawerItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpenDrawer(false)}
                      className={cn(
                        "flex min-h-[52px] items-center gap-3 px-3 text-base",
                        isActive ? "bg-muted font-semibold" : "hover:bg-muted/60"
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                      {item.title}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={async () => {
                setOpenDrawer(false);
                await logoutAction();
              }}
              className="mt-3 flex min-h-[52px] w-full items-center gap-3 rounded-lg border px-3 text-base text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              Keluar
            </button>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
