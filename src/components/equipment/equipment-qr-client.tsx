"use client";

import { ORG_NAME } from "@/lib/brand";
import * as React from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Printer, ArrowLeft, QrCode, Download, Copy, Check, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface EquipmentQrItem {
  id: string;
  code: string;
  name: string;
  category: string;
  model: string | null;
  serialNumber: string | null;
  qrDataUrl?: string;
}

interface EquipmentQrClientProps {
  initialEquipment: EquipmentQrItem[];
  selectedId?: string;
  defaultBaseUrl?: string;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 2
) {
  const words = text.split(" ");
  let line = "";
  let linesDrawn = 0;
  let curY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      linesDrawn++;
      if (linesDrawn === maxLines && n < words.length) {
        ctx.fillText(line.trim() + "...", x, curY);
        return;
      }
      ctx.fillText(line.trim(), x, curY);
      line = words[n] + " ";
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line.trim().length > 0) {
    ctx.fillText(line.trim(), x, curY);
  }
}

async function generateLabelImageBlob(
  eq: EquipmentQrItem,
  qrDataUrl: string
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  const width = 1000;
  const height = 600;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Outer border with rounded corners
  const pad = 24;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;
  const radius = 24;

  ctx.lineWidth = 6;
  ctx.strokeStyle = "#0f172a";
  ctx.beginPath();
  ctx.roundRect(pad, pad, cardW, cardH, radius);
  ctx.stroke();

  // Load Logo
  const logo = new Image();
  logo.crossOrigin = "anonymous";
  const logoPromise = new Promise<void>((resolve) => {
    logo.onload = () => resolve();
    logo.onerror = () => resolve();
    logo.src = "/logo.png";
  });

  // Load QR
  const qr = new Image();
  const qrPromise = new Promise<void>((resolve) => {
    qr.onload = () => resolve();
    qr.onerror = () => resolve();
    qr.src = qrDataUrl;
  });

  await Promise.all([logoPromise, qrPromise]);

  // Header content
  const headerY = pad + 24;
  let textLeft = pad + 24;
  if (logo.complete && logo.naturalWidth > 0) {
    const logoH = 44;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    ctx.drawImage(logo, textLeft, headerY, logoW, logoH);
    textLeft += logoW + 16;
  }

  // Company Name
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 26px sans-serif";
  ctx.textBaseline = "middle";
  // maxWidth keeps long names clear of the badge
  ctx.fillText(ORG_NAME.toUpperCase(), textLeft, headerY + 22, width - pad - 24 - 160 - 16 - textLeft);

  // Badge "CECS ASSET"
  const badgeW = 160;
  const badgeH = 38;
  const badgeX = width - pad - 24 - badgeW;
  const badgeY = headerY + 4;
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("CECS ASSET", badgeX + badgeW / 2, badgeY + badgeH / 2);

  // Header Divider
  const headerDividerY = headerY + 62;
  ctx.beginPath();
  ctx.moveTo(pad + 16, headerDividerY);
  ctx.lineTo(width - pad - 16, headerDividerY);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#0f172a";
  ctx.stroke();

  // Body: QR Code Container
  const qrBoxX = pad + 24;
  const qrBoxY = headerDividerY + 28;
  const qrSize = 340;

  // QR box border
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.roundRect(qrBoxX, qrBoxY, qrSize, qrSize, 12);
  ctx.stroke();

  if (qr.complete && qr.naturalWidth > 0) {
    ctx.drawImage(qr, qrBoxX + 10, qrBoxY + 10, qrSize - 20, qrSize - 20);
  }

  // Body: Info
  const infoX = qrBoxX + qrSize + 36;
  const maxInfoW = width - infoX - pad - 24;
  ctx.textAlign = "left";

  // Equipment Code
  ctx.fillStyle = "#020617";
  ctx.font = "900 52px monospace";
  ctx.textBaseline = "top";
  ctx.fillText(eq.code, infoX, qrBoxY + 12);

  // Equipment Name (wrap text)
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 28px sans-serif";
  wrapText(ctx, eq.name, infoX, qrBoxY + 84, maxInfoW, 36, 2);

  // Model, S/N & Category
  let curY = qrBoxY + 175;
  if (eq.model) {
    ctx.font = "600 22px sans-serif";
    ctx.fillStyle = "#334155";
    ctx.fillText(`Tipe: ${eq.model}`, infoX, curY);
    curY += 34;
  }

  if (eq.serialNumber) {
    ctx.font = "600 20px monospace";
    ctx.fillStyle = "#64748b";
    ctx.fillText(`S/N: ${eq.serialNumber}`, infoX, curY);
    curY += 34;
  }

  if (eq.category) {
    ctx.font = "500 20px sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Kategori: ${eq.category}`, infoX, curY);
    curY += 34;
  }

  // Footer Divider
  const footerDividerY = height - pad - 64;
  ctx.beginPath();
  ctx.moveTo(pad + 16, footerDividerY);
  ctx.lineTo(width - pad - 16, footerDividerY);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#cbd5e1";
  ctx.stroke();

  // Footer text
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#64748b";
  ctx.font = "600 18px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Pindai: Pakai Unit / Perbaikan WO / Info", pad + 24, footerDividerY + 32);

  ctx.fillStyle = "#334155";
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "right";
  ctx.fillText(eq.code, width - pad - 24, footerDividerY + 32);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 1.0);
  });
}

export function EquipmentQrClient({
  initialEquipment,
  selectedId,
  defaultBaseUrl,
}: EquipmentQrClientProps) {
  const [filterId, setFilterId] = React.useState<string>(selectedId || "ALL");
  const [baseUrl, setBaseUrl] = React.useState<string>(
    defaultBaseUrl || "http://localhost:3000"
  );
  const [qrCodes, setQrCodes] = React.useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = React.useState(false);

  // Generate QR Codes whenever equipment list or baseUrl changes
  React.useEffect(() => {
    const cleanBaseUrl = baseUrl.trim().replace(/\/$/, "");
    const generateAll = async () => {
      const map: Record<string, string> = {};
      for (const eq of initialEquipment) {
        const url = `${cleanBaseUrl}/equipment/${eq.id}`;
        try {
          const qr = await QRCode.toDataURL(url, {
            width: 350,
            margin: 1,
            color: {
              dark: "#0f172a",
              light: "#ffffff",
            },
          });
          map[eq.id] = qr;
        } catch (e) {
          console.error("Failed to generate QR for", eq.code, e);
        }
      }
      setQrCodes(map);
    };

    generateAll();
  }, [initialEquipment, baseUrl]);

  const displayedList =
    filterId === "ALL"
      ? initialEquipment
      : initialEquipment.filter((eq) => eq.id === filterId);

  const handleDownloadSingle = async (eq: EquipmentQrItem) => {
    const qrImage = qrCodes[eq.id];
    if (!qrImage) {
      toast.error("QR Code belum selesai dibuat");
      return;
    }

    try {
      setDownloadingId(eq.id);
      const blob = await generateLabelImageBlob(eq, qrImage);
      if (!blob) throw new Error("Gagal membuat gambar");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Label-QR-${eq.code}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Label ${eq.code} berhasil diunduh sebagai gambar`);
    } catch (e) {
      console.error(e);
      toast.error("Gagal mengunduh label sebagai gambar");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCopyImage = async (eq: EquipmentQrItem) => {
    const qrImage = qrCodes[eq.id];
    if (!qrImage) {
      toast.error("QR Code belum selesai dibuat");
      return;
    }

    try {
      setCopiedId(eq.id);
      const blob = await generateLabelImageBlob(eq, qrImage);
      if (!blob) throw new Error("Gagal membuat gambar");

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob,
          }),
        ]);
        toast.success(`Gambar label ${eq.code} berhasil disalin ke clipboard! Siap di-paste ke WhatsApp/chat.`);
      } else {
        // Fallback: download if clipboard item is not supported
        handleDownloadSingle(eq);
      }
    } catch (e) {
      console.error(e);
      toast.error("Gagal menyalin gambar ke clipboard");
    } finally {
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const handleDownloadAll = async () => {
    if (displayedList.length === 0) return;
    setIsDownloadingAll(true);
    toast.info(`Memproses ${displayedList.length} label gambar...`);

    try {
      for (let i = 0; i < displayedList.length; i++) {
        const eq = displayedList[i];
        const qrImage = qrCodes[eq.id];
        if (!qrImage) continue;

        const blob = await generateLabelImageBlob(eq, qrImage);
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Label-QR-${eq.code}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        // Small delay between downloads to prevent browser throttling
        if (i < displayedList.length - 1) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
      toast.success(`${displayedList.length} label gambar berhasil diunduh`);
    } catch (e) {
      console.error(e);
      toast.error("Gagal mengunduh beberapa label");
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Screen Toolbar (hidden in print) */}
      <div className="flex flex-col gap-4 print:hidden bg-card border rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/equipment">
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-condensed text-3xl font-bold leading-tight tracking-tight">Label QR</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-52">
              <Select value={filterId} onValueChange={setFilterId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Pilih Unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Unit ({initialEquipment.length})</SelectItem>
                  {initialEquipment.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.code} - {eq.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleDownloadAll}
              disabled={isDownloadingAll || displayedList.length === 0}
              variant="outline"
              className="gap-2 h-10 shadow-sm font-semibold border-primary/30 text-primary hover:bg-primary/5"
            >
              <Download className="h-4 w-4" />
              {isDownloadingAll
                ? "Mengunduh..."
                : `Unduh Gambar (${displayedList.length})`}
            </Button>

            <Button
              onClick={handlePrint}
              className="gap-2 h-10 shadow-sm bg-primary text-primary-foreground font-semibold"
            >
              <Printer className="h-4 w-4" />
              Cetak Kertas
            </Button>
          </div>
        </div>

        {/* IP Target Configuration */}
        <div className="pt-3 border-t flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
          <div className="font-semibold text-foreground flex items-center gap-1.5 shrink-0">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Target Host / IP Address QR:
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:3000"
              className="h-8 px-2.5 text-xs font-mono rounded border bg-background text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {defaultBaseUrl && baseUrl !== defaultBaseUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBaseUrl(defaultBaseUrl)}
                className="h-8 text-xs shrink-0"
              >
                Reset IP
              </Button>
            )}
          </div>
          <span className="text-muted-foreground">
            Semua QR code otomatis di-generate mengarah ke IP ini agar smartphone di lapangan bisa langsung membukanya.
          </span>
        </div>
      </div>

      {/* Label Sheet Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
        {displayedList.length === 0 ? (
          <Card className="col-span-full border-dashed print:hidden">
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              <QrCode className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Belum ada unit yang terdaftar untuk dicetak label QR-nya.
            </CardContent>
          </Card>
        ) : (
          displayedList.map((eq) => {
            const qrImage = qrCodes[eq.id];
            const isCopying = copiedId === eq.id;
            const isDownloading = downloadingId === eq.id;

            return (
              <div
                key={eq.id}
                className="group relative flex flex-col bg-white text-slate-900 border-2 border-slate-900 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md break-inside-avoid print:shadow-none print:border-black"
              >
                {/* Main Card Content */}
                <div className="p-4 flex flex-col justify-between flex-1" style={{ minHeight: "220px" }}>
                  {/* Brand Header */}
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/logo.png"
                        alt={ORG_NAME}
                        className="h-5 w-auto object-contain"
                      />
                      <span className="font-extrabold text-xs tracking-wider uppercase">
                        {ORG_NAME}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold tracking-tight bg-slate-900 text-white px-1.5 py-0.5 rounded">
                      CECS ASSET
                    </span>
                  </div>

                  {/* Body with QR and Info */}
                  <div className="flex items-center gap-3">
                    <div className="w-28 h-28 shrink-0 bg-white border border-slate-200 rounded flex items-center justify-center p-1">
                      {qrImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={qrImage}
                          alt={`QR ${eq.code}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="text-[10px] text-slate-400">Loading...</div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="font-mono text-xl font-black text-slate-950 tracking-tight leading-none">
                        {eq.code}
                      </div>
                      <div className="font-bold text-xs leading-tight line-clamp-2 text-slate-900">
                        {eq.name}
                      </div>
                      <div className="text-[10px] text-slate-700">
                        {eq.model ? `Tipe: ${eq.model}` : ""}
                      </div>
                      {eq.serialNumber && (
                        <div className="text-[10px] font-mono text-slate-600 truncate">
                          S/N: {eq.serialNumber}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer instructions */}
                  <div className="border-t border-slate-300 pt-1.5 mt-2 flex items-center justify-between text-[9px] text-slate-500 font-medium">
                    <span>Pindai: Pakai Unit / Perbaikan WO / Info</span>
                    <span className="font-mono font-bold text-slate-700">{eq.code}</span>
                  </div>
                </div>

                {/* Quick Action Footer on Card (Hidden in Print) */}
                <div className="print:hidden border-t bg-slate-50 px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <ImageIcon className="h-3 w-3 text-slate-400" />
                    Format PNG 1000×600
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyImage(eq)}
                      className="h-7 px-2 text-xs gap-1 text-slate-700 hover:text-slate-950 hover:bg-slate-200"
                      title="Salin gambar ke clipboard untuk dipaste di WhatsApp"
                    >
                      {isCopying ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-medium">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Salin</span>
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadSingle(eq)}
                      disabled={isDownloading}
                      className="h-7 px-2.5 text-xs gap-1 font-semibold text-slate-900 border-slate-300 hover:bg-white"
                    >
                      <Download className="h-3.5 w-3.5 text-slate-700" />
                      <span>{isDownloading ? "..." : "Unduh PNG"}</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

