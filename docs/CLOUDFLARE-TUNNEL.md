# Cloudflare Tunnel — Tanpa Port Forward

Opsional. Tujuan: menghilangkan **semua** port masuk yang mengarah ke server.
`cloudflared` membuat koneksi **keluar** ke Cloudflare, sehingga tidak ada
aturan port forward di router yang perlu dibuka.

Jalur ini memakai Nginx bawaan, jadi jalankan dengan `--profile proxy` dan
`--profile tunnel`.

Yang didapat sekaligus:

- Nol port terbuka → layanan lain di server tidak bisa disentuh dari WAN
- IP publik server tidak pernah terekspos
- Sertifikat TLS dikelola Cloudflare (Certbot tidak diperlukan lagi)
- WAF, proteksi DDoS, dan rate limiting di tier gratis

Prasyarat: domain kamu sudah memakai nameserver Cloudflare.

---

## Langkah 1 — Buat tunnel

1. Buka **Cloudflare Zero Trust** → **Networks** → **Tunnels** → *Create a tunnel*
2. Pilih **Cloudflared**, beri nama misalnya `cecs`
3. Salin **token** yang muncul (string panjang diawali `eyJ...`)
4. Masukkan ke `.env.production` di server:

   ```
   CF_TUNNEL_TOKEN=eyJhIjoiXXXXXXXX...
   ```

   Jangan commit nilai ini ke git.

## Langkah 2 — Arahkan hostname publik ke Nginx

Masih di halaman tunnel, tab **Public Hostname** → *Add a public hostname*:

| Kolom | Nilai |
|---|---|
| Subdomain | `cecs` |
| Domain | `example.com` |
| Service Type | `HTTPS` |
| URL | `nginx:443` |

Lalu buka **Additional application settings → TLS**:

| Kolom | Nilai |
|---|---|
| No TLS Verify | **ON** |
| Origin Server Name | `cecs.example.com` |

`No TLS Verify` diperlukan karena cloudflared menghubungi origin lewat nama
internal Docker (`nginx`), yang tidak cocok dengan nama pada sertifikat.
Koneksi ini tidak pernah keluar dari host, jadi aman.

> **Jangan** arahkan ke `http://nginx:80`. Blok server port 80 melakukan
> `return 301 https://...`, sehingga akan terjadi redirect loop.

## Langkah 3 — Jalankan tunnel berdampingan dengan setup lama

Tunnel berada di compose profile `tunnel`, jadi ia tidak ikut jalan sampai
diminta. Port forward yang sekarang masih aktif — ini sengaja, supaya bisa
diuji tanpa memutus layanan.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  --profile proxy --profile tunnel up -d
```

Pastikan tunnel tersambung:

```bash
docker logs cecs_tunnel --tail 30
```

Cari baris `Registered tunnel connection`. Lalu buka
`https://cecs.example.com` dari **jaringan seluler** (bukan Wi-Fi
kantor) dan pastikan aplikasi tampil normal serta bisa login.

## Langkah 4 — Perbaiki IP asli sebelum menutup port ⚠️

**Baca ini sebelum lanjut.** Di belakang tunnel, semua request tiba di Nginx
dari IP container `cloudflared`, bukan dari IP pengunjung. Artinya
`limit_req_zone $binary_remote_addr` akan menganggap **seluruh pengguna sebagai
satu IP** — rate limit login berubah dari "10 percobaan per menit per orang"
menjadi "10 percobaan per menit untuk seluruh perusahaan". Operator akan kena
HTTP 429 secara acak.

Dampaknya kini dua lapis, karena aplikasi juga membaca IP dari header yang
disetel Nginx (`X-Real-IP`, lihat `src/lib/client-ip.ts`):

- rate limit Nginx per IP menjadi satu ember untuk semua orang;
- rate limit login di aplikasi (`src/lib/rate-limit.ts`) ikut menganggap semua
  percobaan berasal dari satu IP, sehingga kunci per-IP bisa mengenai seluruh
  kantor sekaligus;
- kolom IP pada audit log berisi IP container, bukan IP pengguna.

Ketiganya sembuh dengan perbaikan yang sama. Saat cutover, tambahkan di
`nginx/nginx.conf` **di dalam blok `http {}`**, sebelum `limit_req_zone`:

```nginx
# Ambil IP asli pengunjung dari header yang disisipkan Cloudflare.
# Hanya dipercaya bila peer langsungnya adalah jaringan Docker internal —
# yang, setelah Langkah 5, hanya bisa berisi cloudflared.
set_real_ip_from 172.16.0.0/12;
real_ip_header CF-Connecting-IP;
real_ip_recursive on;
```

> **Penting soal urutan:** jangan tambahkan blok ini selagi port 80/443 masih
> terbuka ke internet. Dalam mode port-forward, penyerang bisa mengirim header
> `CF-Connecting-IP` palsu dan lolos dari rate limit. Blok ini baru aman
> setelah Langkah 5 menutup jalur langsung tersebut.

Terapkan bersamaan dengan Langkah 5, lalu `docker compose restart nginx`.

## Langkah 5 — Tutup port

Setelah Langkah 3 terbukti jalan dan Langkah 4 sudah disiapkan:

1. Di `.env.production`, kunci Nginx agar hanya bisa dijangkau dari dalam host:

   ```
   HTTP_BIND=127.0.0.1
   HTTPS_BIND=127.0.0.1
   ```

2. Terapkan:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production \
     --profile proxy --profile tunnel up -d
   ```

3. Di router, hapus aturan port forward ke server.

4. Verifikasi dari luar bahwa port benar-benar tertutup:

   ```bash
   nmap -Pn -p 80,443,22 <ip-publik>
   ```

   Semuanya harus `filtered` atau `closed`. Situs tetap harus bisa dibuka lewat
   `https://cecs.example.com`.

## Langkah 6 — Kemudahan untuk operator (opsional)

Agar operator di lapangan tidak perlu autentikasi tambahan sementara akses
dari luar diperketat: **Zero Trust → Access → Applications** → tambahkan
aplikasi untuk hostname tersebut, lalu buat dua policy:

- **Bypass** — selector `IP Ranges`, isi IP publik kantor
- **Allow** — selector `Emails`, untuk staf yang perlu akses dari luar

Login aplikasi CECS tetap berlaku di kedua jalur; ini hanya lapisan tambahan
di depannya.

---

## Rollback

Bila ada masalah, kembalikan `HTTP_BIND`/`HTTPS_BIND` ke `0.0.0.0`, pasang
kembali aturan port forward di router, lalu:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production stop cloudflared
```

Selama Langkah 5 belum dijalankan, kedua jalur aktif bersamaan sehingga
rollback tidak menyebabkan downtime.
