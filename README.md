# CECS — Company Equipment Control System

CECS is a self-hosted web app for tracking heavy equipment, vehicles, generators, compressors, and other powered machines through their whole working life: breakdowns, repairs, preventive maintenance, inspections, and spare part usage.

It answers one question quickly: **"What has happened to this machine, and is it ready to work?"**

The interface is in Indonesian and is built for phones first, because most records are entered in the field.

## Features

- **Dashboard** — fleet readiness, overdue maintenance, open work orders, breakdowns per month, and the units with the most downtime.
- **Equipment** — unit register with specifications, photos, full history and timeline, plus Excel import and export.
- **QR labels** — print a label per unit. Scanning it opens that unit's page on a phone.
- **Breakdown reports** — a short form with photos. Drafts are kept on the device until the report is sent.
- **Work orders** — created from a breakdown, with diagnosis, repair result, parts used, photos, and status history. Unit status and downtime are updated automatically.
- **Hour meter** — readings can never go backwards, and each reading re-evaluates the maintenance schedule.
- **Preventive maintenance** — schedules by operating hours or by calendar, with checklist templates.
- **Inspections and certificates** — results, findings, and certificate expiry dates. A failed inspection opens a breakdown report.
- **Spare part usage** — which parts went into which machine.
- **Reports** — on-screen reports with Excel export.
- **Administration** — users, master data, and an audit log.

CECS deliberately does **not** handle costs, purchasing, vendors, or stock levels.

## Roles

| Role | Can do |
|---|---|
| `ADMIN` | Everything, including users, master data, and the audit log |
| `SUPERVISOR` | Manage equipment, work orders, schedules, and reports |
| `TECHNICIAN` | Report breakdowns, carry out work orders and maintenance, record hour meters and inspections |
| `OPERATOR` | Record equipment usage and report problems from the field |
| `VIEWER` | Read only, without reports |

## Tech stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Radix UI, PostgreSQL 16, Prisma, Auth.js v5, MinIO (S3-compatible storage), and Docker Compose.

## Quick start

You need [Node.js](https://nodejs.org) 20 or later, [pnpm](https://pnpm.io), and [Docker](https://www.docker.com).

```bash
git clone https://github.com/alzithetrivialmind/simple-cecs.git cecs
cd cecs
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

Open <http://localhost:3000> and sign in with a demo account. The password for all of them is `password123`.

| Employee ID (NIK) | Role |
|---|---|
| `ADM001` | Admin |
| `SPV001` | Supervisor |
| `TECH001`, `TECH002` | Technician |
| `OPR001` | Operator |
| `VIW001` | Viewer |

All demo data is fictional. **These accounts are for local use only.** With `NODE_ENV=production`, the seed skips demo data and creates only `ADM001`, using the password you supply.

## Configuration

Settings are read from `.env` in development and `.env.production` in production.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_ORG_NAME` | Organization name shown in the app, on QR labels, and in exports. Applied at build time |
| `DATABASE_URL` | PostgreSQL connection string (development). In production it is built from the `POSTGRES_*` values |
| `NEXTAUTH_SECRET` | Session signing secret. Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Public URL of the app. QR labels also use it |
| `LAN_IP` | Optional. Address used for QR labels when the URL is `localhost` |
| `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL` | Object storage location |
| `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` | Object storage credentials and bucket |
| `CRON_SECRET` | Token for the scheduled job endpoints |
| `ADMIN_IP_ALLOWLIST` | Optional. Networks that admins and supervisors may use. See [IP restriction](docs/IP-RESTRICTION.md) |

### Use your own branding

1. Set `NEXT_PUBLIC_ORG_NAME`.
2. Replace `public/logo.png`, `public/icon-square.png`, `public/favicon-32x32.png`, and `public/favicon.ico`.
3. Adjust the color variables in `src/app/globals.css`.
4. Rebuild the app.

## Production

```bash
cp .env.production.example .env.production
# edit .env.production and fill in every secret
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Then create the tables and the first admin account by following the [deployment guide](docs/DEPLOYMENT.md). Before exposing the app to the internet, also read the [security notes](docs/SECURITY.md) and set up [backups](docs/BACKUP.md).

## Scheduled jobs

Call these with `POST` and an `x-cron-token` header containing `CRON_SECRET`.

| Endpoint | What it does |
|---|---|
| `/api/cron/recalc-pm` | Recalculates the status of every maintenance plan. Run hourly |
| `/api/cron/daily-digest` | Returns a JSON summary of overdue maintenance, stale work orders, and expiring certificates. It does not send email |

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the development server |
| `pnpm build` / `pnpm start` | Build and run for production |
| `pnpm lint` / `pnpm typecheck` | Check the code |
| `pnpm test` | Run unit tests |
| `pnpm check:security` | Run the security regression checks |
| `pnpm db:deploy` | Apply database migrations |
| `pnpm db:migrate` | Create a new migration during development |
| `pnpm db:seed` | Load the demo data, or the first admin in production |
| `pnpm db:studio` | Browse the database |

## Project structure

```text
prisma/              Database schema, migrations, and seed
public/              Logo and icons
scripts/             Backup scripts and security checks
src/app/             Pages and API routes
src/components/      UI components by module
src/lib/             Auth, storage, validation, and shared helpers
src/server/actions/  Server actions by module
src/server/services/ Business rules
docs/                Product, data model, and operations docs
```

## Documentation

- [Deployment](docs/DEPLOYMENT.md)
- [Security](docs/SECURITY.md)
- [IP restriction](docs/IP-RESTRICTION.md)
- [Cloudflare Tunnel](docs/CLOUDFLARE-TUNNEL.md)
- [Backup and restore](docs/BACKUP.md)
- [Product requirements](docs/PRD.md), [data model](docs/DATA-MODEL.md), and [UI spec](docs/UI-SPEC.md). These are design documents, so some details differ from the current code

Except for the deployment guide, the documents in `docs/` are in Indonesian.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
