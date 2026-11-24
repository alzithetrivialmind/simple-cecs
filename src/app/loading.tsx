import { Loader2 } from "lucide-react";

export default function RootLoading() {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
      Memuat...
    </div>
  );
}
