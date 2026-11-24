import { cn } from "@/lib/utils";

export function AppCredit({ className }: { className?: string }) {
  return (
    <p className={cn("text-center text-xs text-muted-foreground", className)}>
      <a
        href="https://www.alzi.work/"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline-offset-2 hover:underline"
      >
        CECS by Alzi
      </a>
    </p>
  );
}
