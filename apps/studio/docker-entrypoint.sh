#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Studio container entrypoint.
#
# Three responsibilities:
#   1. Sanity-check the .platform-data mount so a missing/mis-permissioned
#      volume fails loudly at boot rather than silently after the first
#      pipeline run (when the worker's first fs.writeFile EACCES would
#      otherwise look like a generic 500 in /studio/intake).
#   2. Optionally apply pending Prisma migrations to ADMIN_DATABASE_URL
#      before the Next.js server starts.
#   3. exec() the original CMD so PID 1 ends up as the Node process
#      (proper SIGTERM handling, no zombie shell).
#
# Migration is opt-in via STUDIO_AUTO_MIGRATE=true. Reasons:
#   • The schema is SHARED with fanaa-admin (both apps point at the same
#     Postgres via ADMIN_DATABASE_URL per PLATFORM.md §M10). Auto-applying
#     a new migration the moment Studio redeploys could surprise fanaa-admin
#     if the migration drops/renames a column it still depends on. Forcing
#     the operator to set STUDIO_AUTO_MIGRATE=true once per rollout means
#     schema changes are a conscious decision, not a side-effect of a
#     Studio code deploy.
#   • Once enabled, leaving the env var set is safe: `prisma migrate deploy`
#     consults the `_prisma_migrations` tracking table and skips anything
#     already applied. Cost on hot restarts is ~30ms (one round trip to
#     read the tracking table).
#   • Prisma takes an advisory lock during deploy, so even multi-replica
#     rollouts where every replica boots simultaneously serialise the
#     actual schema mutation.
#
# Manual alternative (when STUDIO_AUTO_MIGRATE is unset):
#   EasyPanel → elfanaa_studio → Shell tab → run:
#     prisma migrate deploy --schema=/app/packages/db/prisma/schema.prisma
#   The CLI is on PATH (`npm install -g prisma@<ver>` in the Dockerfile
#   runner stage) and reads the same ADMIN_DATABASE_URL from env.
# ─────────────────────────────────────────────────────────────────────────────
set -e

# ─── 0. Build-SHA banner ─────────────────────────────────────────────────────
#
# Emits a single greppable line as the first thing the container says
# on boot. Diagnostic-only — never gates startup. Lets an operator
# triaging "did my deploy actually land?" answer the question from
# `docker logs` / EasyPanel's Logs tab without needing to navigate
# Studio at all. Mirrors the SHA pill in the NavBar and the stamp on
# the public /login page.
#
# # Source-of-truth: the baked BUILD_SHA file
#
# The builder stage (apps/studio/Dockerfile) resolves the SHA from
# EasyPanel's auto-injected `GIT_SHA` build arg (with two legacy
# build args as fallbacks) at build time and writes it to
# `/app/apps/studio/BUILD_SHA` inside the standalone bundle. Reading
# from this file at runtime means the SHA always matches the build
# arg the image was constructed with — no chance of a stale runtime
# env var misrepresenting the deployed code.
#
# We OVERRIDE the env var here (rather than falling back to it)
# because the file is the canonical post-M12-pipeline-fix source of
# truth. Any STUDIO_BUILD_SHA env var passed by the operator (e.g.
# leftover from the legacy EasyPanel build-arg flow) gets superseded.
#
# Fallback order:
#   1. /app/apps/studio/BUILD_SHA (the bake file — resolved from
#      GIT_SHA / STUDIO_BUILD_SHA / NEXT_PUBLIC_STUDIO_BUILD_SHA at
#      build time, in that priority).
#   2. STUDIO_BUILD_SHA env (last-resort runtime fallback when the
#      BUILD_SHA file is missing or empty — should not happen on
#      images built with the current Dockerfile).
#   3. NEXT_PUBLIC_STUDIO_BUILD_SHA env (defense in depth).
#   4. "dev" — only reached if all three above are empty/missing,
#      which would indicate a botched build. The NavBar pill renders
#      a red "dev" badge so operators notice immediately.
BUILD_SHA_FILE="/app/apps/studio/BUILD_SHA"
if [ -f "${BUILD_SHA_FILE}" ]; then
  RESOLVED_SHA=$(cat "${BUILD_SHA_FILE}" | tr -d '[:space:]')
  if [ -n "${RESOLVED_SHA}" ]; then
    # Override the env explicitly. Persists for the exec'd Node
    # process below because we `export` rather than just assign.
    export STUDIO_BUILD_SHA="${RESOLVED_SHA}"
    export NEXT_PUBLIC_STUDIO_BUILD_SHA="${RESOLVED_SHA}"
    echo "[entrypoint] build sha: ${RESOLVED_SHA} (source: BUILD_SHA file)"
  else
    SHA_FOR_BANNER="${STUDIO_BUILD_SHA:-${NEXT_PUBLIC_STUDIO_BUILD_SHA:-dev}}"
    echo "[entrypoint] build sha: ${SHA_FOR_BANNER} (source: env fallback — BUILD_SHA file empty)"
  fi
else
  SHA_FOR_BANNER="${STUDIO_BUILD_SHA:-${NEXT_PUBLIC_STUDIO_BUILD_SHA:-dev}}"
  echo "[entrypoint] build sha: ${SHA_FOR_BANNER} (source: env fallback — BUILD_SHA file absent)"
fi

# ─── 1. Persistent volume sanity check ───────────────────────────────────────
#
# apps/studio/lib/studio/run-loader.ts reads, and the M6 worker writes,
# `${PLATFORM_DATA_ROOT:-/app/.platform-data}/runs/<runId>.json`. Without
# a Docker volume mounted there, every rebuild discards the entire run
# history (drafts in Postgres survive, runs do not — they're filesystem
# only until the M10 → DB-backed-runs migration completes).
#
# This check is purely diagnostic; it never aborts boot. The goal is to
# leave a single, greppable line in the container logs that an operator
# investigating "where did my runs go?" can find immediately.
DATA_DIR="${PLATFORM_DATA_ROOT:-/app/.platform-data}"
RUNS_DIR="${DATA_DIR}/runs"

mkdir -p "${RUNS_DIR}" 2>/dev/null || true

if [ ! -d "${RUNS_DIR}" ]; then
  echo "[entrypoint] WARN: ${RUNS_DIR} does not exist and could not be created — runs will fail to persist" 1>&2
elif [ ! -w "${RUNS_DIR}" ]; then
  echo "[entrypoint] WARN: ${RUNS_DIR} is not writable by uid=$(id -u) gid=$(id -g)" 1>&2
  echo "[entrypoint] WARN: this usually means a bind-mounted host directory is owned by root" 1>&2
  echo "[entrypoint] WARN: on the host run: chown -R 1001:1001 <host-path-mounted-at-${DATA_DIR}>" 1>&2
else
  # Distinguish a real Docker volume mount from the container's
  # ephemeral overlayfs by reading /proc/self/mounts. Every Docker
  # volume (named or bind) shows up there as a dedicated mountpoint;
  # an unmounted directory does not. This is deterministic across
  # boots — unlike a sentinel marker file, which a single restart
  # would create and falsely report as "persisted" on the next boot
  # of an unmounted container.
  #
  # /proc/self/mounts is readable by the nextjs user without any
  # special capabilities. The grep -F (fixed string) avoids the need
  # to escape dots in the path.
  if grep -qF " ${DATA_DIR} " /proc/self/mounts 2>/dev/null; then
    echo "[entrypoint] INFO: persistent volume detected at ${DATA_DIR}"
  else
    echo "[entrypoint] WARN: NO persistent volume at ${DATA_DIR} — run history will be discarded on the next rebuild" 1>&2
    echo "[entrypoint] WARN: drafts in Postgres survive; runs/products on the filesystem do not" 1>&2
    echo "[entrypoint] WARN: fix: EasyPanel → elfanaa_studio → Mounts → add Volume \`elfanaa_studio_data\` at \`${DATA_DIR}\`" 1>&2
    echo "[entrypoint] WARN: see docs/M12-MOUNT-STUDIO.md §Persistent volume" 1>&2
  fi
fi

# ─── 2. Prisma migrations (opt-in) ───────────────────────────────────────────

if [ "${STUDIO_AUTO_MIGRATE:-false}" = "true" ]; then
  echo "[entrypoint] STUDIO_AUTO_MIGRATE=true — applying pending Prisma migrations"
  if [ -z "${ADMIN_DATABASE_URL}" ]; then
    echo "[entrypoint] ERROR: STUDIO_AUTO_MIGRATE=true but ADMIN_DATABASE_URL is unset" 1>&2
    exit 1
  fi
  # `prisma migrate deploy` is the production-safe verb (no interactive
  # prompts, no schema generation). Exits 0 with "Already in sync" when
  # nothing is pending, non-zero on any apply failure.
  prisma migrate deploy --schema=/app/packages/db/prisma/schema.prisma
  echo "[entrypoint] migrations applied — handing off to ${1}"
fi

# ─── 3. exec CMD ─────────────────────────────────────────────────────────────
# exec replaces this shell with the CMD process so signals reach Node
# directly (no PID-1 shell intercepting SIGTERM during graceful shutdown).
exec "$@"
