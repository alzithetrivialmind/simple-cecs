# CECS — UI Spec

## Prinsip

Mobile first. Mekanik memakai HP di lapangan dengan sarung tangan dan layar terkena matahari. Target: satu breakdown bisa dilaporkan dalam waktu di bawah dua menit.

- Kontras tinggi, teks minimal 16px pada form
- Target sentuh minimal 44px
- Field wajib maksimal 5 per form, sisanya di bagian "Detail tambahan" yang bisa dilipat
- Desktop memakai tabel, mobile memakai kartu. Jangan memaksa tabel di layar kecil
- Navigasi: sidebar di desktop, bottom navigation lima item di mobile (Dashboard, Equipment, Work Order, PM, Menu)

## Route

```
/login

/dashboard

/equipment
/equipment/new
/equipment/[id]                  tab: overview | repair | pm | parts | inspection | files | timeline
/equipment/[id]/edit
/equipment/import
/equipment/qr                    cetak label massal

/hour-meter                      list log
/hour-meter/new                  form cepat

/breakdown/new                   form lapor kerusakan
/work-order
/work-order/[id]                 tab: diagnosis | repair | parts | files | history
/repair-history                  read only

/preventive                      tab: upcoming | due | overdue
/preventive/plan/[id]
/preventive/execute/[planId]
/preventive/template

/inspection
/inspection/new
/inspection/[id]

/spare-part
/spare-part/[id]

/report
/report/[type]

/admin/users
/admin/master
/admin/audit-log
```

## Halaman kunci

### Dashboard
Baris pertama: 5 kartu KPI, dua kolom di mobile.
Baris kedua: grafik breakdown per bulan (bar), grafik availability per kategori (horizontal bar).
Baris ketiga: daftar notifikasi yang bisa diklik menuju daftar terfilter.
Baris keempat: top 10 unit downtime tertinggi.

### Breakdown baru
Urutan field: Equipment (pencarian atau scan QR), Problem (textarea, autofokus), Priority (empat tombol besar, bukan dropdown), Hour Meter (numerik), Foto (kamera langsung).
Tombol submit lebar penuh dan menempel di bawah layar.
Tanggal, jam, dan pelapor diisi otomatis, tidak ditampilkan sebagai input.

### Work Order detail
Header menampilkan nomor WO, unit, status sebagai badge berwarna, dan teknisi.
Tombol aksi utama mengikuti status. Saat OPEN muncul "Mulai Kerjakan", saat IN_PROGRESS muncul "Tandai Selesai", saat DONE muncul "Tutup WO" yang hanya aktif untuk supervisor.
Tab Diagnosis dan Repair Result memakai autosave setiap 10 detik agar isian tidak hilang.

### PM Schedule
Tiga tab. Baris overdue diberi latar merah muda. Setiap baris punya tombol "Eksekusi" yang langsung membuka checklist.

### Equipment Timeline
Garis waktu vertikal, terbaru di atas. Setiap entri punya ikon dan warna per jenis: breakdown merah, repair biru, PM hijau, inspection kuning. Klik entri membuka detail sumbernya.

## Warna status

| Status | Warna |
|---|---|
| READY | hijau |
| STANDBY | abu |
| BREAKDOWN | merah |
| UNDER_REPAIR | oranye |
| SCRAPPED | abu gelap |
| OVERDUE | merah |
| DUE | oranye |
| UPCOMING | biru |

## Empty state

Setiap halaman list wajib punya empty state yang menjelaskan langkah berikutnya, bukan sekadar tulisan "Tidak ada data". Contoh pada Equipment: "Belum ada unit terdaftar. Impor dari Excel atau tambah satu per satu."
