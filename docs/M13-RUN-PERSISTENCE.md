# M13 — Postgres-first runs read path

This change makes the Studio's `/runs` browser, run detail page, and
replay action **read run records from Postgres first**, falling back to
the filesystem only for historical runs or dev environments without a
database. The write path remains the M10 `CompositeRunStore` dual-write
(file primary + Postgres mirror) so the SSE live-tail watcher keeps
working.

## Why this change exists

Two production data losses in three days motivated the structural fix:

1. **EasyPanel rebuilds discard data on `/app/.platform-data`** in some
   configurations. Even with a named volume attached, certain rebuild
   modes recreate the underlying storage. Filesystem-only persistence
   for the run history was always going to be fragile under managed
   hosts.
2. **A silent cwd mismatch** ensured writes never reached the mounted
   volume anyway. Next.js's standalone server bootstrap chdirs into
   `/app/apps/studio` before exec'ing the user code, so
   `process.cwd() + ".platform-data"` resolved to
   `/app/apps/studio/.platform-data` — a directory on the ephemeral
   overlayfs, **NOT** the volume at `/app/.platform-data`. Every run
   written was lost on the next rebuild regardless of mount state.

The cwd trap is fixed via `ENV PLATFORM_DATA_ROOT=/app/.platform-data`
baked into `apps/studio/Dockerfile`. But making runs durable requires
DB-first reads — that's M13.

## What changed

| Component | Before | After |
|-----------|--------|-------|
| `apps/studio/lib/studio/run-loader.ts` | Read every run from `<cwd>/.platform-data/runs/*.json` | Read from `StudioRunRepository.listAll()`; merge with filesystem fallback for legacy runs |
| `apps/studio/lib/studio/replay-action.ts` | `FileStore(runsRoot()).getRun(runId)` for prior-run lookup | DB-first via `StudioRunRepository.loadForReplay()`, falls back to filesystem |
| `packages/persistence/src/repositories/run.ts` | `findByRunId`, `listForDraft`, `loadForReplay` | Same, plus new `listAll({ take })` to power the runs browser |
| `apps/studio/Dockerfile` | Cwd-relative writes silently misrouted | `ENV PLATFORM_DATA_ROOT=/app/.platform-data` forces absolute resolution |
| `docker-compose.yml` | `STUDIO_PERSISTENCE_MODE` defaulted to empty (file-only) | Defaults to `dual` so dual-write is on out of the box |

The public surface of `run-loader.ts` is **unchanged**: `listRuns()`
still returns `RunSummary[]`, `readRun(runId)` still returns
`RunLoadResult`. Every consumer — pages, API routes, the replay action
— works without edits.

## Behaviour matrix

| `STUDIO_PERSISTENCE_MODE` | `ADMIN_DATABASE_URL` set? | Read source | Write target |
|---------------------------|---------------------------|-------------|--------------|
| `dual` (default) | yes | DB first, file fallback | DB + file |
| `dual` | no | File only (warning logged) | File only |
| `file` | irrelevant | File only | File only |
| unset | irrelevant | Treated as `dual` per docker-compose default | DB + file (if DB reachable) |

## Rollout

Existing deployments need no special action:

1. **Pull `master` and rebuild** the Studio service.
2. **Verify `STUDIO_PERSISTENCE_MODE=dual`** is set (it now defaults
   via `docker-compose.yml`, but EasyPanel deployments set env vars
   explicitly — confirm in Service → Environment Variables).
3. **Verify `ADMIN_DATABASE_URL`** points at the same Postgres that
   holds the `studio_*` tables.
4. **Sanity-check from the container shell** after first boot:

   ```sh
   echo "PLATFORM_DATA_ROOT=${PLATFORM_DATA_ROOT}"
   echo "STUDIO_PERSISTENCE_MODE=${STUDIO_PERSISTENCE_MODE}"
   ls /proc/1/cwd        # should resolve via PLATFORM_DATA_ROOT, not cwd-relative
   ```

5. **Trigger a fresh intake** to confirm the new run lands in BOTH
   the volume (`ls /app/.platform-data/runs/`) AND Postgres
   (`SELECT count(*) FROM studio_run` from the DB shell).

6. **Rebuild once more** with no code change. The run should remain
   visible in `/studio/runs` — that's the M13 success signal.

## Recovering pre-M13 runs

Runs that were lost to the cwd trap before M13 are unrecoverable —
they were never written to the volume or to Postgres because the
writes hit the ephemeral overlay layer.

Runs that exist on the volume but not in Postgres (because
`STUDIO_PERSISTENCE_MODE` was unset prior to this change) remain
visible in `/studio/runs` via the filesystem-fallback merge — they
just aren't backed by Postgres. To migrate them into Postgres,
trigger a single replay per run: the replay's dual-write CompositeRunStore
will create the DB rows as a side effect.

## What's NOT changed

- The worker still writes to the filesystem first via `FileStore` —
  the SSE live-tail watcher (`run-watcher.ts`) keeps working without
  modification, and the file write is still the synchronous-success
  contract for the pipeline orchestrator.
- The `studio_run` / `studio_step` schema is unchanged — M10's tables
  are sufficient, no migrations needed.
- The runs API surface (`/api/studio/runs`, `/api/studio/runs/[runId]`)
  is unchanged.
- Drafts, assets, products: unchanged. They were already DB-backed
  via the dedicated repositories.

## Rollback

If the DB-first read path causes issues, set
`STUDIO_PERSISTENCE_MODE=file` on the Studio service and redeploy.
The loader detects the absence of dual-write configuration and
degrades to file-only reads — exactly the pre-M13 behaviour. No code
revert needed.

Note that with `file` mode, the cwd trap still bites unless the
`PLATFORM_DATA_ROOT` env (now baked into the Dockerfile) is also
unset. Leave it set — there's no scenario where you want the worker
writing to a path that isn't your mounted volume.
