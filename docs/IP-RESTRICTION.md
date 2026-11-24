# Pembatasan IP untuk ADMIN & SUPERVISOR

Akun ADMIN dan SUPERVISOR hanya bisa dipakai dari jaringan kantor.
OPERATOR dan TECHNICIAN **tidak terpengaruh** — mereka tetap bisa scan QR dan
input dari mana saja, termasuk lewat data seluler di lapangan.

Alasannya: akun input hanya bisa menambah catatan, sementara akun berprivilese
bisa mengubah master data, mengelola pengguna, dan membaca seluruh laporan.
Membatasi yang kedua ke jaringan fisik kantor membuat kredensial yang bocor
jauh lebih sulit dipakai.

---

## ⚠️ Baca ini dulu — risiko mengunci diri sendiri

Kontrol ini **hanya sekuat ketepatan IP klien yang terbaca server**. Sebelum
mengaktifkannya, pastikan dulu IP apa yang sebenarnya dilihat aplikasi.

### Langkah 1 — Lihat IP yang terbaca (WAJIB)

Dengan fitur masih **nonaktif** (`ADMIN_IP_ALLOWLIST` kosong):

1. Login sebagai admin dari komputer kantor
2. Buka **Admin → Log & Audit Trail**
3. Klik entri `LOGIN` paling atas
4. Lihat baris **IP**

Yang kamu lihat di situ persis yang akan diperiksa oleh allowlist.

| Yang tampil | Artinya |
|---|---|
| `192.168.0.x` | ✅ Benar. Pakai subnet ini di allowlist |
| `172.17–172.31.x.x` | ❌ Nginx tidak meneruskan IP asli. **Jangan aktifkan** sebelum diperbaiki |
| IP publik (mis. `104.28.x.x`) | ❌ Ada proxy/CDN/VPN di jalur. Lihat di bawah |
| `tidak diketahui` | ❌ Header tidak sampai. **Jangan aktifkan** |

Kalau hasilnya bukan `192.168.0.x`, cari penyebabnya lebih dulu. Mengaktifkan
fitur dalam kondisi itu akan mengunci seluruh admin, atau — lebih buruk —
membuat kontrolnya tampak aktif padahal meloloskan semua orang.

### VPN di perangkat admin

VPN seperti Cloudflare WARP membungkus seluruh lalu lintas perangkat. Admin
yang mengaktifkannya akan terlihat datang dari IP publik penyedia VPN dan akan
terblokir, walaupun sedang berada di kantor. Matikan VPN atau kecualikan domain
CECS dari VPN.

### Kalau domain diproksi Cloudflare (awan oranye)

Bila domain CECS diproksi Cloudflare, lalu lintas tiba di
nginx dari IP edge Cloudflare, bukan dari pengunjung. Semua admin akan
terblokir.

Perbaikannya sama seperti pada Cloudflare Tunnel — tambahkan di
`nginx/nginx.conf` dalam blok `http {}`:

```nginx
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
# ... daftar lengkap: https://www.cloudflare.com/ips/
real_ip_header CF-Connecting-IP;
real_ip_recursive on;
```

Langkah ini tidak diperlukan bila server dijangkau langsung tanpa proxy Cloudflare.

---

## Mengaktifkan

Setelah Langkah 1 menunjukkan `192.168.0.x`, isi di `.env.production`:

```
ADMIN_IP_ALLOWLIST=192.168.0.0/24,127.0.0.1,::1
```

Lalu:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Format yang didukung:

| Bentuk | Contoh |
|---|---|
| CIDR IPv4 | `192.168.0.0/24` |
| Alamat tunggal | `192.168.0.50` |
| Loopback IPv6 | `::1` |

Dipisah koma. **Kosongkan untuk menonaktifkan fitur.**

### Jangan tulis `172.16.0.0/12`

Itu rentang bridge Docker. Memasukkannya berarti: bila suatu saat reverse
proxy berhenti meneruskan IP asli, **seluruh internet akan tampak lokal** dan
kontrol ini mati tanpa suara.

Aplikasi menjaga ini: alamat dari rentang tersebut ditolak dengan alasan
khusus `proxy_misconfigured`, kecuali kamu mendaftarkannya sendiri secara
eksplisit.

---

## Cara kerjanya

Ditegakkan di dua titik, keduanya di sisi server:

**1. Saat login** — di `authorize()` (`src/auth.ts`), bukan hanya di server
action. Endpoint `/api/auth/callback/credentials` bisa dipanggil langsung, jadi
pemeriksaan harus ada di titik cekik yang sebenarnya.

Pemeriksaan sengaja dilakukan **sesudah** password diverifikasi. Kalau
sebaliknya, pesan errornya menjadi orakel: penyerang dari luar bisa memetakan
NIK mana yang berperan admin tanpa perlu tahu password sama sekali.

**2. Pada setiap aksi terjaga** — di `requireAuth()` (`src/lib/auth-guard.ts`).
Jadi sesi ADMIN/SUPERVISOR yang sudah terbit pun tidak bisa dipakai dari luar
jaringan, termasuk bila cookie sesinya dicuri.

Pemeriksaan tidak diletakkan di middleware karena middleware berjalan di edge
runtime, tempat pembacaan variabel lingkungan saat runtime tidak dijamin.
Menegakkannya di kode Node runtime membuat kontrol ini tidak bergantung pada
perilaku itu.

Konsekuensinya: admin yang berpindah ke data seluler di tengah sesi akan
ditolak pada aksi berikutnya. Itu memang perilaku yang diinginkan.

### Sikap saat ragu

| Keadaan | Hasil |
|---|---|
| IP tidak bisa ditentukan | **Ditolak** (gagal-tertutup) |
| IP = alamat container | **Ditolak**, ditandai salah konfigurasi |
| Allowlist kosong | Fitur nonaktif, semua lolos |
| Entri allowlist tidak sah | Diabaikan — tidak pernah meloloskan |

---

## Kalau admin terkunci

Fitur ini tidak bisa mengunci kamu secara permanen. Dari SSH ke server:

```bash
cd /opt/cecs
# Kosongkan barisnya
sed -i 's/^ADMIN_IP_ALLOWLIST=.*/ADMIN_IP_ALLOWLIST=/' .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production up -d app
```

Fitur mati dalam beberapa detik, semua admin bisa login lagi. Perbaiki
allowlist-nya, lalu aktifkan kembali.

---

## Verifikasi setelah aktif

- [ ] Login admin **dari kantor** → berhasil
- [ ] Login admin **dari data seluler** → ditolak dengan pesan "hanya dapat digunakan dari jaringan kantor"
- [ ] Login **operator dari data seluler** → tetap berhasil (ini yang tidak boleh ikut rusak)
- [ ] Scan QR oleh operator di lapangan → tetap jalan
- [ ] **Admin → Log & Audit Trail** memuat entri `LOGIN_IP_BLOCKED` untuk percobaan yang ditolak

Entri `LOGIN_IP_BLOCKED` yang beralasan salah konfigurasi menyebut IP yang
terbaca, sehingga masalah proxy langsung terlihat dari log alih-alih menyamar
sebagai "sudah aman".
