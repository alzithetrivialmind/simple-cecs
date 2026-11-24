# Deployment

This guide runs CECS on a single Linux server with Docker Compose.

## 1. Get the code and configure it

```bash
git clone https://github.com/alzithetrivialmind/simple-cecs.git /opt/cecs
cd /opt/cecs
cp .env.production.example .env.production
chmod 600 .env.production
```

Edit `.env.production` and replace every `CHANGE_ME`. Generate secrets with:

```bash
openssl rand -hex 32
```

Set `NEXTAUTH_URL` to the address people will open, for example `https://cecs.example.com`.

## 2. Start the stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## 3. Create the tables and the first admin

Run this once. Choose a password of at least 12 characters.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec app \
  node_modules/.bin/prisma migrate deploy
read -rs SEED_ADMIN_PASSWORD && export SEED_ADMIN_PASSWORD
docker compose -f docker-compose.prod.yml --env-file .env.production exec \
  -e SEED_ADMIN_PASSWORD app node_modules/.bin/tsx prisma/seed.ts
unset SEED_ADMIN_PASSWORD
```

Sign in as `ADM001`, then add departments, locations, and users under Master Data and Pengguna.

## 4. Put HTTPS in front

The app listens on `127.0.0.1:3000`. Choose one:

- **Your own reverse proxy** on the same host, forwarding to `127.0.0.1:3000`. It must set `X-Real-IP` and block `/api/cron` and `/api/health` from outside.
- **The bundled Nginx**: set `server_name` in `nginx/nginx.conf`, add certificates ([SSL setup](../nginx/SSL-SETUP.md)), then add `--profile proxy` to the `up` command.
- **Cloudflare Tunnel**: see [CLOUDFLARE-TUNNEL.md](CLOUDFLARE-TUNNEL.md).

## 5. Schedule the jobs

Add to the host's crontab:

```cron
0 * * * * docker exec cecs_app sh -c 'curl -fsS -X POST -H "x-cron-token: $CRON_SECRET" http://localhost:3000/api/cron/recalc-pm'
0 2 * * * sh /opt/cecs/scripts/backup.sh
```

## Updating

```bash
cd /opt/cecs
sh scripts/backup.sh
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec app \
  node_modules/.bin/prisma migrate deploy
```

## Troubleshooting

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f app
```
