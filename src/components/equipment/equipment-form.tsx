"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { EquipmentCategory, Ownership } from "@prisma/client";
import {
  Truck,
  Camera,
  UploadCloud,
  Loader2,
  ArrowLeft,
  Settings,
  Image as ImageIcon,
  Gauge,
  Droplets,
  NotebookPen,
} from "lucide-react";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { createEquipment, updateEquipment, uploadEquipmentPhoto } from "@/server/actions/equipment";
import Link from "next/link";

interface DepartmentItem {
  id: string;
  name: string;
}

interface LocationItem {
  id: string;
  name: string;
}

interface EquipmentFormProps {
  initialData?: {
    id?: string;
    code?: string;
    name: string;
    category: EquipmentCategory;
    ownership: Ownership;
    assetNumber?: string | null;
    supplier?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    yearOfManufacture?: number | null;
    inServiceDate?: Date | null;
    engineModel?: string | null;
    engineSerialNumber?: string | null;
    transmission?: string | null;
    capacity?: string | null;
    operatingWeight?: string | null;
    fuelType?: string | null;
    engineManufacturer?: string | null;
    enginePower?: string | null;
    maxTorque?: string | null;
    cylinderCount?: string | null;
    engineDisplacement?: string | null;
    hydraulicSystem?: string | null;
    maxTravelSpeed?: string | null;
    gradeability?: string | null;
    turningRadius?: string | null;
    dimensions?: string | null;
    engineOilCapacity?: number | null;
    transmissionOilCapacity?: number | null;
    hydraulicOilCapacity?: number | null;
    fuelTankCapacity?: number | null;
    notes?: string | null;
    locationId?: string | null;
    departmentId?: string | null;
    currentHourMeter?: number;
    photoUrl?: string | null;
  };
  departments: DepartmentItem[];
  locations: LocationItem[];
  isEdit?: boolean;
}

type TextSpecKey =
  | "engineManufacturer"
  | "enginePower"
  | "maxTorque"
  | "cylinderCount"
  | "engineDisplacement"
  | "transmission"
  | "hydraulicSystem"
  | "maxTravelSpeed"
  | "gradeability"
  | "turningRadius"
  | "dimensions";

const TEXT_SPEC_FIELDS: { key: TextSpecKey; label: string; placeholder: string }[] = [
  { key: "engineManufacturer", label: "Pabrikan Mesin", placeholder: "Contoh: Hino, Cummins, Isuzu" },
  { key: "enginePower", label: "Daya Mesin", placeholder: "Contoh: 100 kW / 2000 rpm" },
  { key: "maxTorque", label: "Torsi Maksimum", placeholder: "Contoh: 1000 N.m @ 1500 rpm" },
  { key: "cylinderCount", label: "Jumlah Silinder", placeholder: "Contoh: 6 silinder" },
  { key: "engineDisplacement", label: "Volume Silinder / Kapasitas Mesin", placeholder: "Contoh: 8.000 cc" },
  { key: "transmission", label: "Tipe Transmisi", placeholder: "Contoh: Automatic Powershift" },
  { key: "hydraulicSystem", label: "Sistem Hidrolik", placeholder: "Contoh: Pompa piston variable displacement" },
  { key: "maxTravelSpeed", label: "Kecepatan Tempuh Maks", placeholder: "Contoh: 40 km/jam" },
  { key: "gradeability", label: "Kemampuan Menanjak", placeholder: "Contoh: 30° / 58%" },
  { key: "turningRadius", label: "Radius Putar Minimum", placeholder: "Contoh: 7.000 mm" },
  { key: "dimensions", label: "Dimensi (P x L x T)", placeholder: "Contoh: 9000 x 3000 x 3000 mm" },
];

type CapacityKey =
  | "engineOilCapacity"
  | "transmissionOilCapacity"
  | "hydraulicOilCapacity"
  | "fuelTankCapacity";

const CAPACITY_FIELDS: { key: CapacityKey; label: string; placeholder: string }[] = [
  { key: "engineOilCapacity", label: "Kapasitas Oli Mesin", placeholder: "Contoh: 25,5" },
  { key: "transmissionOilCapacity", label: "Kapasitas Oli Transmisi", placeholder: "Contoh: 40" },
  { key: "hydraulicOilCapacity", label: "Kapasitas Oli Hidrolik", placeholder: "Contoh: 300" },
  { key: "fuelTankCapacity", label: "Kapasitas Tangki Bahan Bakar", placeholder: "Contoh: 350" },
];

const NOTES_PLACEHOLDER = [
  "Contoh spesifikasi wire rope:",
  "Front Drum: U3 x SeS (48), diameter 28 mm, panjang 390 m, BS 674 kN, P/N HR25W283900X",
  "Boom Hoist Drum: IWRC 6 x P.WS (31), diameter 22 mm, panjang 280 m, BS 397 kN",
].join("\n");

function litersToInput(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v).replace(".", ",");
}

function inputToLiters(v: string): number | null {
  const cleaned = v.trim().replace(",", ".");
  return cleaned === "" ? null : Number(cleaned);
}

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  HEAVY_EQUIPMENT: "Alat Berat (Crane, Forklift, Excavator)",
  VEHICLE: "Kendaraan (Dump Truck, Pick Up, Truk Tangki)",
  GENERATOR: "Genset (Generator Listrik)",
  COMPRESSOR: "Kompresor (Air Compressor)",
  PUMP: "Pompa (Dewatering, Transfer Pump)",
  WELDING_MACHINE: "Mesin Las (Engine Driven Welder)",
  OTHER_POWERED_EQUIPMENT: "Peralatan Bermesin Lainnya",
};

export function EquipmentForm({
  initialData,
  departments,
  locations,
  isEdit = false,
}: EquipmentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [photoUploading, setPhotoUploading] = React.useState(false);
  const [photoPreview, setPhotoPreview] = React.useState<string>(
    initialData?.photoUrl || ""
  );

  const [formData, setFormData] = React.useState({
    code: initialData?.code || "",
    name: initialData?.name || "",
    category: initialData?.category || EquipmentCategory.HEAVY_EQUIPMENT,
    ownership: initialData?.ownership || Ownership.OWNED,
    assetNumber: initialData?.assetNumber || "",
    manufacturer: initialData?.manufacturer || "",
    model: initialData?.model || "",
    serialNumber: initialData?.serialNumber || "",
    yearOfManufacture: initialData?.yearOfManufacture
      ? String(initialData.yearOfManufacture)
      : "",
    inServiceDate: initialData?.inServiceDate
      ? new Date(initialData.inServiceDate).toISOString().split("T")[0]
      : "",
    engineModel: initialData?.engineModel || "",
    engineSerialNumber: initialData?.engineSerialNumber || "",
    transmission: initialData?.transmission || "",
    capacity: initialData?.capacity || "",
    operatingWeight: initialData?.operatingWeight || "",
    fuelType: initialData?.fuelType || "",
    supplier: initialData?.supplier || "",
    engineManufacturer: initialData?.engineManufacturer || "",
    enginePower: initialData?.enginePower || "",
    maxTorque: initialData?.maxTorque || "",
    cylinderCount: initialData?.cylinderCount || "",
    engineDisplacement: initialData?.engineDisplacement || "",
    hydraulicSystem: initialData?.hydraulicSystem || "",
    maxTravelSpeed: initialData?.maxTravelSpeed || "",
    gradeability: initialData?.gradeability || "",
    turningRadius: initialData?.turningRadius || "",
    dimensions: initialData?.dimensions || "",
    engineOilCapacity: litersToInput(initialData?.engineOilCapacity),
    transmissionOilCapacity: litersToInput(initialData?.transmissionOilCapacity),
    hydraulicOilCapacity: litersToInput(initialData?.hydraulicOilCapacity),
    fuelTankCapacity: litersToInput(initialData?.fuelTankCapacity),
    notes: initialData?.notes || "",
    locationId: initialData?.locationId || "",
    departmentId: initialData?.departmentId || "",
    currentHourMeter: initialData?.currentHourMeter || 0,
    photoUrl: initialData?.photoUrl || "",
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoUploading(true);
    try {
      const data = new FormData();
      data.append("file", file);
      if (initialData?.id) {
        data.append("equipmentId", initialData.id);
      }

      const res = await uploadEquipmentPhoto(data);
      if (res.success && res.url) {
        setPhotoPreview(res.url);
        setFormData((prev) => ({ ...prev, photoUrl: res.url }));
        toast.success("Foto unit berhasil diunggah");
      } else {
        toast.error(res.error || "Gagal mengunggah foto");
      }
    } catch {
      toast.error("Terjadi kesalahan saat upload foto");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        code: formData.code.trim() || undefined,
        name: formData.name.trim(),
        category: formData.category,
        ownership: formData.ownership,
        assetNumber: formData.assetNumber.trim() || undefined,
        manufacturer: formData.manufacturer.trim() || undefined,
        model: formData.model.trim() || undefined,
        serialNumber: formData.serialNumber.trim() || undefined,
        yearOfManufacture: formData.yearOfManufacture
          ? parseInt(formData.yearOfManufacture, 10)
          : undefined,
        inServiceDate: formData.inServiceDate || undefined,
        engineModel: formData.engineModel.trim() || undefined,
        engineSerialNumber: formData.engineSerialNumber.trim() || undefined,
        transmission: formData.transmission.trim() || undefined,
        capacity: formData.capacity.trim() || undefined,
        operatingWeight: formData.operatingWeight.trim() || undefined,
        fuelType: formData.fuelType.trim() || undefined,
        supplier: formData.supplier.trim() || undefined,
        engineManufacturer: formData.engineManufacturer.trim() || undefined,
        enginePower: formData.enginePower.trim() || undefined,
        maxTorque: formData.maxTorque.trim() || undefined,
        cylinderCount: formData.cylinderCount.trim() || undefined,
        engineDisplacement: formData.engineDisplacement.trim() || undefined,
        hydraulicSystem: formData.hydraulicSystem.trim() || undefined,
        maxTravelSpeed: formData.maxTravelSpeed.trim() || undefined,
        gradeability: formData.gradeability.trim() || undefined,
        turningRadius: formData.turningRadius.trim() || undefined,
        dimensions: formData.dimensions.trim() || undefined,
        engineOilCapacity: inputToLiters(formData.engineOilCapacity),
        transmissionOilCapacity: inputToLiters(formData.transmissionOilCapacity),
        hydraulicOilCapacity: inputToLiters(formData.hydraulicOilCapacity),
        fuelTankCapacity: inputToLiters(formData.fuelTankCapacity),
        notes: formData.notes.trim() || undefined,
        locationId: formData.locationId || undefined,
        departmentId: formData.departmentId || undefined,
        currentHourMeter: formData.currentHourMeter || 0,
        photoUrl: formData.photoUrl || undefined,
      };

      if (isEdit && initialData?.id) {
        const res = await updateEquipment({
          id: initialData.id,
          ...payload,
        });

        if (res.success) {
          toast.success("Data unit berhasil diperbarui");
          router.push(`/equipment/${initialData.id}`);
        } else {
          toast.error(res.error || "Gagal memperbarui unit");
        }
      } else {
        const res = await createEquipment(payload);
        if (res.success && res.equipment) {
          toast.success("Unit baru berhasil didaftarkan");
          router.push(`/equipment/${res.equipment.id}`);
        } else {
          toast.error(res.error || "Gagal mendaftarkan unit");
        }
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Header with Back Button */}
      <div className="flex items-center gap-3">
        <Link href={isEdit && initialData?.id ? `/equipment/${initialData.id}` : "/equipment"}>
          <Button variant="ghost" size="icon" type="button" className="h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="font-condensed text-3xl font-bold leading-tight tracking-tight">
            {isEdit ? `Edit ${initialData?.code}` : "Tambah unit"}
          </h1>
        </div>
      </div>

      {/* 1. Main Core Identitas Unit (Wajib) */}
      <Card>
        <CardHeader className="p-4 md:p-6 pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Informasi Utama Unit
          </CardTitle>
          <CardDescription className="text-xs">
            Field wajib diisi untuk registrasi unit.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="eqCode">
                Kode Unit (Opsional, otomatis digenerate jika kosong)
              </Label>
              <Input
                id="eqCode"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
                placeholder="Contoh: CRN-001 / FLT-002"
                disabled={isEdit}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="eqName">Nama Unit *</Label>
              <Input
                id="eqName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Contoh: Crawler Crane 50T"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="eqCategory">Kategori Unit *</Label>
              <Select
                value={formData.category}
                onValueChange={(val) =>
                  setFormData({ ...formData, category: val as EquipmentCategory })
                }
              >
                <SelectTrigger id="eqCategory">
                  <SelectValue placeholder="Pilih Kategori" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="eqOwnership">Status Kepemilikan *</Label>
              <Select
                value={formData.ownership}
                onValueChange={(val) =>
                  setFormData({ ...formData, ownership: val as Ownership })
                }
              >
                <SelectTrigger id="eqOwnership">
                  <SelectValue placeholder="Pilih Kepemilikan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNED">Milik Perusahaan (OWNED)</SelectItem>
                  <SelectItem value="RENTAL">Sewa / Rental (RENTAL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="eqDept">Departemen Penanggung Jawab</Label>
              <Select
                value={formData.departmentId || "NONE"}
                onValueChange={(val) =>
                  setFormData({
                    ...formData,
                    departmentId: val === "NONE" ? "" : val,
                  })
                }
              >
                <SelectTrigger id="eqDept">
                  <SelectValue placeholder="Pilih Departemen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Tanpa Departemen</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="eqLoc">Lokasi</Label>
              <Select
                value={formData.locationId || "NONE"}
                onValueChange={(val) =>
                  setFormData({
                    ...formData,
                    locationId: val === "NONE" ? "" : val,
                  })
                }
              >
                <SelectTrigger id="eqLoc">
                  <SelectValue placeholder="Pilih Lokasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Tanpa Lokasi Tetap</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="eqHM">Hour Meter Saat Pendaftaran (Jam)</Label>
              <Input
                id="eqHM"
                type="number"
                min="0"
                value={formData.currentHourMeter}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    currentHourMeter: parseInt(e.target.value || "0", 10),
                  })
                }
                placeholder="0"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Upload Foto Unit */}
      <Card>
        <CardHeader className="p-4 md:p-6 pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Foto Profil Unit
          </CardTitle>
          <CardDescription className="text-xs">
            Unggah foto fisik unit untuk identifikasi visual cepat.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-2 space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-32 h-32 rounded-xl border border-dashed flex items-center justify-center bg-muted/40 overflow-hidden relative shrink-0">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreview}
                  alt="Preview unit"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Camera className="h-8 w-8 text-muted-foreground" />
              )}
            </div>

            <div className="space-y-2 text-center sm:text-left flex-1">
              <input
                type="file"
                id="photoInput"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={photoUploading}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("photoInput")?.click()}
                disabled={photoUploading}
                className="gap-2 h-10 min-h-[44px]"
              >
                {photoUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Mengunggah...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    Pilih / Ambil Foto
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Format JPG, PNG, atau WebP. Foto akan dikompres dan disimpan di MinIO.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Detail Spesifikasi Teknis Tambahan (Accordion) */}
      <Card>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="tech-specs" className="border-none px-4 md:px-6">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground text-left">
                <Settings className="h-5 w-5 text-primary" />
                <span>Spesifikasi Teknis Tambahan (Opsional)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="eqMfr">Merk / Pabrikan</Label>
                  <Input
                    id="eqMfr"
                    value={formData.manufacturer}
                    onChange={(e) =>
                      setFormData({ ...formData, manufacturer: e.target.value })
                    }
                    placeholder="Contoh: Komatsu, Toyota, Denyo"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="eqModel">Model / Tipe</Label>
                  <Input
                    id="eqModel"
                    value={formData.model}
                    onChange={(e) =>
                      setFormData({ ...formData, model: e.target.value })
                    }
                    placeholder="Contoh: MODEL-A"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="eqSerial">Nomor Seri (Serial Number / VIN)</Label>
                  <Input
                    id="eqSerial"
                    value={formData.serialNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, serialNumber: e.target.value })
                    }
                    placeholder="Contoh: SN-000001"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="eqAssetNo">Nomor Aset / Ref Silang</Label>
                  <Input
                    id="eqAssetNo"
                    value={formData.assetNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, assetNumber: e.target.value })
                    }
                    placeholder="Contoh: AST-0001"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="eqSupplier">Supplier (Nama / Kode)</Label>
                <Input
                  id="eqSupplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="Contoh: SUP-001 / Nama Supplier"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="eqYear">Tahun Pembuatan</Label>
                  <Input
                    id="eqYear"
                    type="number"
                    min="1950"
                    max="2100"
                    value={formData.yearOfManufacture}
                    onChange={(e) =>
                      setFormData({ ...formData, yearOfManufacture: e.target.value })
                    }
                    placeholder="Contoh: 2019"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="eqInService">Tanggal Masuk Operasi (In-Service Date)</Label>
                  <Input
                    id="eqInService"
                    type="date"
                    value={formData.inServiceDate}
                    onChange={(e) =>
                      setFormData({ ...formData, inServiceDate: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="eqEngModel">Model Mesin (Engine Model)</Label>
                  <Input
                    id="eqEngModel"
                    value={formData.engineModel}
                    onChange={(e) =>
                      setFormData({ ...formData, engineModel: e.target.value })
                    }
                    placeholder="Contoh: ENGINE-A"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="eqEngSn">Nomor Seri Mesin (Engine S/N)</Label>
                  <Input
                    id="eqEngSn"
                    value={formData.engineSerialNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        engineSerialNumber: e.target.value,
                      })
                    }
                    placeholder="Contoh: ENG-000001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="eqCapacity">Kapasitas</Label>
                  <Input
                    id="eqCapacity"
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({ ...formData, capacity: e.target.value })
                    }
                    placeholder="Contoh: 50 Ton, 150 kVA"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="eqWeight">Berat Operasi (Operating Weight)</Label>
                  <Input
                    id="eqWeight"
                    value={formData.operatingWeight}
                    onChange={(e) =>
                      setFormData({ ...formData, operatingWeight: e.target.value })
                    }
                    placeholder="Contoh: 20 Ton"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="eqFuel">Jenis Bahan Bakar</Label>
                  <Input
                    id="eqFuel"
                    value={formData.fuelType}
                    onChange={(e) =>
                      setFormData({ ...formData, fuelType: e.target.value })
                    }
                    placeholder="Contoh: Solar / Diesel"
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="engine-performance" className="border-t border-b-0 px-4 md:px-6">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground text-left">
                <Gauge className="h-5 w-5 text-primary" />
                <span>Mesin, Performa &amp; Dimensi</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {TEXT_SPEC_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={`eq-${f.key}`}>{f.label}</Label>
                    <Input
                      id={`eq-${f.key}`}
                      value={formData[f.key]}
                      onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="fluid-capacity" className="border-t border-b-0 px-4 md:px-6">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground text-left">
                <Droplets className="h-5 w-5 text-primary" />
                <span>Kapasitas Oli &amp; Bahan Bakar</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CAPACITY_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={`eq-${f.key}`}>{f.label} (Liter)</Label>
                    <div className="relative">
                      <Input
                        id={`eq-${f.key}`}
                        inputMode="decimal"
                        value={formData[f.key]}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [f.key]: e.target.value.replace(/[^0-9.,]/g, ""),
                          })
                        }
                        placeholder={f.placeholder}
                        className="pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        L
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="notes" className="border-t border-b-0 px-4 md:px-6">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground text-left">
                <NotebookPen className="h-5 w-5 text-primary" />
                <span>Catatan / Deskripsi Tambahan</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pt-2 pb-4">
              <Label htmlFor="eqNotes">Catatan Teknis</Label>
              <Textarea
                id="eqNotes"
                rows={8}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={NOTES_PLACEHOLDER}
                className="text-base font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Untuk spesifikasi wire rope (crawler crane), spesifikasi pelumas, atau data teknis lain yang tidak punya kolom sendiri.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Submit Controls */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link href={isEdit && initialData?.id ? `/equipment/${initialData.id}` : "/equipment"}>
          <Button type="button" variant="outline" disabled={isSubmitting} className="h-11 min-h-[44px]">
            Batal
          </Button>
        </Link>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 min-h-[44px] px-8 bg-primary hover:bg-primary/90 text-white font-semibold shadow-md"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menyimpan Data...
            </>
          ) : isEdit ? (
            "Simpan Perubahan"
          ) : (
            "Daftarkan Unit"
          )}
        </Button>
      </div>
    </form>
  );
}
