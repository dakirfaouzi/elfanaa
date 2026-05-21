# ─────────────────────────────────────────────────────────────────────────────
# Fanaa Platform — `fanaa` storefront Dockerfile (monorepo-aware)
#
# Build context: REPO ROOT (not apps/fanaa/). This matters because we need
# pnpm-workspace.yaml, packages/db/, and the root lockfile available to
# resolve workspace dependencies (`@platform/db` is a workspace package).
#
# Three-stage build:
#   1. deps    — installs full pnpm workspace, generates Prisma client
#   2. builder — runs `pnpm --filter fanaa build` with NEXT_PUBLIC_* inlined
#   3. runner  — slim node:22-alpine image carrying only the standalone
#                output + traced node_modules + public/ + Prisma engine
#
# Final image: ~180 MB, identical runtime characteristics to pre-M1.
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Dependencies ──────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
# Pin pnpm version explicitly — must match `packageManager` in root package.json.
RUN npm install -g pnpm@9.15.9
WORKDIR /repo

# Copy ONLY the manifests needed to resolve the dependency graph. This keeps
# the deps layer cacheable: changing a source file in apps/fanaa/app/ won't
# bust the install cache, only a manifest change will.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/fanaa/package.json ./apps/fanaa/
COPY packages/db/package.json ./packages/db/

# Prisma schema must be present BEFORE `pnpm install` so the fanaa
# postinstall hook (`prisma generate --schema=../../packages/db/prisma/schema.prisma`)
# can succeed. Without the schema, generate fails, the `|| echo` fallback in
# postinstall swallows the error, and the build ships an empty @prisma/client
# — which then explodes at `next build` with "OrderMirrorWhereInput has no
# exported member".
COPY packages/db/prisma ./packages/db/prisma

# Install the workspace subset rooted at fanaa. `--filter fanaa...` (note the
# trailing dots) includes workspace deps in the closure — i.e. @platform/db.
# `--frozen-lockfile` ensures CI cannot drift from the committed lockfile.
RUN pnpm install --frozen-lockfile --filter fanaa...


# ── 2. Builder ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@9.15.9
WORKDIR /repo

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
# bugs.
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

# Pull the entire resolved install tree from the deps stage. Includes:
#   /repo/node_modules                    (hoisted shared deps)
#   /repo/apps/fanaa/node_modules         (per-workspace symlinks)
#   /repo/packages/db/node_modules        (per-workspace symlinks)
#   /repo/apps/fanaa/node_modules/.prisma (generated client, from postinstall)
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/fanaa/node_modules ./apps/fanaa/node_modules
COPY --from=deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /repo/packages/db/prisma ./packages/db/prisma

# Now copy the rest of the source tree. `.dockerignore` at the repo root
# excludes services/, node_modules, .next, etc.
COPY apps/fanaa ./apps/fanaa
COPY packages/db ./packages/db
COPY tsconfig.base.json turbo.json pnpm-workspace.yaml package.json ./

# Echo what got inlined so build logs make misconfiguration obvious.
RUN echo "[build] NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL" \
 && echo "[build] NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL"

# Defense-in-depth: regenerate the Prisma client now that the full source
# tree is present. The deps stage already generated it, but running again
# here means:
#   • If a future change reorders or removes the deps-stage copy, we never
#     ship a stale client.
#   • Buildkit layer caching can't silently serve an outdated client.
#   • Local devs who skip postinstall don't poison the image.
# Idempotent, ~3s.
RUN cd apps/fanaa && pnpm exec prisma generate --schema=../../packages/db/prisma/schema.prisma

# Build the fanaa workspace. Turborepo would also work here; calling pnpm
# directly avoids the extra layer of orchestration in the critical path
# of the Docker build.
RUN pnpm --filter fanaa build


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

# `output: "standalone"` + `outputFileTracingRoot = monorepo-root` produces
# a fully runnable bundle in `apps/fanaa/.next/standalone/` that preserves
# the apps/fanaa/ prefix. The server entrypoint lands at:
#   .next/standalone/apps/fanaa/server.js
# and all traced node_modules sit alongside (both hoisted at root and
# per-workspace under apps/fanaa/node_modules/).
#
# `public/` and `.next/static/` are NOT copied automatically by the
# standalone tracer — we add them alongside the standalone output to
# match Next.js's runtime expectations.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/fanaa/public ./apps/fanaa/public
COPY --from=builder --chown=nextjs:nodejs /repo/apps/fanaa/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/fanaa/.next/static ./apps/fanaa/.next/static

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
COPY --from=builder --chown=nextjs:nodejs /repo/apps/fanaa/node_modules/.prisma ./apps/fanaa/node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /repo/apps/fanaa/node_modules/@prisma ./apps/fanaa/node_modules/@prisma

USER nextjs
EXPOSE 3000

# NOTE: We intentionally don't ship a Docker HEALTHCHECK. Traefik (EasyPanel's
# reverse proxy) probes the container by attempting a real TCP connection to
# the destination port, which is sufficient for routing decisions. A Docker
# HEALTHCHECK that hard-codes a port would silently fail the moment the host
# overrides PORT (e.g. EasyPanel injects PORT=80) and the orchestrator would
# then refuse to route traffic to a perfectly healthy container.

CMD ["node", "apps/fanaa/server.js"]
