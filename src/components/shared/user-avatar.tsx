"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  src?: string | null;
  avatarUrl?: string | null;
  name?: string | null;
  nik?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  showBorder?: boolean;
}

export function UserAvatar({
  src,
  avatarUrl,
  name,
  nik,
  size = "md",
  className,
  showBorder = true,
}: UserAvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const resolvedSrc = src || avatarUrl;

  // Derive initials
  const initials = React.useMemo(() => {
    if (!name) return nik?.slice(0, 2).toUpperCase() || "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name, nik]);

  // Size mapping
  const sizeClasses = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
    xl: "h-20 w-20 text-xl",
  };

  const imageSizes = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
  };

  const hasValidImage = resolvedSrc && !imageError;

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden font-bold select-none",
        sizeClasses[size],
        showBorder && "ring-2 ring-background shadow-sm",
        !hasValidImage && "bg-gradient-to-tr from-emerald-700 via-primary to-teal-600 text-white",
        className
      )}
    >
      {hasValidImage && resolvedSrc ? (
        <Image
          src={resolvedSrc}
          alt={name || "User Avatar"}
          width={imageSizes[size]}
          height={imageSizes[size]}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
          unoptimized
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
