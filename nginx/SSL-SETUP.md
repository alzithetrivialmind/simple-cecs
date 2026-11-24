# CECS — Setup SSL untuk Nginx

## Opsi 1: Self-Signed Certificate (LAN Internal)

Untuk akses intranet (IP lokal), gunakan self-signed certificate.

```bash
mkdir -p nginx/ssl

# Generate self-signed cert (valid 3 tahun)
openssl req -x509 -nodes -days 1095 \
  -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/O=Your Company/CN=cecs.example.com" \
  -addext "subjectAltName=DNS:cecs.example.com,IP:192.0.2.10"
```

> Browser akan menampilkan peringatan SSL. Tambahkan certificate ke trusted store
> di device internal, atau arahkan team untuk klik "Accept risk".

---

## Opsi 2: Let's Encrypt (Jika punya domain publik + port 80/443 terbuka)

```bash
# Install certbot
sudo apt install certbot

# Generate cert (nonaktifkan nginx dulu)
sudo certbot certonly --standalone \
  -d cecs.example.com

# Salin cert ke folder nginx
mkdir -p nginx/ssl
cp /etc/letsencrypt/live/cecs.example.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/cecs.example.com/privkey.pem nginx/ssl/

# Auto-renew via cron
echo "0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/cecs.example.com/*.pem /path/to/cecs/nginx/ssl/ && docker exec cecs_nginx nginx -s reload" | crontab -
```

---

## Deploy dengan Nginx

```bash
# Pertama kali (atau jika ada perubahan schema)
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm app node_modules/.bin/prisma migrate deploy

# Jalankan semua service termasuk Nginx
docker compose -f docker-compose.prod.yml --env-file .env.production --profile proxy up -d --build

# Cek status
docker compose -f docker-compose.prod.yml ps

# Lihat log Nginx
docker logs cecs_nginx -f
```

---

## `.env.production` yang wajib di-set

```env
NEXTAUTH_SECRET=<random 64 char string>
NEXTAUTH_URL=https://cecs.example.com
POSTGRES_PASSWORD=<strong password>
MINIO_SECRET_KEY=<strong password>
CRON_SECRET=<random 32 char string>
```

Generate random string:
```bash
openssl rand -base64 48
```
