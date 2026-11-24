"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gauge, ArrowLeft, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createHourMeterLog } from "@/server/actions/hour-meter";

interface EquipmentOption {
  id: string;
  code: string;
  name: string;
  currentHourMeter: number;
}

interface HourMeterFormProps {
  equipmentList: EquipmentOption[];
  preselectedEquipmentId?: string;
}

export function HourMeterForm({
  equipmentList,
  preselectedEquipmentId,
}: HourMeterFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [selectedId, setSelectedId] = React.useState<string>(
    preselectedEquipmentId || (equipmentList[0]?.id || "")
  );

  const [hourMeterInput, setHourMeterInput] = React.useState<string>("");
  const [readingDate, setReadingDate] = React.useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [remark, setRemark] = React.useState<string>("");

  const selectedEquipment = equipmentList.find((e) => e.id === selectedId);

  // Pre-fill input with current hour meter if empty
  React.useEffect(() => {
    if (selectedEquipment && !hourMeterInput) {
      setHourMeterInput(String(selectedEquipment.currentHourMeter));
    }
  }, [selectedEquipment, hourMeterInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !hourMeterInput) {
      toast.error("Mohon pilih unit dan isi nilai hour meter");
      return;
    }

    const hmNumber = parseInt(hourMeterInput, 10);
    if (isNaN(hmNumber)) {
      toast.error("Hour meter harus berupa angka bulat");
      return;
    }

    if (selectedEquipment && hmNumber < selectedEquipment.currentHourMeter) {
      toast.error(
        `Nilai hour meter (${hmNumber} Jam) tidak boleh lebih kecil dari nilai saat ini (${selectedEquipment.currentHourMeter} Jam)`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createHourMeterLog({
        equipmentId: selectedId,
        readingDate,
        hourMeter: hmNumber,
        source: "MANUAL",
        remark: remark.trim() || undefined,
      });

      if (res.success) {
        toast.success("Catatan hour meter berhasil disimpan!");
        router.push("/hour-meter");
      } else {
        toast.error(res.error || "Gagal menyimpan log hour meter");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-12">
      <div className="flex items-center gap-3">
        <Link href="/hour-meter">
          <Button variant="ghost" size="icon" type="button" className="h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="font-condensed text-3xl font-bold leading-tight tracking-tight">Input hour meter</h1>
        </div>
      </div>

      <Card className="border-border shadow-md">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-primary">
            <Gauge className="h-5 w-5" />
            Pencatatan Hour Meter
          </CardTitle>
          <CardDescription className="text-xs">
            Pastikan pembacaan meteran sesuai fisik unit di lapangan.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Equipment Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="eqSelect">Pilih Unit Alat / Kendaraan *</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger id="eqSelect" className="h-11">
                  <SelectValue placeholder="Pilih unit..." />
                </SelectTrigger>
                <SelectContent>
                  {equipmentList.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.code} - {eq.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Current Hour Meter Reference Box */}
            {selectedEquipment && (
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-3.5 flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 dark:text-blue-200">
                  <span className="font-semibold">Hour Meter Saat Ini: </span>
                  <span className="font-mono font-bold text-sm text-blue-700 dark:text-blue-300">
                    {selectedEquipment.currentHourMeter.toLocaleString("id-ID")} Jam
                  </span>
                  <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 mt-0.5">
                    Angka baru yang dimasukkan wajib lebih besar atau sama dengan nilai ini.
                  </p>
                </div>
              </div>
            )}

            {/* New Hour Meter Input */}
            <div className="space-y-1.5">
              <Label htmlFor="hmValue">Pembacaan Hour Meter Baru (Jam) *</Label>
              <div className="relative">
                <Input
                  id="hmValue"
                  type="number"
                  min={selectedEquipment?.currentHourMeter || 0}
                  value={hourMeterInput}
                  onChange={(e) => setHourMeterInput(e.target.value)}
                  required
                  className="h-12 text-lg font-mono font-bold pr-16"
                  placeholder="0"
                />
                <span className="absolute right-3 top-3.5 text-xs text-muted-foreground font-semibold">
                  JAM
                </span>
              </div>
            </div>

            {/* Reading Date */}
            <div className="space-y-1.5">
              <Label htmlFor="readingDate">Tanggal & Waktu Pembacaan *</Label>
              <Input
                id="readingDate"
                type="date"
                value={readingDate}
                onChange={(e) => setReadingDate(e.target.value)}
                required
                className="h-11 text-base md:text-sm"
              />
            </div>

            {/* Remark */}
            <div className="space-y-1.5">
              <Label htmlFor="remark">Catatan / Kondisi Operasional (Opsional)</Label>
              <Textarea
                id="remark"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Contoh: Selesai operasi, kondisi normal..."
                rows={2}
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 min-h-[48px] bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-xl shadow-md mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan Catatan...
                </>
              ) : (
                "Simpan Pembacaan Hour Meter"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
