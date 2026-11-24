"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  AlertTriangle,
  Clock,
  Wrench,
  ShieldAlert,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SystemNotification,
  getSystemNotifications,
} from "@/server/actions/notifications";
import { formatDateTimeIndo } from "@/lib/utils";

interface NotificationBellProps {
  initialNotifications?: SystemNotification[];
}

export function NotificationBell({
  initialNotifications = [],
}: NotificationBellProps) {
  const [notifications, setNotifications] =
    React.useState<SystemNotification[]>(initialNotifications);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const count = notifications.length;

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setIsLoading(true);
      try {
        const refreshed = await getSystemNotifications();
        setNotifications(refreshed);
      } catch (err) {
        console.error("Failed to refresh notifications:", err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const getIcon = (type: SystemNotification["type"]) => {
    switch (type) {
      case "BREAKDOWN":
        return <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />;
      case "PM_OVERDUE":
        return <Clock className="h-4 w-4 text-amber-600 shrink-0" />;
      case "WAITING_PART":
        return <Wrench className="h-4 w-4 text-orange-600 shrink-0" />;
      case "EXPIRING_CERTIFICATE":
        return <ShieldAlert className="h-4 w-4 text-blue-600 shrink-0" />;
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground h-9 w-9 rounded-full"
          aria-label="Pusat Notifikasi"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[340px] sm:w-[380px] p-0 shadow-xl border-border rounded-xl overflow-hidden"
      >
        <DropdownMenuLabel className="p-3 bg-muted/50 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold text-foreground">
              Peringatan Operasional
            </span>
          </div>
          {count > 0 ? (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-semibold">
              {count} Perlu Atensi
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-emerald-700 bg-emerald-50 border-emerald-200">
              Aman
            </Badge>
          )}
        </DropdownMenuLabel>

        {/* List of Alerts */}
        <div className="max-h-[360px] overflow-y-auto divide-y divide-border/60">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Memuat notifikasi terbaru...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 px-4 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-foreground">
                Tidak ada peringatan darurat
              </p>
              <p className="text-[11px] text-muted-foreground max-w-[220px] mx-auto">
                Seluruh peralatan beroperasi normal, tidak ada PM telat servis atau kerusakan aktif.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <DropdownMenuItem
                key={item.id}
                asChild
                className="p-3 cursor-pointer focus:bg-muted/80 flex items-start gap-3 text-xs"
              >
                <Link href={item.href} onClick={() => setIsOpen(false)}>
                  <div className="mt-0.5 p-1.5 rounded-lg bg-muted border shrink-0">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-foreground truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                        {formatDateTimeIndo(new Date(item.createdAt)).split(" ")[1]} WIB
                      </span>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-[11px] leading-tight">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />

        {/* Footer Link */}
        <div className="p-2 bg-muted/30 flex items-center justify-between text-xs">
          <Link
            href="/dashboard"
            onClick={() => setIsOpen(false)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-primary hover:underline"
          >
            Buka Dashboard Pemantauan
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
