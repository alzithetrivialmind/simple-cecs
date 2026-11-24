import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // Tag persegi, bukan pil: mirip label status yang digantung di unit
  "inline-flex items-center whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold leading-5 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-red-600 text-white",
        outline: "border-border bg-background text-foreground",
        // Status unit (UI-SPEC: hijau / abu / merah / oranye / abu gelap)
        ready: "border-transparent bg-green-700 text-white",
        inUse: "border-green-700 bg-green-50 text-green-800",
        standby: "border-transparent bg-gray-500 text-white",
        breakdown: "border-transparent bg-red-600 text-white",
        underRepair: "border-transparent bg-orange-600 text-white",
        scrapped: "border-transparent bg-gray-800 text-white",
        // Status PM (merah / oranye / biru)
        overdue: "border-transparent bg-red-600 text-white",
        due: "border-transparent bg-orange-600 text-white",
        upcoming: "border-transparent bg-blue-600 text-white",
        // Status WO
        open: "border-blue-600 bg-blue-50 text-blue-800",
        waitingPart: "border-transparent bg-yellow-400 text-gray-900",
        inProgress: "border-transparent bg-orange-600 text-white",
        done: "border-transparent bg-green-700 text-white",
        closed: "border-gray-300 bg-gray-100 text-gray-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
