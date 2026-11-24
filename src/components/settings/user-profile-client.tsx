"use client";

import * as React from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { PhotoCaptureDialog } from "@/components/shared/photo-capture-dialog";
import { updateProfilePhoto, changePassword } from "@/server/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Camera,
  KeyRound,
  Building,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { formatDateIndo } from "@/lib/utils";

interface UserProfileClientProps {
  user: {
    id: string;
    name: string;
    nik: string;
    email: string | null;
    role: string;
    avatarUrl: string | null;
    createdAt: Date | string;
    department?: {
      id: string;
      name: string;
    } | null;
  };
}

export function UserProfileClient({ user }: UserProfileClientProps) {
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(user.avatarUrl);
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = React.useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const [passwordLoading, setPasswordLoading] = React.useState(false);
  const [passwordSuccess, setPasswordSuccess] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  const handlePhotoSuccess = async (url: string) => {
    setAvatarUrl(url);
    try {
      const res = await updateProfilePhoto(url);
      if (!res.success) {
        alert(res.error || "Gagal memperbarui foto profil di database.");
      }
    } catch {
      alert("Terjadi kesalahan saat menyimpan foto profil.");
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Semua kolom password wajib diisi.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password baru minimal 6 karakter.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi password baru tidak sesuai.");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (res.success) {
        setPasswordSuccess(res.message || "Password berhasil diperbarui!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordError(res.error || "Gagal memperbarui password.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setPasswordError(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-condensed text-3xl font-bold leading-tight tracking-tight">Akun saya</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Quick Info Card */}
        <Card className="md:col-span-1 shadow-sm border-border">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-base font-semibold">Foto Karyawan</CardTitle>
            <CardDescription className="text-xs">
              Foto Anda akan tampil pada riwayat inspeksi, work order, dan sistem.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center pt-2 pb-6 space-y-4">
            <div className="relative group">
              <UserAvatar
                src={avatarUrl}
                name={user.name}
                nik={user.nik}
                size="xl"
                className="h-32 w-32 ring-4 ring-primary/20 shadow-md text-3xl"
              />
              <button
                type="button"
                onClick={() => setIsPhotoDialogOpen(true)}
                title="Ganti Foto (Kamera / File)"
                className="absolute bottom-1 right-1 p-2.5 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg transition-transform hover:scale-110 cursor-pointer border-2 border-background"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPhotoDialogOpen(true)}
              className="w-full gap-2 text-xs font-semibold"
            >
              <Camera className="h-4 w-4 text-primary" />
              Ambil / Ganti Foto
            </Button>

            <div className="w-full pt-4 border-t border-border space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status Akun:</span>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  Aktif
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Role:</span>
                <Badge className="bg-primary text-white font-semibold">
                  {user.role}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Departemen:</span>
                <span className="font-semibold text-foreground truncate max-w-[150px]">
                  {user.department?.name || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Terdaftar Sejak:</span>
                <span className="font-medium text-foreground">
                  {formatDateIndo(user.createdAt)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Profile Info & Change Password */}
        <div className="md:col-span-2 space-y-6">
          {/* Info Card */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" />
                Data Karyawan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Nama Lengkap</Label>
                  <Input value={user.name} disabled className="mt-1 bg-muted/40 font-medium" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nomor Induk Karyawan (NIK)</Label>
                  <Input value={user.nik} disabled className="mt-1 bg-muted/40 font-mono font-medium" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input value={user.email || "-"} disabled className="mt-1 bg-muted/40" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Departemen</Label>
                  <Input value={user.department?.name || "-"} disabled className="mt-1 bg-muted/40 font-medium" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                Ganti Kata Sandi (Password)
              </CardTitle>
              <CardDescription className="text-xs">
                Perbarui password secara berkala untuk menjaga keamanan akun operasional Anda.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {passwordSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-600 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                {passwordError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-600 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                {/* Current Password */}
                <div>
                  <Label className="text-xs">Password Saat Ini</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showCurrent ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Masukkan kata sandi lama Anda"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <Label className="text-xs">Password Baru (Minimal 6 Karakter)</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Masukkan kata sandi baru"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <Label className="text-xs">Konfirmasi Password Baru</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ketik ulang kata sandi baru"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-white font-semibold"
                >
                  {passwordLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Menyimpan Perubahan...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Perbarui Password Sekarang
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Photo Capture Dialog (Camera / Upload) */}
      <PhotoCaptureDialog
        open={isPhotoDialogOpen}
        onOpenChange={setIsPhotoDialogOpen}
        onSuccess={handlePhotoSuccess}
        title="Foto Profil Karyawan"
        description="Ambil foto selfie/wajah Anda menggunakan kamera depan/belakang, atau pilih foto dari perangkat."
        folder="avatars"
      />
    </div>
  );
}
