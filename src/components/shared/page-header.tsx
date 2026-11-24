import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  /** Satu baris konteks faktual, mis. jumlah data. Bukan kalimat promosi. */
  meta?: React.ReactNode;
  /** Link kembali untuk halaman detail/form. */
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  /** Alias lama untuk `actions`. */
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  meta,
  backHref,
  backLabel = "Kembali",
  actions,
  children,
  className,
}: PageHeaderProps) {
  const toolbar = actions ?? children;
  return (
    <div className={cn("space-y-2", className)}>
      {backHref && (
        <Link
          href={backHref}
          className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 px-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-condensed text-3xl font-bold leading-tight tracking-tight">{title}</h1>
          {meta && <p className="mt-0.5 text-sm text-muted-foreground">{meta}</p>}
        </div>
        {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      </div>
    </div>
  );
}
