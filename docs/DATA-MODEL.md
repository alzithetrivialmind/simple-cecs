# CECS — Catatan Data Model

Skema penuh ada di `prisma/schema.prisma`. File ini menjelaskan keputusan yang tidak terlihat dari skema.

## Equipment sebagai pusat

Semua entitas menggantung pada Equipment. Tidak ada tabel Inventory, Asset, Vendor, atau Cost. Itu keputusan sengaja, bukan kelalaian.

```
EQUIPMENT
 ├── HourMeterLog
 ├── BreakdownRequest ──1:1── WorkOrder ──┬── Diagnosis
 │                                        ├── RepairResult
 │                                        ├── PartUsage ── Part
 │                                        ├── PmExecution
 │                                        └── WorkOrderStatusHistory
 ├── PmPlan ── PmExecution
 ├── Inspection
 └── Attachment (polymorphic)
```

## Kenapa Breakdown dan WorkOrder dipisah tetapi 1:1

Breakdown adalah laporan dari lapangan, WorkOrder adalah pekerjaan teknik. Keduanya punya pemilik data dan waktu yang berbeda, dan downtime dihitung dari `breakdown.reportedAt` bukan dari `workOrder.createdAt`. Menggabungkan keduanya membuat downtime selalu lebih kecil dari kenyataan.

WorkOrder juga bisa lahir tanpa breakdown, yaitu dari PM dan dari tindak lanjut inspeksi. Karena itu `breakdownRequestId` nullable.

## Kenapa Attachment polymorphic

Foto menempel pada equipment, breakdown, work order, dan inspection. Membuat empat tabel lampiran yang hampir identik akan menghasilkan empat komponen upload yang berbeda. Satu tabel dengan `entityType` dan `entityId` cukup, dengan konsekuensi tidak ada foreign key. Integritas dijaga di service layer.

## Kenapa WorkOrderStatusHistory ada

Downtime, MTTR, dan pertanyaan "kenapa WO ini menggantung dua minggu" semuanya membutuhkan jejak perpindahan status. Menyimpan hanya status terakhir membuat data itu hilang selamanya.

## Kenapa PartCompatibility terpisah

Satu part bisa cocok untuk banyak unit atau untuk seluruh kategori. Menyimpannya sebagai kolom teks di Part akan membuat pencarian "part apa saja yang cocok untuk unit tertentu" mustahil.

## Kenapa tidak ada stok

Sumber kebenaran stok adalah sistem gudang atau ERP. Dua sumber stok akan selalu berselisih dan pada akhirnya keduanya tidak dipercaya. CECS hanya mencatat pemakaian, dan pemakaian itu justru data yang dibutuhkan teknik.

## Field yang sengaja tidak ada

`purchasePrice`, `assetValue`, `depreciation`, `supplierId`, `vendorId`, `stockQty`, `minimumStock`, `unitPrice`, `totalCost`. Jika salah satu muncul dalam kode, itu bug scope.

`Equipment.supplier` diizinkan hanya sebagai teks referensi (nama/kode supplier dari data unit), bukan foreign key. Tidak ada tabel Supplier dan tidak ada harga yang menempel padanya.

`assetNumber` dipertahankan tetapi hanya sebagai teks referensi untuk pencocokan saat audit aset. Tidak ada logika di atasnya.

## Integrasi ERP di masa depan (belum dikerjakan sekarang)

CECS tidak menyimpan stok dan tidak akan pernah menyimpan stok. Kalau nanti Part perlu menampilkan stok aktual, caranya bukan menambah kolom `stockQty` di tabel `Part`, tapi menarik read only dari ERP lewat API saat halaman detail part dibuka, lalu ditampilkan tanpa disimpan di database CECS.

Supaya siap untuk itu tanpa migrasi ulang: `Part.partNumber` dibuat unique dan dipakai sebagai kunci pencocokan ke Item Code ERP. Jangan buat tabel mapping terpisah selama `partNumber` konsisten.

Arah integrasi hanya satu jalur, CECS membaca dari ERP. CECS tidak pernah menulis balik ke ERP. Kalau ada kebutuhan sebaliknya, itu tanda scope sedang melebar dan harus dibahas ulang, bukan langsung dikerjakan.

## Integritas yang dijaga di service layer

1. `HourMeterLog.hourMeter` tidak boleh lebih kecil dari `Equipment.currentHourMeter`
2. `Equipment.status` hanya ditulis oleh `syncEquipmentStatus()`
3. `WorkOrder.downtimeMinutes` hanya ditulis saat transisi ke CLOSED
4. `PmPlan.nextDue*` hanya ditulis oleh `recalcPmStatus()`
5. Satu equipment hanya boleh punya satu WorkOrder aktif bertipe CORRECTIVE dalam satu waktu. Breakdown kedua pada unit yang sama menempel ke WO yang sudah ada, bukan membuat WO baru

## Indeks yang penting

Sudah ditulis di skema. Yang paling menentukan performa halaman detail equipment adalah `WorkOrder(equipmentId, status)` dan `HourMeterLog(equipmentId, readingDate)`. Jangan dihapus saat refactor.
