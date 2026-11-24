# =============================================
# CECS - Company Equipment Control System
# Production Dockerfile
# Multi-stage build for minimal image size
# =============================================

# ---------- Stage 1: Dependencies ----------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm 9 (matching lockfileVersion 9.0)
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy dependency manifests
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- Stage 2: Build ----------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js app (standalone mode via DOCKER_BUILD flag)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DOCKER_BUILD=1
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"
ENV NEXTAUTH_SECRET="build_time_placeholder_secret_at_least_32_characters_long"
ENV NEXTAUTH_URL="http://localhost:3000"
# Shown in the UI; inlined at build time
ARG NEXT_PUBLIC_ORG_NAME="Your Company"
ENV NEXT_PUBLIC_ORG_NAME=$NEXT_PUBLIC_ORG_NAME
RUN pnpm build

# ---------- Stage 3: Production Runner ----------
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built standalone app
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Ensure uploads directory exists with write permissions for nextjs user
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public

# Copy prisma files and node_modules for migrations & seeding
COPY --from=builder /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

# Healthcheck
# `curl -f` hanya gagal pada status >= 400. Ketika /api/health masih
# dilindungi middleware, ia membalas 307 ke /login dan curl tetap keluar 0 —
# container selalu dilaporkan "healthy" walau database mati. Kini
# /api/health dikecualikan dari middleware, dan isi respons ikut diperiksa.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health | grep -q '"database":"ok"' || exit 1

CMD ["node", "server.js"]
