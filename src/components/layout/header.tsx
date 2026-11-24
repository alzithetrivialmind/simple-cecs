"use client";

import { ORG_NAME } from "@/lib/brand";
import Image from "next/image";
import Link from "next/link";
import { roleLabel } from "@/lib/labels";
import { LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/server/actions/auth";
import { Role } from "@prisma/client";
import { UserAvatar } from "@/components/shared/user-avatar";
import { NotificationBell } from "./notification-bell";

interface HeaderProps {
  user?: {
    id?: string;
    name?: string | null;
    nik?: string;
    role?: Role;
    avatarUrl?: string | null;
  } | null;
}

export function Header({ user }: HeaderProps) {
  const userName = user?.name || "Pengguna";
  const userRole = user?.role || "TECHNICIAN";
  const userNik = user?.nik ? `NIK: ${user.nik}` : "";

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background/95 px-4 md:px-8 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Mobile brand header */}
      <div className="flex items-center gap-2.5 lg:hidden">
        <Image
          src="/logo.png"
          alt={ORG_NAME}
          width={24}
          height={24}
          className="h-6 w-auto object-contain"
        />
        <div>
          <div className="font-bold text-sm leading-tight text-foreground">
            CECS
          </div>
          <div className="text-[10px] text-muted-foreground">
            {ORG_NAME}
          </div>
        </div>
      </div>

      <div className="hidden lg:block" />

      {/* Right controls */}
      <div className="flex items-center gap-2 md:gap-3">
        <NotificationBell />

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="flex items-center gap-2 px-2 py-1 h-10 border-border hover:border-primary/50"
            >
              <UserAvatar
                src={user?.avatarUrl}
                name={userName}
                nik={user?.nik}
                size="sm"
                className="h-7 w-7"
              />
              <div className="hidden md:flex flex-col items-start text-left">
                <span className="text-xs font-semibold leading-tight line-clamp-1">
                  {userName}
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {roleLabel(userRole)}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-3 py-1">
                <UserAvatar
                  src={user?.avatarUrl}
                  name={userName}
                  nik={user?.nik}
                  size="md"
                  className="h-10 w-10"
                />
                <div className="flex flex-col space-y-0.5 min-w-0">
                  <p className="text-sm font-semibold leading-tight truncate">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground font-mono">
                    {userNik}
                  </p>
                  <p className="text-xs font-semibold text-primary">
                    {roleLabel(userRole)}
                  </p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2 cursor-pointer py-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>Akun saya</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await logoutAction();
              }}
              className="text-destructive focus:text-destructive cursor-pointer py-2"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Keluar (Logout)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
