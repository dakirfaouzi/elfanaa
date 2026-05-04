# ─────────────────────────────────────────────────────────────────────────────
# ELFANAA frontend — Next.js (App Router) Dockerfile
# Three-stage build: deps → builder → runtime. Runtime image stays small
# (~180 MB) because we only ship the standalone `.next/standalone` bundle,
# `public/`, and the static `.next/static` chunks.
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Dependencies ──────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Use the lockfile that's actually present. `--frozen-lockfile` flags ensure
# CI deploys never silently drift from local.
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm install --frozen-lockfile; \
  elif [ -f yarn.lock ]; then \
    yarn --frozen-lockfile; \
  else \
    npm ci; \
  fi


# ── 2. Builder ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm build; \
  elif [ -f yarn.lock ]; then \
    yarn build; \
  else \
    npm run build; \
  fi


# ── 3. Runtime ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as a non-root user for defence in depth.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# `output: "standalone"` produces a fully runnable bundle in `.next/standalone`,
# but `public/` and `.next/static` are not copied automatically — we add them
# alongside the standalone output to match Next.js's runtime expectations.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# NOTE: We intentionally don't ship a Docker HEALTHCHECK. Traefik (EasyPanel's
# reverse proxy) probes the container by attempting a real TCP connection to
# the destination port, which is sufficient for routing decisions. A Docker
# HEALTHCHECK that hard-codes a port would silently fail the moment the host
# overrides PORT (e.g. EasyPanel injects PORT=80) and the orchestrator would
# then refuse to route traffic to a perfectly healthy container.

CMD ["node", "server.js"]
