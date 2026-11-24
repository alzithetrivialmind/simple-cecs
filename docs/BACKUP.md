# Backup & Pemulihan

Aplikasi bisa dibangun ulang dalam hitungan jam. Data maintenance bertahun-tahun
tidak. Ini bagian paling penting dari seluruh rangkaian pengerasan keamanan.

## Yang perlu di-backup

| Data | Tersimpan di | Kalau hilang |
|---|---|---|
| Database PostgreSQL | volume `cecs_prod_postgres_data` | Seluruh riwayat WO, PM, inspeksi, hour meter, audit |
| Lampiran MinIO | volume `cecs_prod_minio_data` | Semua foto kerusakan dan dokumen sertifikasi |
| `.env.production` | berkas di server | Kredensial — **jangan** simpan bersama backup data |

Berkas kode tidak perlu di-backup selama masih ada di git.

---

## Pemasangan

### 1. Siapkan folder

```bash
mkdir -p /var/backups/cecs
chmod 700 /var/backups/cecs
```

`chmod 700` penting — tanpa itu, backup bisa terbaca oleh pengguna lain di server.

### 2. Jadwalkan

Tambahkan ke crontab root (perlu akses `docker`):

```cron
0 2 * * * sh /opt/cecs/scripts/backup.sh
```

Pasang notifikasi saat skrip gagal. Backup yang diam-diam berhenti bekerja
adalah pola kegagalan yang paling sering terjadi.

### 3. Uji sekali secara manual

```bash
sh /opt/cecs/scripts/backup.sh
ls -lh /var/backups/cecs
```

Harus muncul `db-YYYY-MM-DD.sql.gz` dan `minio-YYYY-MM-DD.tar.gz`.

---

## Salinan luar — ini yang melindungi dari ransomware

⚠️ **Backup yang berada di server yang sama tidak melindungi dari ransomware.**
Bila server terenkripsi, folder backup ikut terenkripsi. Ini kegagalan yang paling
sering terjadi pada korban ransomware: mereka punya backup, tapi di mesin yang
sama.

Pilih salah satu:

**A. Cloud (direkomendasikan)** — salin ke penyimpanan objek seperti Backblaze B2 atau S3. Aktifkan versioning di sisi penyedia, dan gunakan kredensial yang
**hanya boleh menulis**, tidak boleh menghapus. Dengan begitu, penyerang yang
menguasai server tetap tidak bisa menghapus salinan lama.

**B. Disk eksternal berotasi** — dua HDD USB, tukar mingguan, yang tidak
dipakai disimpan **tercabut**. Disk yang tercabut kebal terhadap serangan
jaringan.

Jadwalkan setelah skrip lokal selesai, dengan retensi minimal 30 versi.

---

## Uji pemulihan — wajib bulanan

Backup yang belum pernah diuji pulih bukanlah backup; ia hanya berkas yang
kamu harapkan berguna.

```bash
sh /opt/cecs/scripts/verify-backup.sh
```

Skrip ini memulihkan dump terbaru ke PostgreSQL **sementara** yang terpisah,
memeriksa jumlah tabel dan isi tabel inti, lalu membuang container itu.
**Database produksi tidak disentuh sama sekali**, jadi aman dijalankan kapan pun.

Keluaran yang diharapkan:

```
[1/4] Memeriksa integritas gzip...   OK
[2/4] Menjalankan PostgreSQL sementara...  OK
[3/4] Memulihkan dump...  OK
[4/4] Memverifikasi isi...
  Tabel            : <jumlah>
  User: <jumlah> baris
  Equipment: <jumlah> baris
  WorkOrder: <jumlah> baris

BACKUP VALID — dump ini bisa dipulihkan.
```

Jadwalkan juga lewat cron, bulanan, dengan notifikasi saat gagal.

---

## Pemulihan sungguhan

⚠️ Menimpa data produksi.

```bash
sh /opt/cecs/scripts/restore.sh \
   /var/backups/cecs/db-YYYY-MM-DD.sql.gz \
   /var/backups/cecs/minio-YYYY-MM-DD.tar.gz
```

Skrip akan:
1. Memeriksa integritas kedua arsip **sebelum** menyentuh apa pun
2. Menghentikan `app` dan `nginx`
3. Membuat snapshot keadaan saat ini ke `/tmp` — jaring pengaman bila kamu
   memulihkan dump yang salah
4. Memulihkan database, lalu lampiran MinIO bila arsipnya diberikan
5. Menjalankan kembali aplikasi

Konfirmasi diminta dengan mengetik `PULIHKAN`.

Argumen MinIO bersifat opsional. Bila hanya database yang dipulihkan, data
tetap konsisten tetapi sebagian lampiran foto bisa menjadi tautan yang menunjuk
ke berkas yang tidak ada.

---

## Pemeriksaan berkala

| Kapan | Apa |
|---|---|
| Mingguan | Lihat `/var/backups/cecs/backup.log`, pastikan tidak ada `GAGAL` |
| Bulanan | Jalankan `verify-backup.sh` |
| Triwulan | Uji pemulihan sungguhan ke perangkat terpisah, catat berapa lama |
| Tahunan | Pastikan salinan luar benar-benar bisa diambil kembali |

Yang terakhir itu penting: banyak organisasi baru sadar salinan cloud mereka
tidak bisa diunduh justru saat sedang membutuhkannya.
