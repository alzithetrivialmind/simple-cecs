# Keamanan CECS

Rincian per topik:

- [DEPLOYMENT.md](DEPLOYMENT.md) — pemasangan produksi
- [CLOUDFLARE-TUNNEL.md](CLOUDFLARE-TUNNEL.md) — tanpa port forward
- [IP-RESTRICTION.md](IP-RESTRICTION.md) — kunci akun ADMIN/SUPERVISOR ke jaringan tertentu
- [BACKUP.md](BACKUP.md) — backup, uji pemulihan, pemulihan

## Lapisan pertahanan

| Lapisan | Mekanisme |
|---|---|
| Reverse proxy (Nginx bawaan) | TLS 1.2/1.3, rate limit per IP, blokir `/api/cron` dan `/api/health` |
| Transport | HSTS, CSP, `X-Frame-Options: DENY`, `nosniff` |
| Autentikasi | bcrypt, rate limit per akun dan per IP, pencabutan sesi |
| Lokasi | ADMIN dan SUPERVISOR bisa dibatasi ke jaringan tertentu (opsional) |
| Otorisasi | Middleware serta pemeriksaan peran di server action |
| Berkas | Allowlist MIME, verifikasi magic bytes, penolakan path traversal |
| Data | Prisma, audit log |
| Container | non-root, `cap_drop: ALL`, `no-new-privileges`, filesystem read-only, batas memori dan PID |

Uji regresi: `pnpm check:security`.

## Checklist sebelum dibuka ke internet

- [ ] Semua nilai `CHANGE_ME` di `.env.production` sudah diganti
- [ ] Akun demo tidak ada, dan kata sandi `ADM001` kuat
- [ ] HTTPS aktif
- [ ] Dari luar, `/api/cron/recalc-pm` dan `/api/health` ditolak (403)
- [ ] Port PostgreSQL dan MinIO tidak bisa dijangkau dari luar server
- [ ] Reverse proxy meneruskan IP asli lewat `X-Real-IP`
- [ ] Backup harian dan uji pemulihan bulanan terjadwal

`docker-compose.yml` hanya untuk pengembangan lokal. Berkas itu memakai
kredensial bawaan dan bucket yang bisa dibaca publik, jadi jangan dipakai di
produksi.

## Batasan yang diketahui

- Belum ada 2FA
- Belum ada CAPTCHA di halaman login
- CSP masih memakai `unsafe-inline`
- Log belum terpusat

## Kalau terjadi insiden

1. Putuskan akses dari luar
2. Cabut semua sesi: ganti `NEXTAUTH_SECRET`, lalu restart `app`
3. Amankan salinan backup agar tidak ikut terdampak
4. Periksa Log & Audit Trail: cari `FAILED_LOGIN` dan `LOGIN_BLOCKED`
5. Pulihkan dari salinan bersih terakhir ([BACKUP.md](BACKUP.md))
6. Ganti semua rahasia sebelum kembali online
