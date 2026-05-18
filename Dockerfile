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

# The Prisma schema MUST be present before `npm ci`, because our `postinstall`
# hook runs `prisma generate`. Without the schema, generate fails with
# "Could not find Prisma Schema", the `|| echo` fallback in postinstall masks
# the error, and `npm ci` finishes with an EMPTY @prisma/client — which then
# explodes during `next build` with "OrderMirrorWhereInput has no exported
# member". Copying `prisma/` here lets postinstall produce the real client
# inside `node_modules/.prisma/client/` and that directory is carried into
# the builder stage via `COPY --from=deps`.
COPY prisma ./prisma

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

# ─── NEXT_PUBLIC_* build-time inlining ──────────────────────────────────────
# Webpack hard-codes every `process.env.NEXT_PUBLIC_*` lookup into the
# client bundle at build time. Anything set as a runtime env var (e.g.
# EasyPanel "Environment Variables") is INVISIBLE to the browser bundle
# — by the time the container starts, the JS has already been baked.
#
# Each NEXT_PUBLIC_* must therefore be declared as a build ARG here AND
# forwarded by the orchestrator at build time:
#   • docker-compose:  services.elfanaa_web.build.args
#   • EasyPanel:       Service → Build → "Build Arguments" tab (NOT
#                       "Environment Variables", which only apply at
#                       runtime — too late for NEXT_PUBLIC_* inlining).
#
# Forgetting to set NEXT_PUBLIC_API_BASE_URL here is the canonical
# cause of "the storefront posts to /api/orders instead of FastAPI"
# bugs: the browser falls back to the Next.js route, the Sheets
# dispatch silently no-ops because GOOGLE_SHEETS_WEBHOOK_URL only
# lives on the API service, and orders never reach the sheet.
ARG NEXT_PUBLIC_API_BASE_URL=""
ARG NEXT_PUBLIC_SITE_URL=""
ARG NEXT_PUBLIC_DEFAULT_LOCALE="ar"
ARG NEXT_PUBLIC_CURRENCY="SAR"
ARG NEXT_PUBLIC_META_PIXEL_ID=""
ARG NEXT_PUBLIC_TIKTOK_PIXEL_ID=""
ARG NEXT_PUBLIC_SNAPCHAT_PIXEL_ID=""

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_DEFAULT_LOCALE=$NEXT_PUBLIC_DEFAULT_LOCALE \
    NEXT_PUBLIC_CURRENCY=$NEXT_PUBLIC_CURRENCY \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID \
    NEXT_PUBLIC_TIKTOK_PIXEL_ID=$NEXT_PUBLIC_TIKTOK_PIXEL_ID \
    NEXT_PUBLIC_SNAPCHAT_PIXEL_ID=$NEXT_PUBLIC_SNAPCHAT_PIXEL_ID

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Echo what got inlined so build logs make misconfiguration obvious.
# Values are non-secret by definition (NEXT_PUBLIC_* ships to browsers).
RUN echo "[build] NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL" \
 && echo "[build] NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL"

# Defense-in-depth: regenerate the Prisma client now that the FULL source
# tree (including `prisma/schema.prisma`) is present. The deps stage already
# generated it, but running again here means:
#   • If a future change reorders or removes the deps-stage copy, we never
#     ship a stale client.
#   • Buildkit layer caching can't silently serve an outdated `.prisma/client/`.
#   • Local devs who skip postinstall don't poison the image.
# `prisma generate` does NOT touch the DB — it only reads the schema and
# emits TS types + the platform-specific query engine binary into
# `node_modules/.prisma/client/`. Idempotent, ~3s.
RUN npx --no-install prisma generate

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

# Prisma engine binary + generated client.
#
# Next.js's @vercel/nft tracer for `output: "standalone"` frequently MISSES
# the Prisma query-engine binary that lives at
# `node_modules/.prisma/client/libquery_engine-*.so.node`. Without it the
# admin DB calls explode at first hit with:
#   "could not load query engine for the current platform".
# We copy the generated client + the @prisma/client wrapper explicitly so
# the runtime container always has a working engine — independent of how
# accurate the tracer is on any given Next.js / Prisma release.
# This is additive: ~16 MB. Only the admin/track routes import it; the
# storefront bundle is untouched.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000

# NOTE: We intentionally don't ship a Docker HEALTHCHECK. Traefik (EasyPanel's
# reverse proxy) probes the container by attempting a real TCP connection to
# the destination port, which is sufficient for routing decisions. A Docker
# HEALTHCHECK that hard-codes a port would silently fail the moment the host
# overrides PORT (e.g. EasyPanel injects PORT=80) and the orchestrator would
# then refuse to route traffic to a perfectly healthy container.

CMD ["node", "server.js"]
