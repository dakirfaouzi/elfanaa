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
#
# # Why the explicit `--filter @platform/db`
#
# `@platform/db` is the schema-host package. It owns the Prisma schema
# at `packages/db/prisma/schema.prisma` and lists `prisma` (the CLI)
# in its `devDependencies`. Both the deps-stage postinstall hook AND
# the builder-stage explicit `prisma generate` invoke the CLI against
# that schema, which is located inside `packages/db/`.
#
# Prisma 6.x walks UP from the schema file to find the nearest
# `package.json` (i.e. `packages/db/package.json`) and verifies the
# Prisma CLI is installed within THAT package's node_modules. If not,
# it spawns `pnpm add prisma@<version> -D --silent` to self-install,
# which then fails under `--frozen-lockfile`.
#
# Pre-M12, `@platform/db` was in `@platform/persistence`'s dependency
# closure, so `--filter studio...` (via persistence) pulled it in
# transitively and the Prisma CLI ended up in `packages/db/node_modules`.
# M12's cyclic-dependency cleanup (commit ddbf9d0) removed `@platform/db`
# from `@platform/persistence`'s deps to fix a pnpm warning — that was
# correct architecturally, but it knocked `@platform/db` out of studio's
# install closure, breaking the `prisma generate` step inside Docker.
#
# Adding `--filter @platform/db` explicitly here restores the pre-M12
# install behavior without reintroducing the workspace cycle. The
# additional install cost is one extra workspace package (the schema
# files + prisma CLI), which were already being installed before.
RUN pnpm install --frozen-lockfile --filter studio... --filter @platform/db


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

# ── Build SHA stamping (resolved from EasyPanel's GIT_SHA build arg) ────────
# Bakes the source git commit into the image so the running container
# can self-report which SHA it was built from. Surfaced in the Studio
# NavBar pill + at the bottom of the public /login page so operators
# can verify "is this deploy actually the latest source?" without SSH.
#
# Two env vars on purpose:
#   • STUDIO_BUILD_SHA              — server-only (route handlers,
#                                     server components).
#   • NEXT_PUBLIC_STUDIO_BUILD_SHA — Next.js inlines NEXT_PUBLIC_* into
#                                     the client bundle at build time, so
#                                     the value reaches client components
#                                     too (e.g. the login page stamp,
#                                     which is "use client").
#
# Both end up set to the SAME 7-40 char hex SHA. lib/studio/build-info.ts
# falls back to the literal string "dev" when either is missing/malformed —
# a Studio NavBar showing a red "dev" pill in production means none of
# the build args below carried a valid SHA (the symptom we want operators
# to notice loudly).
#
# # Why the GIT_SHA build arg is the canonical source
#
# History — three failed designs:
#
#   1. Original (commit 53c4aad): the operator hand-typed
#      STUDIO_BUILD_SHA in EasyPanel's Build Arguments tab and was
#      expected to update it on every deploy. In practice the value
#      was set once and frozen for 18 commits, producing a misleading
#      "did my deploy land?" diagnosis after every redeploy.
#
#   2. Second attempt (commit cf0418c): the Dockerfile tried to read
#      .git/HEAD inside the build, so the SHA could never drift from
#      the actual source. But EasyPanel does NOT ship .git/ in its
#      build context — it downloads a GitHub archive ZIP and builds
#      from that — so `COPY .git` failed the build outright. The
#      .git allow-list in .dockerignore was also pointless.
#
#   3. Current design (this commit): EasyPanel already auto-injects
#      the real commit SHA as a `GIT_SHA` build arg on every build.
#      We trust that arg as the canonical source. Operators can't
#      typo it; EasyPanel sets it from the same git ref the archive
#      ZIP was downloaded from. Resolution still happens at build
#      time, gets baked into a file inside the standalone bundle,
#      and the runtime entrypoint reads from that file — so a stale
#      runtime env var can never shadow the truth.
#
# Resolution priority (defense in depth):
#
#   1. GIT_SHA build arg                — EasyPanel auto-injected.
#   2. STUDIO_BUILD_SHA build arg       — legacy operator-typed.
#   3. NEXT_PUBLIC_STUDIO_BUILD_SHA arg — defense in depth.
#   4. Literal "dev"                    — visible red pill in NavBar.

ARG GIT_SHA=""
ARG STUDIO_BUILD_SHA=""
ARG NEXT_PUBLIC_STUDIO_BUILD_SHA=""

# Resolve the SHA from build args in priority order and write the
# winning value to /tmp/.build-sha for the `next build` RUN block to
# source. Tracks `SOURCE` so build logs explicitly attribute the
# winning value, making diagnosis trivial for the next operator.
RUN set -e; \
    DERIVED=""; \
    SOURCE=""; \
    if [ -n "${GIT_SHA}" ] && echo "${GIT_SHA}" | grep -qE '^[0-9a-f]{7,40}$'; then \
      DERIVED=$(echo "${GIT_SHA}" | tr 'A-Z' 'a-z'); \
      SOURCE="GIT_SHA build arg"; \
    elif [ -n "${STUDIO_BUILD_SHA}" ] && echo "${STUDIO_BUILD_SHA}" | grep -qE '^[0-9a-f]{7,40}$'; then \
      DERIVED=$(echo "${STUDIO_BUILD_SHA}" | tr 'A-Z' 'a-z'); \
      SOURCE="STUDIO_BUILD_SHA build arg (legacy)"; \
    elif [ -n "${NEXT_PUBLIC_STUDIO_BUILD_SHA}" ] && echo "${NEXT_PUBLIC_STUDIO_BUILD_SHA}" | grep -qE '^[0-9a-f]{7,40}$'; then \
      DERIVED=$(echo "${NEXT_PUBLIC_STUDIO_BUILD_SHA}" | tr 'A-Z' 'a-z'); \
      SOURCE="NEXT_PUBLIC_STUDIO_BUILD_SHA build arg (defense in depth)"; \
    else \
      DERIVED="dev"; \
      SOURCE="fallback (no valid build arg)"; \
    fi; \
    printf '%s' "${DERIVED}" > /tmp/.build-sha; \
    echo "[build-sha] resolved=${DERIVED} source=\"${SOURCE}\""

# Re-export the resolved SHA as ENV via a file. Subsequent RUN steps
# (`next build` in particular) read this path to set the build-time
# env. We use a file rather than a Dockerfile `ENV` directive because
# `ENV` cannot read values from build-arg conditionals — the file
# encodes the priority decision once, then every consumer reads the
# resolved value verbatim.
ENV STUDIO_BUILD_SHA_FILE=/tmp/.build-sha

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

# Run the Next.js production build with the resolved SHA exported into
# the shell environment. Exporting in the same RUN as the build is the
# only way to inject the file-derived SHA into Next's build-time env —
# Dockerfile `ENV` directives can't read from files, and `next build`
# inlines `NEXT_PUBLIC_*` variables at build time, not at runtime.
#
# The exported values land in the client bundle (NEXT_PUBLIC_*) AND in
# the build's process.env (server-side), so both halves of the Studio
# code see the same SHA without any divergence opportunity.
RUN STUDIO_BUILD_SHA="$(cat ${STUDIO_BUILD_SHA_FILE})" \
 && NEXT_PUBLIC_STUDIO_BUILD_SHA="${STUDIO_BUILD_SHA}" \
 && export STUDIO_BUILD_SHA NEXT_PUBLIC_STUDIO_BUILD_SHA \
 && echo "[build] STUDIO_BUILD_SHA=${STUDIO_BUILD_SHA}" \
 && pnpm --filter studio build

# Stage the resolved SHA into the standalone bundle. The runtime
# entrypoint reads this file and re-exports STUDIO_BUILD_SHA before
# launching the Node process, so server-side reads of the env var
# always reflect the actual build — no chance of an EasyPanel
# environment-variable override shadowing the truth at runtime.
RUN cp ${STUDIO_BUILD_SHA_FILE} /repo/apps/studio/.next/standalone/apps/studio/BUILD_SHA \
 && echo "[build-sha] baked into standalone bundle at apps/studio/BUILD_SHA"

# ── Stage Prisma runtime artifacts for the runner ────────────────────────────
# NFT bundles `@prisma/client/default.js` into .next/standalone, but the
# wrapper does a runtime `require('.prisma/client/default')` which NFT
# cannot statically trace. Without the `.prisma/` directory at a sibling
# `node_modules/` lookup path, the first DB hit (e.g. loading the drafts
# list after Studio login) explodes with:
#   Cannot find module '.prisma/client/default'
#
# Same fix as apps/fanaa/Dockerfile. See that file for the full
# rationale. pnpm stores the client under a graph-hashed directory, so
# we resolve the wildcard at build time and stage at a stable path the
# runner stage plucks.
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

# Re-declare the basePath build arg in the runtime stage so we can mirror
# it as a runtime ENV. Required because the running server reads
# `process.env.NEXT_PUBLIC_STUDIO_BASE_PATH` inside `next.config.mjs`
# evaluation at boot — without this, hot-restarted containers could lose
# the configured prefix.
ARG NEXT_PUBLIC_STUDIO_BASE_PATH=""

# Build-SHA stamping — runtime side.
#
# The builder stage resolved the SHA from EasyPanel's `GIT_SHA` build
# arg (priority 1) and baked it into the standalone bundle as
# `apps/studio/BUILD_SHA`. The entrypoint (docker-entrypoint.sh)
# reads that file at boot and exports `STUDIO_BUILD_SHA` for the Node
# process before exec'ing CMD, so server-side reads of
# `process.env.STUDIO_BUILD_SHA` always reflect the actual built
# source. Client-side `NEXT_PUBLIC_STUDIO_BUILD_SHA` is already
# inlined into the JS bundle at build time; the entrypoint only needs
# to handle the server side.
#
# Build args are declared here purely so Docker doesn't warn about
# "unused build args" if EasyPanel still passes the legacy values.
# The entrypoint's file-read ALWAYS wins, so a stale build arg is
# now harmless. Operators can (and should) delete the legacy
# `STUDIO_BUILD_SHA` / `NEXT_PUBLIC_STUDIO_BUILD_SHA` entries from
# the EasyPanel Build Arguments tab after their first deploy on this
# Dockerfile — they're superseded by the GIT_SHA auto-injection.
ARG GIT_SHA=""
ARG STUDIO_BUILD_SHA=""
ARG NEXT_PUBLIC_STUDIO_BUILD_SHA=""

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_PUBLIC_STUDIO_BASE_PATH=$NEXT_PUBLIC_STUDIO_BASE_PATH

# Prisma CLI for in-container migrations.
#
# Why ship the CLI in the runtime image (vs. building a separate migration
# container or doing it from a developer laptop):
#   • The EasyPanel-internal Postgres (elfanaa_database) is NOT reachable
#     from outside the Docker network, so `prisma migrate deploy` from a
#     developer machine isn't an option without temporarily exposing the
#     DB port.
#   • A separate one-shot migration container would need its own image,
#     build pipeline, and EasyPanel service — operational overhead for
#     something we run every Studio schema bump.
#   • Co-locating the CLI with the running app means the entrypoint can
#     conditionally migrate on boot (see docker-entrypoint.sh) AND the
#     operator can run ad-hoc `prisma migrate ...` from EasyPanel's
#     Shell tab against the same DB the app talks to, with zero risk of
#     cross-environment mistakes.
#
# Cost: +libc6-compat (~3MB) + prisma global (~70MB compressed). Acceptable
# for an internal-only admin tool.
#
# libc6-compat is required by the Prisma migration engine binary (the
# query engine bundled with `.prisma/client` already needs it, but it
# wasn't strictly necessary before we shipped the migration engine).
RUN apk add --no-cache libc6-compat \
 && npm install -g prisma@6.19.3

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Persistent storage scaffold for the M6 worker artefacts.
#
# apps/studio/lib/studio/run-loader.ts reads from
#   `process.cwd()/.platform-data/runs/<runId>.json`
# i.e. `/app/.platform-data/runs/`. Operators MUST mount a Docker
# volume there or every container rebuild wipes the entire run history
# (replay buttons disappear, drafts orphan from their producer run,
# operators lose the ability to debug failed pipelines).
#
# Pre-creating both subdirectories with nextjs:nodejs ownership has
# two purposes:
#   1. The Studio renders an empty-state UI gracefully when the dir
#      exists but is empty — no ENOENT crash on first boot.
#   2. When the operator mounts a *named volume* at /app/.platform-data,
#      Docker copies the directory metadata (including ownership) into
#      the volume on first initialization. So the volume inherits
#      nextjs:nodejs perms and the Studio process can write into it
#      without root privileges or runtime chown.
#
# If the operator instead mounts a *bind mount* from a host directory
# (e.g. EasyPanel "Mounts" → File mode), they must `chown -R 1001:1001`
# the host path themselves. The entrypoint logs a clear warning if the
# mount lands and is not nextjs-writable. See docker-entrypoint.sh.
RUN mkdir -p /app/.platform-data/runs /app/.platform-data/products \
 && chown -R nextjs:nodejs /app/.platform-data

# Standalone output. `outputFileTracingRoot = monorepo-root` in
# apps/studio/next.config.mjs means the bundle preserves the apps/studio/
# prefix and the entrypoint is apps/studio/server.js.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/studio/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/studio/.next/static ./apps/studio/.next/static

# Prisma runtime — `.prisma/client/` directory.
# See the matching block in apps/fanaa/Dockerfile for the full rationale.
# Required so `lib/studio/persistence.ts` -> `require("@prisma/client")`
# -> `@prisma/client/default.js` -> `require('.prisma/client/default')`
# resolves at runtime.
COPY --from=builder --chown=nextjs:nodejs /tmp/prisma-runtime/.prisma ./apps/studio/node_modules/.prisma

# Prisma schema + migrations, needed by `prisma migrate deploy` whether
# invoked automatically (STUDIO_AUTO_MIGRATE=true) or manually from the
# EasyPanel Shell. ~30KB total; cheap to ship.
COPY --from=builder --chown=nextjs:nodejs /repo/packages/db/prisma ./packages/db/prisma

# Entrypoint shim — conditionally runs `prisma migrate deploy` before
# starting the Next.js server. Idempotent; safe to leave STUDIO_AUTO_MIGRATE
# permanently on. See the script header for the full rationale.
COPY --chown=nextjs:nodejs apps/studio/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# `sed` strips any CR characters that snuck in from a Windows checkout
# with a misconfigured core.autocrlf — the repo's .gitattributes pins
# *.sh to LF, but defense-in-depth means a stale local clone or a
# CI/CD copy that bypasses git checkout still produces a runnable image
# instead of silently failing with `/bin/sh^M: bad interpreter`.
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
 && chmod +x /usr/local/bin/docker-entrypoint.sh

# Pin PLATFORM_DATA_ROOT to the volume mount point.
#
# The standalone Next.js server is launched as `node apps/studio/server.js`
# from WORKDIR=/app, but Next.js's standalone bootstrap chdirs into
# `/app/apps/studio` before exec'ing the user code. So `process.cwd()`
# inside the running server is `/app/apps/studio`, NOT `/app/`.
#
# `lib/studio/paths.ts` resolves the data root via
#   path.resolve(process.cwd(), ".platform-data")
# which would otherwise become `/app/apps/studio/.platform-data` — a
# directory NOT on the mounted volume. Every run written there ended
# up on the container's ephemeral overlayfs and was discarded on the
# next rebuild (verified in production with two consecutive data
# losses before this bake-in).
#
# Setting PLATFORM_DATA_ROOT here makes the path absolute and
# correct regardless of cwd. Operators can still override per-deploy
# via EasyPanel → Environment Variables if they mount the volume at
# a different path (e.g. /data).
ENV PLATFORM_DATA_ROOT=/app/.platform-data

USER nextjs
EXPOSE 3000

# Same Traefik-friendly choice as apps/fanaa/Dockerfile — no Docker HEALTHCHECK
# baked in, because EasyPanel's Traefik probes the TCP socket directly and a
# hard-coded HEALTHCHECK port silently breaks the moment PORT is overridden.

# ENTRYPOINT runs the migration shim; CMD is exec'd by the shim so signals
# reach Node directly (no PID-1 shell intercepting SIGTERM).
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "apps/studio/server.js"]
