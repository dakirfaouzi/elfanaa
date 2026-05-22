# ─────────────────────────────────────────────────────────────────────────────
# Fanaa Platform — `studio` Dockerfile (monorepo-aware)
#
# Build context: REPO ROOT (not apps/studio/). Same pattern as fanaa so the
# pnpm workspace manifests are reachable for `pnpm install --filter studio`.
#
# Three-stage build:
#   1. deps    — installs the studio workspace subset
#   2. builder — runs `pnpm --filter studio build`
#   3. runner  — slim node:22-alpine image with the standalone output
#
# Differences vs apps/fanaa/Dockerfile:
#   • No NEXT_PUBLIC_* build args     (Studio is internal-only, no public env)
#   • No Prisma engine COPY hardening (M2 Studio doesn't touch the DB)
#   • No public/ COPY                 (no static assets in the M2 skeleton)
#
# Final image: ~150 MB (no recharts, no swr, no zustand, no prisma).
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Dependencies ──────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@9.15.9
WORKDIR /repo

# Manifests only — keeps the deps layer cacheable across source-only changes.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/studio/package.json ./apps/studio/

# Install only the studio workspace subset. The trailing `...` includes
# transitive workspace deps; today there are none for studio (it consumes
# only npm packages), but the syntax is forward-compatible for M3+ when
# @platform/{catalog-schema,stores,...} become studio dependencies.
RUN pnpm install --frozen-lockfile --filter studio...


# ── 2. Builder ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@9.15.9
WORKDIR /repo

# ── basePath (M12) ──────────────────────────────────────────────────────────
# Studio mounts at `/studio` when deployed behind the storefront. The
# Next.js basePath / assetPrefix are baked at build time, so this value
# MUST arrive as a build arg (not just a runtime env var). When unset
# the build produces a root-mounted bundle — back-compat with M2-M11.
#
# EasyPanel users: set this in the Studio service's "Build Arguments"
# tab, NOT "Environment Variables".
ARG NEXT_PUBLIC_STUDIO_BASE_PATH=""
ENV NEXT_PUBLIC_STUDIO_BASE_PATH=$NEXT_PUBLIC_STUDIO_BASE_PATH

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/studio/node_modules ./apps/studio/node_modules

# Source tree. `.dockerignore` at the repo root excludes services/, .next,
# node_modules, etc. We explicitly copy what studio needs.
COPY apps/studio ./apps/studio
COPY tsconfig.base.json turbo.json pnpm-workspace.yaml package.json ./

RUN pnpm --filter studio build


# ── 3. Runtime ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Re-declare the basePath build arg in the runtime stage so we can mirror
# it as a runtime ENV. Required because the running server reads
# `process.env.NEXT_PUBLIC_STUDIO_BASE_PATH` inside `next.config.mjs`
# evaluation at boot — without this, hot-restarted containers could lose
# the configured prefix.
ARG NEXT_PUBLIC_STUDIO_BASE_PATH=""

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_PUBLIC_STUDIO_BASE_PATH=$NEXT_PUBLIC_STUDIO_BASE_PATH

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone output. `outputFileTracingRoot = monorepo-root` in
# apps/studio/next.config.mjs means the bundle preserves the apps/studio/
# prefix and the entrypoint is apps/studio/server.js.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/studio/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/studio/.next/static ./apps/studio/.next/static

USER nextjs
EXPOSE 3000

# Same Traefik-friendly choice as apps/fanaa/Dockerfile — no Docker HEALTHCHECK
# baked in, because EasyPanel's Traefik probes the TCP socket directly and a
# hard-coded HEALTHCHECK port silently breaks the moment PORT is overridden.

CMD ["node", "apps/studio/server.js"]
