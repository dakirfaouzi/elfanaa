#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Studio container entrypoint.
#
# Two responsibilities:
#   1. Optionally apply pending Prisma migrations to ADMIN_DATABASE_URL
#      before the Next.js server starts.
#   2. exec() the original CMD so PID 1 ends up as the Node process
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

# exec replaces this shell with the CMD process so signals reach Node
# directly (no PID-1 shell intercepting SIGTERM during graceful shutdown).
exec "$@"
