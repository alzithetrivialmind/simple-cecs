import { Loader2 } from "lucide-react";

// Ringan: tidak menutupi layar, header dan navigasi tetap bisa dipakai
export default function AppLoading() {
  return (
    <div role="status" className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
      Memuat...
    </div>
  );
}
