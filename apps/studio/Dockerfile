# ─────────────────────────────────────────────────────────────────────────────
# Fanaa Platform — `studio` Dockerfile (monorepo-aware)
#
# Build context: REPO ROOT (not apps/studio/). Required so pnpm-workspace.yaml
# + all packages/* manifests are reachable for `pnpm install --filter studio...`.
#
# Three-stage build:
#   1. deps    — installs the full studio workspace closure (studio + 11
#                transitive @platform/* workspace packages) and generates
#                the Prisma client used by @platform/persistence.
#   2. builder — extends `deps` so the full node_modules graph (including
#                per-workspace cross-package symlinks) is already in place,
#                overlays the latest source, runs `pnpm --filter studio build`.
#   3. runner  — slim node:22-alpine image carrying only the standalone
#                output + traced node_modules + the Prisma engine binary.
#
# History note: M2 Studio had zero workspace deps, so the original Dockerfile
# only copied apps/studio/. M3–M11 added 11 @platform/* workspace deps
# (builder-schema, builder-state, catalog-schema, env, ingest, persistence,
# publishers, runtime-renderer, storage, stores, worker) but the Dockerfile
# was never updated until M12 deployment. This file is the post-M12 version
# that correctly installs the entire workspace closure.
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Dependencies ──────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
# Pin pnpm version explicitly — must match `packageManager` in root package.json.
RUN npm install -g pnpm@9.15.9
WORKDIR /repo

# Workspace root manifests.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Studio app manifest.
COPY apps/studio/package.json ./apps/studio/

# Full packages/ tree — both manifests AND source. We need every
# packages/*/package.json BEFORE `pnpm install` so pnpm can compute the
# workspace dependency graph and create the per-package node_modules
# symlinks that workspace-to-workspace imports (e.g. `packages/ingest`
# importing `@platform/catalog-schema`) rely on. Copying the entire tree
# (not just the manifests) is acceptable because (a) the compressed
# transfer is < 1 MB after .dockerignore, and (b) the builder stage needs
# the source anyway. Doing it in one COPY here also means the deps layer
# caches across source-only changes inside apps/studio/.
COPY packages ./packages

# Prisma schema must exist before `pnpm install` so the postinstall hook
# (`prisma generate --schema=...`) can succeed. Without it the deps stage
# would ship an empty @prisma/client and the build would later die with
# "OrderMirrorWhereInput has no exported member" or similar.
# `COPY packages ./packages` above already includes packages/db/prisma/,
# so this is implicit — kept as a comment for the next maintainer.

# Install the studio workspace subset including the full workspace closure.
# `--filter studio...` (note the trailing `...`) pulls every workspace
# package that studio depends on transitively. `--frozen-lockfile` ensures
# CI cannot drift from the committed lockfile.
RUN pnpm install --frozen-lockfile --filter studio...


# ── 2. Builder ───────────────────────────────────────────────────────────────
# Extending `deps` instead of starting from `node:22-alpine` means we
# inherit the entire resolved node_modules graph (/repo/node_modules,
# /repo/apps/studio/node_modules, AND /repo/packages/*/node_modules)
# without having to enumerate per-package COPY --from=deps lines.
FROM deps AS builder

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

# Overlay the latest source on top of the deps install. We copy `packages`
# again here (even though deps already has it) so source-only edits inside
# any @platform/* package invalidate ONLY this builder layer, not the
# (expensive) install layer above.
COPY apps/studio ./apps/studio
COPY packages ./packages
COPY tsconfig.base.json turbo.json pnpm-workspace.yaml package.json ./

# Defense-in-depth: regenerate the Prisma client now that the full source
# tree is present. The deps stage already ran the postinstall hook, but
# explicitly re-running here means:
#   • Layer cache misses during development never ship a stale client.
#   • Future maintainers who reorder the deps-stage copy don't silently
#     break the runtime image.
# Idempotent, ~3s.
RUN cd apps/studio \
 && pnpm exec prisma generate --schema=../../packages/db/prisma/schema.prisma

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
#
# Note: unlike apps/fanaa/Dockerfile, we DO NOT explicitly copy
# `.prisma/` or `@prisma/` here. With pnpm's symlink layout the canonical
# Prisma client lives at
#   /repo/node_modules/.pnpm/@prisma+client@<hash>/node_modules/@prisma/client
# and `apps/studio/node_modules/.prisma` never exists, which would make
# the COPY fail at build time. Next.js 15's standalone tracer (NFT)
# already follows the @prisma/client import graph and bundles the
# linux-musl query-engine binary into .next/standalone — so the runtime
# image is self-contained without manual hardening. If a future Prisma
# release breaks NFT tracing, add a targeted COPY of the actual pnpm
# store path (above) — not the npm-style hoisted path.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/studio/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/studio/.next/static ./apps/studio/.next/static

USER nextjs
EXPOSE 3000

# Same Traefik-friendly choice as apps/fanaa/Dockerfile — no Docker HEALTHCHECK
# baked in, because EasyPanel's Traefik probes the TCP socket directly and a
# hard-coded HEALTHCHECK port silently breaks the moment PORT is overridden.

CMD ["node", "apps/studio/server.js"]
