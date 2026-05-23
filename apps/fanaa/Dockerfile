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

# ─── Build-time-inlined env (NEXT_PUBLIC_* + baked Next config) ─────────────
# Two distinct categories share the same foot-gun, hence this block:
#
# 1. NEXT_PUBLIC_*
#    Webpack hard-codes every `process.env.NEXT_PUBLIC_*` lookup into the
#    client bundle at build time. Anything set as a runtime env var (e.g.
#    EasyPanel "Environment Variables") is INVISIBLE to the browser bundle
#    — by the time the container starts, the JS has already been baked.
#
# 2. STUDIO_INTERNAL_URL  (consumed by next.config.mjs `rewrites()`)
#    `next build` evaluates `async rewrites()` and bakes the resolved
#    routes into `.next/routes-manifest.json`. The standalone server
#    reads that manifest at boot and never re-evaluates rewrites(). So
#    if STUDIO_INTERNAL_URL is unset at BUILD time, the /studio →
#    elfanaa_studio rewrite array is `[]` in the manifest and adding the
#    env var to runtime "Environment Variables" later does nothing —
#    fanaa just renders its own not-found.tsx for /studio. This is what
#    surfaced as the "elfanaa.com/studio shows storefront 404" bug.
#
# Each variable below must therefore be declared as a build ARG here AND
# forwarded by the orchestrator at build time:
#   • docker-compose:  services.elfanaa_web.build.args
#   • EasyPanel:       passed automatically as --build-arg for every
#                       value in "Environment Variables", but ONLY if
#                       there's a matching ARG declaration in this
#                       Dockerfile — otherwise Docker silently drops it.
#
# Forgetting to set NEXT_PUBLIC_API_BASE_URL here is the canonical
# cause of "the storefront posts to /api/orders instead of FastAPI"
# bugs. Forgetting STUDIO_INTERNAL_URL kills the /studio mount.
ARG NEXT_PUBLIC_API_BASE_URL=""
ARG NEXT_PUBLIC_SITE_URL=""
ARG NEXT_PUBLIC_DEFAULT_LOCALE="ar"
ARG NEXT_PUBLIC_CURRENCY="SAR"
ARG NEXT_PUBLIC_META_PIXEL_ID=""
ARG NEXT_PUBLIC_TIKTOK_PIXEL_ID=""
ARG NEXT_PUBLIC_SNAPCHAT_PIXEL_ID=""
ARG STUDIO_INTERNAL_URL=""

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_DEFAULT_LOCALE=$NEXT_PUBLIC_DEFAULT_LOCALE \
    NEXT_PUBLIC_CURRENCY=$NEXT_PUBLIC_CURRENCY \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID \
    NEXT_PUBLIC_TIKTOK_PIXEL_ID=$NEXT_PUBLIC_TIKTOK_PIXEL_ID \
    NEXT_PUBLIC_SNAPCHAT_PIXEL_ID=$NEXT_PUBLIC_SNAPCHAT_PIXEL_ID \
    STUDIO_INTERNAL_URL=$STUDIO_INTERNAL_URL

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
# An empty STUDIO_INTERNAL_URL here means `next build` will bake an
# empty rewrites array and elfanaa.com/studio will 404 at runtime.
RUN echo "[build] NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL" \
 && echo "[build] NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL" \
 && echo "[build] STUDIO_INTERNAL_URL=$STUDIO_INTERNAL_URL"

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

# ── Stage Prisma runtime artifacts for the runner ────────────────────────────
# NFT bundles `@prisma/client/default.js` into .next/standalone, but the
# wrapper does a runtime `require('.prisma/client/default')` which NFT can
# NOT statically trace. Without the `.prisma/` directory at a sibling
# `node_modules/` lookup path, the first DB hit at runtime explodes with
# `Cannot find module '.prisma/client/default'`.
#
# pnpm stores the generated client at:
#   /repo/node_modules/.pnpm/@prisma+client@<hash>/node_modules/.prisma
# The <hash> is computed from the full dep graph and changes whenever any
# Prisma-related dep does, so a literal Docker COPY would be brittle. We
# resolve the wildcard at build time with a shell glob and stage the
# directory at a stable path the runner stage can pluck.
RUN PRISMA_PNPM_NODE_MODULES=$(ls -d /repo/node_modules/.pnpm/@prisma+client@*/node_modules 2>/dev/null | head -n 1) \
 && if [ -z "$PRISMA_PNPM_NODE_MODULES" ]; then \
      echo "[stage-prisma] FATAL: pnpm @prisma+client store not found under /repo/node_modules/.pnpm/"; \
      ls /repo/node_modules/.pnpm/ | head -30 || true; \
      exit 1; \
    fi \
 && echo "[stage-prisma] sourcing .prisma from $PRISMA_PNPM_NODE_MODULES/.prisma" \
 && mkdir -p /tmp/prisma-runtime \
 && cp -r "$PRISMA_PNPM_NODE_MODULES/.prisma" /tmp/prisma-runtime/.prisma


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

# Prisma runtime — `.prisma/client/` directory.
#
# NFT bundles `@prisma/client/default.js` into .next/standalone correctly,
# but that wrapper does a runtime `require('.prisma/client/default')`
# which NFT cannot statically trace. Without `.prisma/client/` reachable
# via Node's module lookup, the first admin/track DB call dies with:
#   Cannot find module '.prisma/client/default'
#
# We can't COPY directly from the pnpm store because the path contains a
# graph-hash that changes whenever Prisma deps move. The builder stage
# (above) resolves the wildcard with a shell glob and stages the
# directory at /tmp/prisma-runtime/.prisma — we copy from there. Place
# it next to the @prisma/client wrapper that NFT already shipped:
#   /app/apps/fanaa/node_modules/.prisma/client/...
# which is where Node's runtime resolution will find it from
# /app/apps/fanaa/node_modules/@prisma/client/default.js.
#
# Note: apps/fanaa/next.config.mjs has an `outputFileTracingIncludes`
# block listing `./node_modules/.prisma/client/**/*` paths. Those globs
# still target the npm-classic layout and silently no-op under pnpm;
# left in place as a documented dead config, safe to remove on a future
# cleanup pass once we've migrated all paths to pnpm-aware globs.
COPY --from=builder --chown=nextjs:nodejs /tmp/prisma-runtime/.prisma ./apps/fanaa/node_modules/.prisma

USER nextjs
EXPOSE 3000

# NOTE: We intentionally don't ship a Docker HEALTHCHECK. Traefik (EasyPanel's
# reverse proxy) probes the container by attempting a real TCP connection to
# the destination port, which is sufficient for routing decisions. A Docker
# HEALTHCHECK that hard-codes a port would silently fail the moment the host
# overrides PORT (e.g. EasyPanel injects PORT=80) and the orchestrator would
# then refuse to route traffic to a perfectly healthy container.

CMD ["node", "apps/fanaa/server.js"]
