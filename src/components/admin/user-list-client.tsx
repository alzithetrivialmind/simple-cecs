"use client";

import * as React from "react";
import { Role } from "@prisma/client";
import {
  UserPlus,
  Search,
  KeyRound,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Briefcase,
  Camera,
  UploadCloud,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  createUser,
  updateUser,
  resetUserPassword,
  toggleUserStatus,
  deleteUser,
  uploadUserPhoto,
  forceLogoutUser,
} from "@/server/actions/user";

interface UserItem {
  id: string;
  name: string;
  nik: string;
  email: string | null;
  role: Role;
  avatarUrl?: string | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  isActive: boolean;
  createdAt: Date;
}

interface DepartmentItem {
  id: string;
  name: string;
}

interface UserListClientProps {
  initialUsers: UserItem[];
  departments: DepartmentItem[];
}

export function UserListClient({
  initialUsers,
  departments,
}: UserListClientProps) {
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("ALL");

  // Create / Edit Modal State
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<UserItem | null>(null);
  const [formData, setFormData] = React.useState({
    name: "",
    nik: "",
    email: "",
    password: "",
    role: "TECHNICIAN" as Role,
    departmentId: "",
    isActive: true,
    avatarUrl: "",
  });

  const [photoUploading, setPhotoUploading] = React.useState(false);
  const [photoPreview, setPhotoPreview] = React.useState<string>("");

  // Reset Password Modal State
  const [resetModalOpen, setResetModalOpen] = React.useState(false);
  const [resetUserId, setResetUserId] = React.useState<string | null>(null);
  const [newPassword, setNewPassword] = React.useState("");

  // Force Logout Confirm State
  const [forceLogoutUser_, setForceLogoutUser_] = React.useState<UserItem | null>(null);
  const [isForceLoggingOut, setIsForceLoggingOut] = React.useState(false);

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Filtered list
  const filteredUsers = initialUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.nik.toLowerCase().includes(search.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      name: "",
      nik: "",
      email: "",
      password: "",
      role: "TECHNICIAN",
      departmentId: "",
      isActive: true,
      avatarUrl: "",
    });
    setPhotoPreview("");
    setModalOpen(true);
  };

  const handleOpenEdit = (user: UserItem) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      nik: user.nik,
      email: user.email || "",
      password: "", // password not changed on edit
      role: user.role,
      departmentId: user.departmentId || "",
      isActive: user.isActive,
      avatarUrl: user.avatarUrl || "",
    });
    setPhotoPreview(user.avatarUrl || "");
    setModalOpen(true);
  };

  const handleOpenReset = (user: UserItem) => {
    setResetUserId(user.id);
    setNewPassword("");
    setResetModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoUploading(true);
    try {
      const data = new FormData();
      data.append("file", file);
      if (editingUser?.id) {
        data.append("userId", editingUser.id);
      }

      const res = await uploadUserPhoto(data);
      if (res.success && res.url) {
        setPhotoPreview(res.url);
        setFormData((prev) => ({ ...prev, avatarUrl: res.url }));
        toast.success("Foto profil berhasil diunggah");
      } else {
        toast.error(res.error || "Gagal mengunggah foto");
      }
    } catch {
      toast.error("Terjadi kesalahan saat upload foto");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingUser) {
        const res = await updateUser({
          id: editingUser.id,
          name: formData.name,
          nik: formData.nik,
          email: formData.email,
          role: formData.role,
          departmentId: formData.departmentId || undefined,
          isActive: formData.isActive,
          avatarUrl: formData.avatarUrl || undefined,
        });
        if (res.success) {
          toast.success("Data pengguna berhasil diperbarui");
          setModalOpen(false);
        } else {
          toast.error(res.error || "Gagal memperbarui pengguna");
        }
      } else {
        if (!formData.password) {
          toast.error("Password wajib diisi untuk pengguna baru");
          setIsSubmitting(false);
          return;
        }
        const res = await createUser({
          name: formData.name,
          nik: formData.nik,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          departmentId: formData.departmentId || undefined,
          isActive: formData.isActive,
          avatarUrl: formData.avatarUrl || undefined,
        });
        if (res.success) {
          toast.success("Pengguna baru berhasil ditambahkan");
          setModalOpen(false);
        } else {
          toast.error(res.error || "Gagal membuat pengguna");
        }
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserId || !newPassword) return;

    setIsSubmitting(true);
    try {
      const res = await resetUserPassword({
        userId: resetUserId,
        newPassword,
      });
      if (res.success) {
        toast.success("Password pengguna berhasil direset");
        setResetModalOpen(false);
      } else {
        toast.error(res.error || "Gagal mereset password");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: UserItem) => {
    try {
      const res = await toggleUserStatus({
        userId: user.id,
        isActive: !user.isActive,
      });
      if (res.success) {
        toast.success(
          `Pengguna ${user.name} ${!user.isActive ? "diaktifkan" : "dinonaktifkan"}`
        );
      } else {
        toast.error(res.error || "Gagal mengubah status pengguna");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (confirm(`Apakah Anda yakin ingin menghapus pengguna "${user.name}"?`)) {
      try {
        const res = await deleteUser({ userId: user.id });
        if (res.success) {
          toast.success("Pengguna berhasil dihapus");
        } else {
          toast.error(res.error || "Gagal menghapus pengguna");
        }
      } catch {
        toast.error("Terjadi kesalahan");
      }
    }
  };

  const handleConfirmForceLogout = async () => {
    if (!forceLogoutUser_) return;
    setIsForceLoggingOut(true);
    try {
      const res = await forceLogoutUser({ userId: forceLogoutUser_.id });
      if (res.success) {
        toast.success(`Sesi ${forceLogoutUser_.name} berhasil diakhiri`);
        setForceLogoutUser_(null);
      } else {
        toast.error(res.error || "Gagal mengakhiri sesi pengguna");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setIsForceLoggingOut(false);
    }
  };

  const getRoleBadgeVariant = (role: Role) => {
    switch (role) {
      case "ADMIN":
        return "destructive";
      case "SUPERVISOR":
        return "open";
      case "TECHNICIAN":
        return "upcoming";
      case "OPERATOR":
        return "ready";
      case "VIEWER":
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-condensed text-3xl font-bold leading-tight tracking-tight">Pengguna</h1>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 h-11 min-h-[44px] shadow-sm"
        >
          <UserPlus className="h-4 w-4" />
          Tambah Pengguna
        </Button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama, NIK, atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Filter Peran" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Peran</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
              <SelectItem value="TECHNICIAN">Teknisi</SelectItem>
              <SelectItem value="OPERATOR">Operator</SelectItem>
              <SelectItem value="VIEWER">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mobile View: Cards */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Tidak ada data pengguna yang cocok.
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((u) => (
            <Card key={u.id} className="border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      src={u.avatarUrl}
                      name={u.name}
                      nik={u.nik}
                      size="md"
                    />
                    <div>
                      <div className="font-bold text-base text-foreground">
                        {u.name}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        NIK: {u.nik}
                      </div>
                    </div>
                  </div>
                  <Badge variant={getRoleBadgeVariant(u.role)}>{u.role}</Badge>
                </div>

                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>{u.department?.name || "Tanpa Departemen"}</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t text-xs">
                  <div className="flex items-center gap-1.5">
                    {u.isActive ? (
                      <span className="flex items-center text-emerald-600 font-semibold gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Aktif
                      </span>
                    ) : (
                      <span className="flex items-center text-slate-400 font-semibold gap-1">
                        <XCircle className="h-3.5 w-3.5" /> Nonaktif
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenReset(u)}
                      className="h-8 px-2 text-xs"
                      title="Reset Password"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(u)}
                      className="h-8 px-2 text-xs"
                      title="Edit Pengguna"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleStatus(u)}
                      className="h-8 px-2 text-xs"
                    >
                      {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setForceLogoutUser_(u)}
                      className="h-8 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      title="Paksa Logout"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop View: Table */}
      <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pengguna</TableHead>
              <TableHead>NIK</TableHead>
              <TableHead>Peran (Role)</TableHead>
              <TableHead>Departemen</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Tidak ada pengguna ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        src={u.avatarUrl}
                        name={u.name}
                        nik={u.nik}
                        size="sm"
                      />
                      <div>
                        <div className="font-semibold text-foreground leading-tight">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email || "-"}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{u.nik}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(u.role)}>{u.role}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {u.department?.name || "-"}
                  </TableCell>
                  <TableCell>
                    {u.isActive ? (
                      <span className="inline-flex items-center text-xs text-emerald-600 font-semibold gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs text-slate-400 font-semibold gap-1">
                        <XCircle className="h-3.5 w-3.5" /> Nonaktif
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenReset(u)}
                        className="h-8 px-2"
                        title="Reset Password"
                      >
                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(u)}
                        className="h-8 px-2"
                        title="Edit Pengguna"
                      >
                        <Edit2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setForceLogoutUser_(u)}
                        className="h-8 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        title="Paksa Logout"
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(u)}
                        className="h-8 text-xs"
                      >
                        {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(u)}
                        className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal Create / Edit User */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit Data Pengguna" : "Tambah Pengguna Baru"}
            </DialogTitle>
            <DialogDescription>
              Lengkapi formulir informasi akun karyawan di bawah ini.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveUser} className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
              <div className="w-20 h-20 rounded-full border border-dashed flex items-center justify-center bg-muted/40 overflow-hidden relative shrink-0">
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPreview}
                    alt="Preview avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="h-6 w-6 text-muted-foreground" />
                )}
              </div>

              <div className="space-y-1.5 text-center sm:text-left flex-1">
                <input
                  type="file"
                  id="userPhotoInput"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={photoUploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("userPhotoInput")?.click()}
                  disabled={photoUploading}
                  className="gap-2"
                >
                  {photoUploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Mengunggah...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-3.5 w-3.5" />
                      Pilih Foto Profil
                    </>
                  )}
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Format JPG, PNG, atau WebP. Maksimal 2MB.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="userName">Nama Lengkap *</Label>
              <Input
                id="userName"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                placeholder="Contoh: Nama Lengkap"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="userNik">NIK (Nomor Induk Karyawan) *</Label>
              <Input
                id="userNik"
                value={formData.nik}
                onChange={(e) =>
                  setFormData({ ...formData, nik: e.target.value.toUpperCase() })
                }
                required
                placeholder="Contoh: TECH001"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="userEmail">Email (Opsional)</Label>
              <Input
                id="userEmail"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="nama@example.com"
              />
            </div>

            {!editingUser && (
              <div className="space-y-1.5">
                <Label htmlFor="userPass">Password Awal *</Label>
                <Input
                  id="userPass"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  placeholder="Minimal 8 karakter, huruf besar, dan angka"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="userRole">Peran (Role) *</Label>
              <Select
                value={formData.role}
                onValueChange={(val) =>
                  setFormData({ ...formData, role: val as Role })
                }
              >
                <SelectTrigger id="userRole">
                  <SelectValue placeholder="Pilih Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">ADMIN (Akses Penuh)</SelectItem>
                  <SelectItem value="SUPERVISOR">SUPERVISOR</SelectItem>
                  <SelectItem value="TECHNICIAN">TECHNICIAN (Mekanik/Teknisi)</SelectItem>
                  <SelectItem value="OPERATOR">OPERATOR (Operator Alat/Armada)</SelectItem>
                  <SelectItem value="VIEWER">VIEWER (Hanya Lihat)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="userDept">Departemen</Label>
              <Select
                value={formData.departmentId || "NONE"}
                onValueChange={(val) =>
                  setFormData({
                    ...formData,
                    departmentId: val === "NONE" ? "" : val,
                  })
                }
              >
                <SelectTrigger id="userDept">
                  <SelectValue placeholder="Pilih Departemen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Tanpa Departemen</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : editingUser ? (
                  "Simpan Perubahan"
                ) : (
                  "Tambah Pengguna"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Reset Password */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password Pengguna</DialogTitle>
            <DialogDescription>
              Masukkan password baru untuk akun pengguna ini.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveResetPassword} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="newPass">Password Baru *</Label>
              <Input
                id="newPass"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Minimal 8 karakter, huruf besar, dan angka"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetModalOpen(false)}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mereset...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Force Logout Dialog */}
      <Dialog
        open={!!forceLogoutUser_}
        onOpenChange={(open) => { if (!open) setForceLogoutUser_(null); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <LogOut className="h-5 w-5" />
              Paksa Logout Pengguna
            </DialogTitle>
            <DialogDescription>
              Sesi aktif{" "}
              <span className="font-semibold text-foreground">
                {forceLogoutUser_?.name}
              </span>{" "}
              akan diakhiri dalam ~5 menit. Pengguna harus login ulang.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setForceLogoutUser_(null)}
              disabled={isForceLoggingOut}
            >
              Batal
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleConfirmForceLogout}
              disabled={isForceLoggingOut}
            >
              {isForceLoggingOut ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses...</>
              ) : (
                "Ya, Akhiri Sesi"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
