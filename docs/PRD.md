# CECS — Product Requirement

## 1. Konteks

Web internal untuk mencatat identitas unit teknik beserta seluruh riwayat hidupnya. Tujuan akhir: ketika management bertanya "crane ini lima tahun terakhir sudah diperbaiki apa saja", jawabannya cukup dengan membuka satu halaman.

Pengguna: mekanik, teknisi listrik, supervisor teknik, manager, admin IT. Perkiraan 20 sampai 50 user aktif. Mekanik mengakses dari HP di lapangan.

## 2. Scope

Di dalam scope: manajemen unit teknik, histori kerusakan, work order dan perbaikan, preventive maintenance, inspeksi berkala dan sertifikasi, pencatatan spare part terpakai, report, timeline unit.

Di luar scope dan dilarang dibuat: biaya perbaikan, cost history, anggaran, harga part, master data supplier, vendor, purchasing, stok gudang, minimum stock, reorder, nilai dan penyusutan aset, serta aset non teknik seperti IT equipment dan office asset.

Pengecualian: `Equipment.supplier` diperbolehkan sebagai teks referensi (nama atau kode supplier) tanpa harga dan tanpa relasi ke tabel apa pun.

Kriteria unit yang boleh masuk sistem: unit bermesin atau bergerak yang punya hour meter, atau yang butuh preventive maintenance dan inspeksi berkala.

## 3. Role

| Role | Ringkas |
|---|---|
| ADMIN | akses penuh termasuk user, role, master data, audit log |
| SUPERVISOR | mengelola WO, menutup WO, mengatur PM schedule, edit master part |
| TECHNICIAN | membuat breakdown, mengerjakan WO yang ditugaskan, eksekusi PM, input inspeksi |
| VIEWER | hanya membaca |

Semua role boleh membaca seluruh histori lintas departemen. Pembatasan hanya pada hak ubah.

| Modul | TECHNICIAN | SUPERVISOR | VIEWER | ADMIN |
|---|---|---|---|---|
| Equipment | View | Edit | View | Full |
| Hour Meter Log | Create | Edit | View | Full |
| Breakdown Request | Create | Edit | View | Full |
| Work Order | Edit yang ditugaskan | Full termasuk Close | View | Full |
| Preventive Maintenance | Execute | Edit schedule | View | Full |
| Inspection | Create | Edit | View | Full |
| Spare Part | View dan pakai | Edit master | View | Full |
| Report | View | View | View | Full |
| Administration | tidak ada | tidak ada | tidak ada | Full |

## 4. Modul

### 4.1 Dashboard
KPI: Total Equipment, Ready, Breakdown dan Under Repair, PM Overdue, Open Work Order.
Grafik: breakdown per bulan 12 bulan terakhir, top 10 unit dengan downtime tertinggi, availability rate per kategori.
Panel notifikasi: breakdown aktif, PM overdue, PM due soon, WO waiting part, sertifikat kedaluwarsa dalam 30 hari.

### 4.2 Equipment
List dengan search, filter kategori, filter status, dan pagination server side. Detail unit memakai tab: Overview, Repair History, Preventive Maintenance, Spare Part Usage, Inspection, Attachment, Timeline.

Aksi: create, update, soft delete, import Excel, export Excel, cetak label QR.

Aturan: field `status` tidak boleh diubah lewat form. Berubah otomatis melalui `syncEquipmentStatus(equipmentId)`.

### 4.3 Hour Meter Log
Form pendek: equipment, tanggal, hour meter, remark. Nilai baru tidak boleh lebih kecil dari `currentHourMeter`. Setiap kali tersimpan, `Equipment.currentHourMeter` diperbarui dan status PmPlan dihitung ulang.

Input hour meter juga wajib dan otomatis tercatat sebagai HourMeterLog saat: submit breakdown, close work order, eksekusi PM, dan inspeksi.

### 4.4 Breakdown Request dan Work Order
Alur: breakdown disubmit, sistem otomatis membuat Work Order bertipe CORRECTIVE, teknisi mengisi Diagnosis, lalu Repair Result dan Part Usage, kemudian supervisor menutup WO.

Status WO: OPEN, WAITING_PART, IN_PROGRESS, DONE, CLOSED. WAITING_PART opsional. Setiap perubahan status dicatat di WorkOrderStatusHistory.

Syarat close: hanya SUPERVISOR atau ADMIN, wajib ada RepairResult dengan `correctiveAction` terisi, dan minimal satu Attachment bertipe foto pada WO.

Otomatisasi status equipment:
- breakdown SUBMITTED, equipment jadi BREAKDOWN
- WO jadi IN_PROGRESS, equipment jadi UNDER_REPAIR
- WO jadi CLOSED dan tidak ada WO terbuka lain, equipment jadi READY

`downtimeMinutes` dihitung otomatis saat close, dari `breakdownRequest.reportedAt` sampai `closedAt`. Tidak ada input manual.

### 4.5 Preventive Maintenance
PmPlan per kombinasi equipment dan pmType. Basis HOUR_METER dengan `intervalHour`, atau CALENDAR dengan `intervalDays`.

Perhitungan status:
- HOUR_METER: `nextDueHour = lastDoneHour + intervalHour`. OVERDUE jika `currentHourMeter >= nextDueHour`. DUE jika sisa kurang dari 10 persen interval. Selain itu UPCOMING.
- CALENDAR: `nextDueDate = lastDoneDate + intervalDays`. OVERDUE jika hari ini melewati nextDueDate. DUE jika sisa kurang dari 7 hari.

Eksekusi PM membuat WorkOrder bertipe PREVENTIVE beserta PmExecution. Setelah PmExecution tersimpan, `lastDone` dan `nextDue` dihitung ulang.

PmChecklistTemplate dibuat per kombinasi kategori dan pmType, bukan per unit.

### 4.6 Inspection
Berdiri sendiri, tidak butuh kerusakan. Field: equipment, inspectionType, inspector, tanggal, hour meter, result, finding, recommendation, certificateNumber, validUntil, lampiran.

Aturan: result FAIL otomatis membuat BreakdownRequest dengan priority HIGH dan problem diisi dari `finding`. `validUntil` memicu notifikasi 30 hari sebelum kedaluwarsa.

### 4.7 Spare Part
Part master hanya identitas part. Tidak ada stok, harga, dan supplier. PartUsage terisi dari Work Order. Halaman part menampilkan riwayat pemakaian dan unit yang paling sering memakainya.

### 4.8 Report
Output PDF dan Excel: Equipment List dan Status, Breakdown per periode, Repair History per unit atau periode, Work Order Report, PM Compliance, Spare Part Usage, Downtime dan Availability, MTTR per unit, Inspection dan Certificate Expiry.

### 4.9 Administration
User dengan reset password oleh admin. Role dan permission. Master data: Department, Location, PmType, InspectionType. Audit log hanya untuk Equipment, perubahan status WorkOrder, dan aksi delete.

## 5. Cron job

Endpoint `POST /api/cron/[job]` diproteksi header `x-cron-token`. Dipanggil scheduler eksternal.

| Job | Jadwal | Isi |
|---|---|---|
| `recalc-pm` | tiap jam | hitung ulang status semua PmPlan aktif |
| `daily-digest` | 07:00 WIB | email ke supervisor dan manager: PM overdue, WO open lebih dari 3 hari, sertifikat kedaluwarsa dalam 30 hari |

## 6. Non fungsional

- Mobile first, target minimal lebar 375px
- Upload foto dikompres di sisi klien sebelum dikirim, maksimal 1600px sisi terpanjang
- Draft form Breakdown disimpan di localStorage sampai submit berhasil, karena jaringan di lapangan sering lemah
- Semua tabel histori memakai soft delete
- Timezone tampilan Asia/Jakarta
- Seed data minimal: 3 user tiap role, 10 equipment, 2 pm type, 2 checklist template, 20 part
