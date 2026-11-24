"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { uploadBase64Image } from "@/server/actions/upload";
import {
  Camera,
  RefreshCw,
  Check,
  RotateCcw,
  Smartphone,
  ImageIcon,
} from "lucide-react";
import Image from "next/image";

interface PhotoCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (url: string, fileKey?: string) => void;
  title?: string;
  description?: string;
  folder?: "equipment" | "avatars" | "work-orders" | "inspections" | "breakdowns" | "general";
}

/**
 * Client-side canvas image resizing and compression
 * Ensures mobile/iPhone camera photos (10-25MB) are resized to ~300KB before upload
 */
async function resizeImageFile(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Gagal memuat gambar dari perangkat."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Gagal membaca berkas gambar."));
    reader.readAsDataURL(file);
  });
}

export function PhotoCaptureDialog({
  open,
  onOpenChange,
  onSuccess,
  title = "Ambil atau Pilih Foto",
  description = "Gunakan kamera bawaan HP Anda atau pilih foto dari galeri.",
  folder = "general",
}: PhotoCaptureDialogProps) {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);

  const nativeCameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const galleryInputRef = React.useRef<HTMLInputElement | null>(null);

  // Handle local file selection with auto client-side resize & compression
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const resized = await resizeImageFile(file, 1600, 1600, 0.82);
      setPreviewUrl(resized);
    } catch (err) {
      console.warn("Client resize failed:", err);
      // The resize path re-encodes to JPEG, which is what the server accepts.
      // If the browser cannot decode the image (e.g. HEIC on desktop), the raw
      // bytes would be rejected on upload — say so here instead of letting the
      // user fill in a form and fail at the end.
      alert(
        "Format foto ini tidak dapat diproses di perangkat Anda. " +
          "Gunakan kamera langsung, atau pilih foto berformat JPG/PNG/WEBP."
      );
      setPreviewUrl(null);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = "";
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset captured preview
  const handleRetake = () => {
    setPreviewUrl(null);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = "";
    // Automatically re-trigger native camera
    nativeCameraInputRef.current?.click();
  };

  // Confirm and upload
  const handleConfirmUpload = async () => {
    if (!previewUrl) return;

    setIsUploading(true);
    try {
      const res = await uploadBase64Image(previewUrl, folder);
      if (res.success && res.url) {
        onSuccess(res.url, res.fileKey);
        handleClose();
      } else {
        alert(res.error || "Gagal mengunggah foto.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses foto.";
      alert(`Gagal memproses foto: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setPreviewUrl(null);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = "";
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? handleClose() : onOpenChange(v))}>
      <DialogContent className="max-w-md p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Camera className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* Hidden File Inputs */}
        {/* 1. Direct Native Camera Input */}
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        {/* 2. Gallery / Document Picker */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* State 1: Processing image compression */}
        {isProcessing && (
          <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-7 w-7 animate-spin text-primary" />
            <span>Mengoptimalkan foto dari kamera HP...</span>
          </div>
        )}

        {/* State 2: Preview Mode */}
        {!isProcessing && previewUrl && (
          <div className="space-y-4 pt-1">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black shadow-inner">
              <Image
                src={previewUrl}
                alt="Pratinjau Foto Kamera HP"
                fill
                className="object-contain"
                unoptimized
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleRetake}
                disabled={isUploading}
                className="flex-1 gap-2 text-xs h-10"
              >
                <RotateCcw className="h-4 w-4" />
                Ambil Ulang
              </Button>
              <Button
                type="button"
                onClick={handleConfirmUpload}
                disabled={isUploading}
                className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-white font-semibold text-xs h-10"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Gunakan Foto Ini
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* State 3: Choice Mode (Direct Native Camera vs Gallery) */}
        {!isProcessing && !previewUrl && (
          <div className="space-y-3 pt-2">
            {/* Primary Action: Open Native Camera */}
            <button
              type="button"
              onClick={() => nativeCameraInputRef.current?.click()}
              className="w-full p-4 rounded-xl border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary text-left transition-all flex items-center gap-4 group"
            >
              <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <Smartphone className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground">
                  Buka Kamera HP Bawaan
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Langsung membuka aplikasi kamera bawaan HP untuk jepret foto panel meteran atau unit.
                </div>
              </div>
            </button>

            {/* Secondary Action: Select from Gallery */}
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="w-full p-4 rounded-xl border border-border bg-card hover:bg-muted/40 text-left transition-all flex items-center gap-4 group"
            >
              <div className="h-12 w-12 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0 group-hover:text-foreground transition-colors">
                <ImageIcon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  Pilih dari Galeri Foto
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Pilih berkas foto yang sudah pernah Anda ambil sebelumnya di HP / Laptop.
                </div>
              </div>
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
