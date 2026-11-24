# CECS — Company Equipment Control System

Web app self-hosted untuk mengelola unit teknik (alat berat, kendaraan, alat produksi bermesin), histori kerusakan, perbaikan, preventive maintenance, inspeksi, dan pemakaian spare part.

Spesifikasi lengkap ada di file berikut. Baca sebelum menulis kode:

- @docs/PRD.md — modul, field, aturan bisnis
- @docs/DATA-MODEL.md — penjelasan skema dan relasi
- @docs/UI-SPEC.md — halaman, route, komponen
- @prisma/schema.prisma — sumber kebenaran skema database

## Tech stack (jangan diganti tanpa diminta)

| Layer | Pilihan |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript strict |
| UI | Tailwind CSS + shadcn/ui + lucide-react |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Auth | Auth.js v5 (credentials provider, session JWT) |
| Form | react-hook-form + zod |
| File storage | MinIO (S3 compatible), akses lewat presigned URL |
| Excel | exceljs |
| QR | qrcode |
| Cron | API route diproteksi token, dipanggil scheduler eksternal |
| Deploy | Docker Compose (app, postgres, minio) |
| Package manager | pnpm |

## Aturan wajib

1. **Bahasa.** Kode, nama variabel, komentar, dan nama tabel dalam bahasa Inggris. Label UI yang dilihat user dalam bahasa Indonesia.
2. **Server first.** Gunakan React Server Components dan Server Actions. Buat route handler hanya untuk webhook, cron, dan export file.
3. **Validasi dua lapis.** Setiap mutasi divalidasi zod di server action, bukan hanya di form. Skema zod ditaruh di `src/lib/validations/`.
4. **Tanpa `any`.** TypeScript strict, tanpa `@ts-ignore`.
5. **Soft delete.** Semua tabel histori memakai `deletedAt`. Tidak ada hard delete kecuali oleh seed script.
6. **Status equipment tidak boleh diubah manual** lewat form. Hanya berubah lewat fungsi `syncEquipmentStatus()` yang dipanggil dari siklus Work Order.
7. **Hour meter tidak boleh mundur.** Validasi di server action, tolak jika lebih kecil dari `currentHourMeter`.
8. **Mobile first.** Setiap halaman dites pada lebar 375px lebih dulu. Form Breakdown, update Work Order, dan PM Checklist wajib nyaman di HP.
9. **Audit log** hanya untuk tabel Equipment, perubahan status WorkOrder, dan semua aksi delete. Jangan pasang di semua tabel.
10. **Timezone Asia/Jakarta.** Simpan UTC di database, tampilkan waktu lokal.
11. **Penomoran.** Equipment `CRN-001`, WO `WO-2026-000125`, Breakdown `BD-2026-000045`, Inspection `INS-2026-000012`. Generator ada di `src/lib/numbering.ts`, memakai transaksi agar tidak bentrok.
12. **Uang, harga, vendor, stok gudang, aset IT dan kantor DILARANG masuk sistem.** Pengecualian: `Equipment.supplier` boleh ada sebagai teks referensi (nama/kode) saja, tanpa tabel supplier, tanpa relasi, dan tanpa harga. Jika sebuah field terasa mengarah ke biaya atau inventaris kantor, hentikan dan tanya dulu.
13. **Tidak ada integrasi ERP.** `Part.partNumber` disiapkan sebagai kunci pencocokan bila suatu saat stok dibaca dari ERP. Jangan bangun tabel stok.

## Struktur folder

```
src/
  app/
    (auth)/login/
    (app)/
      dashboard/
      equipment/
      work-order/
      preventive/
      inspection/
      spare-part/
      report/
      admin/
    api/cron/[job]/
    api/export/[type]/
  components/ui/          # shadcn
  components/shared/
  lib/
    db.ts auth.ts numbering.ts audit.ts storage.ts
    validations/
  server/
    actions/              # server actions per domain
    services/             # logika bisnis murni, bisa diunit test
prisma/
  schema.prisma seed.ts
docs/
```

## Definition of done per fitur

- Server action punya validasi zod dan cek role
- Halaman list punya search, filter, dan pagination server side
- Form berfungsi di layar 375px
- Ada seed data agar halaman tidak kosong saat dites
- Tidak ada error TypeScript dan lint

## Yang tidak perlu dikerjakan

Jangan buat: modul biaya, cost history, vendor, purchasing, stock management, minimum stock, reorder, asset depreciation, modul aset IT atau kantor, multi tenant, i18n switcher, dark mode toggle, dan landing page publik.
