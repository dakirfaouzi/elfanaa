# M10 — Manual Setup Guide

This guide documents the **operator-side steps** required to activate
the Postgres + Cloudflare R2 persistence layer shipped in M10. Without
running these steps the Studio continues to operate exactly as it did
in M9 (file-backed run records under `.platform-data/runs/`, in-memory
media store, no draft / asset rows). The system is **safe by default**:
M10 ships behind two opt-in env switches.

> **Reading time**: ~10 minutes. **Total operator time**: ~30 minutes
> end-to-end (mostly waiting for Cloudflare DNS).

---

## What M10 unlocks once activated

| Capability | Default (M9 behaviour) | After M10 activation |
|---|---|---|
| Run records | File only (`.platform-data/runs/`) | File + Postgres (`studio_run`, `studio_step`) |
| Draft persistence | None | One `studio_draft` row per intake |
| Asset uploads | None | Browser → presigned PUT → R2 → `studio_asset` row |
| Asset browser | n/a | `GET /api/studio/drafts/<id>/assets` lists from DB |
| Replay loading | File only | File OR `StudioRunRepository.loadForReplay` from Postgres |
| Audit trail | None | `studio_event` rows for `draft.created`, `run.dispatched`, … |

All M9 behaviour stays byte-stable; the Studio SSE watcher still tails
the file primary so live progress UI is unchanged.

---

## Prerequisites

Before starting:

* You have an admin user on the **existing** Postgres instance (the one
  `apps/fanaa` already reads via `ADMIN_DATABASE_URL`). M10's migration
  is purely **additive** — it never modifies existing analytics tables.
* You have access to the **Cloudflare account** that owns
  `elfanaa.com`. R2 is enabled per-account; M10 shares the same
  account as the storefront's CDN per PLATFORM.md §1.
* You can edit environment variables in **EasyPanel** (or whichever
  deployment surface you use).

---

## Step 1 — Apply the Postgres migration

The migration SQL is committed at:

```
packages/db/prisma/migrations/0002_studio_tables/migration.sql
```

It creates **seven tables** + **five enums**, all prefixed `studio_`.
No existing tables are altered. No data is touched. Reviewing diff
in your favourite SQL editor is encouraged but not required.

### 1a — Backup first (always)

```bash
pg_dump -h <host> -U <user> -d <database> -Fc -f backup-pre-m10.dump
```

### 1b — Apply via `prisma migrate deploy`

**Three options** depending on how you reach the database:

#### Option A — From your developer machine (DB reachable externally)

```bash
export ADMIN_DATABASE_URL='postgresql://<user>:<pass>@<host>:5432/<database>'
pnpm --filter @platform/db exec prisma migrate deploy --schema=prisma/schema.prisma
```

#### Option B — Auto-apply on Studio container start (recommended for EasyPanel internal DBs)

The Studio runtime image ships with the Prisma CLI + the
`packages/db/prisma/migrations/` directory, and an entrypoint
(`apps/studio/docker-entrypoint.sh`) that conditionally runs
`prisma migrate deploy` before starting the Next.js server.

EasyPanel → Services → **elfanaa_studio** → **Environment Variables**:

| Key | Value |
|---|---|
| `STUDIO_AUTO_MIGRATE` | `true` |

Restart the Studio service. On the next boot you should see in the
Studio runtime logs:

```
[entrypoint] STUDIO_AUTO_MIGRATE=true — applying pending Prisma migrations
...
The following migration(s) have been applied:
  └─ 0002_studio_tables/
[entrypoint] migrations applied — handing off to node
▲ Next.js 15.5.x  Ready in ...
```

Idempotent — Prisma's `_prisma_migrations` tracking table skips any
migration already applied, so leaving `STUDIO_AUTO_MIGRATE=true` on
permanently is safe and adds ~30ms to hot restarts. **This is the
right option for the EasyPanel internal Postgres** because the DB
isn't reachable from outside the Docker network.

#### Option C — Manual from inside the running Studio container

EasyPanel → Services → **elfanaa_studio** → **Shell** tab:

```sh
prisma migrate deploy --schema=/app/packages/db/prisma/schema.prisma
```

Reads `ADMIN_DATABASE_URL` from the container env automatically.

**All three options** produce the same end state:

```
The following migration(s) have been applied:

migrations/
  └─ 0002_studio_tables/
    └─ migration.sql
```

### 1c — Verify

```sql
\dt studio_*
```

You should see seven tables:

* `studio_store`
* `studio_draft`
* `studio_run`
* `studio_step`
* `studio_artifact`
* `studio_asset`
* `studio_event`

> **Rollback** (only if absolutely needed): `DROP TABLE
> studio_event, studio_asset, studio_artifact, studio_step,
> studio_run, studio_draft, studio_store CASCADE;` followed by
> `DROP TYPE studio_asset_source, studio_step_status,
> studio_run_status, studio_draft_status, studio_store_status;`.

### 1d — Recovering from a corrupted `_prisma_migrations` history

If at any point you see this combination in the Studio runtime logs:

```
The table `public.studio_draft` does not exist in the current database.
...
[entrypoint] STUDIO_AUTO_MIGRATE=true — applying pending Prisma migrations
...
No pending migrations to apply.
```

…the database's `_prisma_migrations` tracking table thinks the migrations
are applied, but the tables aren't physically there. Two common ways to
end up here:

1. Someone previously ran `prisma migrate resolve --applied <name>`
   against the wrong database. `--applied` only updates the tracking
   table; it never executes the SQL. Migrating to a different DB and
   re-running `--applied` doesn't create the tables on the new DB.
2. The tables were created once, then dropped (e.g. during a manual
   schema cleanup or a partial `pg_restore`), without also clearing
   the matching `_prisma_migrations` rows.

Prisma 6 refuses `prisma migrate resolve --rolled-back` on migrations it
records as successfully applied (you'll see `P3012: Migration ... is not
in a failed state`). The supported recovery is to delete the bogus
tracking rows directly, then re-deploy. From the Studio Shell:

```sh
echo "DELETE FROM _prisma_migrations WHERE migration_name IN ('0002_studio_tables', '0003_studio_published_product');" \
  | prisma db execute --stdin --schema=/app/packages/db/prisma/schema.prisma

prisma migrate deploy --schema=/app/packages/db/prisma/schema.prisma
```

`prisma db execute` uses the same connection setup as the running app —
no risk of hitting the wrong DB. After the second command prints "All
migrations have been successfully applied", restart the Studio service
(not rebuild — only the DB state changed) and the drafts page renders.

The Prisma upstream docs cover this scenario at
<https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing>.

---

## Step 2 — Create the Cloudflare R2 bucket

### 2a — Create the bucket

In the Cloudflare dashboard → **R2 → Create bucket**:

| Field | Value |
|---|---|
| Bucket name | `fanaa-assets` |
| Location hint | `Automatic` (or `WEUR` if you want EU residency) |

### 2b — Create an R2 API token

Cloudflare dashboard → **R2 → Manage R2 API Tokens → Create API Token**:

| Field | Value |
|---|---|
| Token name | `studio-platform-m10` |
| Permissions | **Object Read & Write** |
| Bucket | `fanaa-assets` only |
| TTL | 90 days (rotate quarterly) |

Copy and save:

* **Access Key ID** (32-char string)
* **Secret Access Key** (64-char string)
* **Account ID** (visible at the top-right of any R2 page —
  32-char lowercase hex)

### 2c — (Optional) Public CDN subdomain

If you want public asset URLs (rather than presigned GETs every time):

1. R2 bucket → **Settings → Public access → Connect Custom Domain**.
2. Add subdomain `cdn.elfanaa.com` (or your equivalent).
3. Cloudflare will create the DNS record automatically.
4. Wait ~5 minutes for SSL provisioning.

If you skip this step, the asset browser falls back to time-bounded
presigned GETs — slightly slower for hot images but secure.

### 2d — (Recommended) Lifecycle rule for archival cleanup

R2 bucket → **Settings → Object lifecycle rules → Create rule**:

| Field | Value |
|---|---|
| Rule name | `archive-old-drafts` |
| Prefix | `studio/` |
| Days after upload | `180` |
| Action | `Delete object` |

This auto-deletes assets from drafts that were never published after
six months. Matches PLATFORM.md §14.

---

## Step 3 — Set environment variables

### Required for dual-write to Postgres

| Variable | Value | Notes |
|---|---|---|
| `STUDIO_PERSISTENCE_MODE` | `dual` | Default `file`. Set to `dual` to opt in. |
| `ADMIN_DATABASE_URL` | `postgresql://...` | Already exists for the existing dashboard. |
| `DATABASE_URL` | (optional) `postgresql://...` | Connection pool URL. Falls back to `ADMIN_DATABASE_URL` when unset. |

### Required for R2 media storage

| Variable | Value | Notes |
|---|---|---|
| `STORAGE_DRIVER` | `r2` | Default `memory`. Set to `r2` to opt in. |
| `R2_ACCOUNT_ID` | 32-char hex | From step 2b. |
| `R2_ACCESS_KEY_ID` | 32-char string | From step 2b. |
| `R2_SECRET_ACCESS_KEY` | 64-char string | From step 2b. |
| `R2_BUCKET_FANAA` | `fanaa-assets` | From step 2a. |
| `R2_PUBLIC_BASE_URL_FANAA` | `https://cdn.elfanaa.com` | (optional) from step 2c. |

### EasyPanel placement

Set them under **Studio app → Environment → Variables**. Mark all R2
secrets as **secret** so they don't appear in build logs.

---

## Step 4 — Restart the Studio app

```bash
# EasyPanel
easypanel restart app=studio

# or locally
pnpm --filter studio dev
```

**Expected boot log lines** (with `dual + r2` mode):

```
[studio_persistence] config persistence.mode=dual prismaUrl=postgresql://... r2.driver=r2 buckets=fanaa
```

If you see **degradation warnings** in the log:

```
[studio_persistence] degrading to file-only (no DATABASE_URL)
[studio_persistence] degrading to memory (R2_* incomplete)
```

— double-check your env vars; the Studio is **still running** but using
the M9 file-only path.

---

## Step 5 — Smoke test

### 5a — Intake → DB write

1. Open the Studio at `/intake`.
2. Submit a test product (supplier URL + 1 image URL is enough).
3. Connect to Postgres and run:

   ```sql
   SELECT id, store_id, slug, status, supplier_url FROM studio_draft
   ORDER BY created_at DESC LIMIT 5;
   ```

You should see a fresh row with `status = 'intake'`. The corresponding
`studio_run` row is created shortly after when the pipeline starts.

### 5b — Asset presign → R2 PUT

```bash
curl -X POST \
  https://studio.your-domain.com/api/studio/drafts/<DRAFT_ID>/assets/presign \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <your-studio-jwt-cookie>' \
  -d '{
    "source": "upload",
    "contentType": "image/png",
    "bytes": 12345
  }'
```

Response:

```json
{
  "intent": { ... },
  "presigned": {
    "url": "https://acct.r2.cloudflarestorage.com/fanaa-assets/...",
    "method": "PUT",
    "headers": { "content-type": "image/png" },
    "expiresAt": "2026-05-22T11:00:00.000Z",
    "ref": { "bucket": "fanaa-assets", "key": "studio/<DRAFT_ID>/upload/...", ... }
  }
}
```

Issue the actual PUT:

```bash
curl -X PUT \
  '<the presigned URL>' \
  -H 'Content-Type: image/png' \
  --data-binary @./test.png
```

Expect `200 OK`. Verify in R2: the object should appear under
`studio/<DRAFT_ID>/upload/<ulid>.png`.

### 5c — Asset list

```bash
curl https://studio.your-domain.com/api/studio/drafts/<DRAFT_ID>/assets \
  -H 'Cookie: <your-studio-jwt-cookie>'
```

> **Note**: M10 does NOT auto-create the `studio_asset` row from the
> presigned PUT. The confirm endpoint that writes the row lands in
> M11; M10 ships only the presign + list APIs. So the list will
> return an empty array until M11 is in place.

---

## Failure modes & recovery

| Symptom | Cause | Fix |
|---|---|---|
| `env_invalid:ADMIN_DATABASE_URL:must_be_postgres_url` | URL doesn't start with `postgresql://` | Fix the env var. |
| `studio_persistence_env_invalid:R2_ACCOUNT_ID:must_be_32_char_hex` | Account ID wrong length | Re-copy from Cloudflare dashboard. |
| Boot log shows `degrading to file-only` even after setting all vars | `STUDIO_PERSISTENCE_MODE` is not exactly `dual` | Case-sensitive; must be lowercase. |
| Boot log shows `degrading to memory` with `R2_*` missing | One R2 var is unset or empty | Check all four mandatory R2 vars. |
| Presign returns `503 bucket_missing` | `R2_BUCKET_FANAA` is unset | Set the env + redeploy. |
| R2 PUT returns 403 | API token doesn't include the bucket OR token expired | Re-issue token in Cloudflare dashboard. |
| `studio_run` rows accumulate but file `.platform-data/runs/` is empty | Reverse condition — file primary not writing | Filesystem permissions on the data root. |

---

## Rollback (full M10)

If you need to roll back the M10 feature without losing data:

1. Flip the two env vars back:
   * `STUDIO_PERSISTENCE_MODE=file`
   * `STORAGE_DRIVER=memory`
2. Restart Studio. M9 behaviour returns immediately.
3. Postgres tables + R2 bucket stay untouched (they're additive); no
   data loss, no schema reversal needed.

If you need to roll back the **code** as well:

```bash
git revert <M10_COMMIT_SHA>
```

The migration's tables remain but the Studio code that reads them is
gone. The orphaned tables can be dropped later (see step 1c rollback)
when convenient.

---

## What is explicitly NOT yet wired in M10

These items are intentionally deferred. Don't expect them to work:

* Asset upload **confirm endpoint** (writes `studio_asset` row) — M11.
* Asset browser **UI page** at `/drafts/<id>/assets` — M11.
* **Octokit GitHub PR writer** to `apps/fanaa/data/products.ts` — M11.
* **Inngest Cloud** webhook receiver / replay UI — M11.
* `pgvector` extension + `StudioAsset.embedding` column for upsell-match — M12.
* Per-store auto-bucket creation — M11 (when adding the second store).

---

## Help / questions

If activation fails or you observe behaviour not covered above, capture:

1. The boot log lines beginning with `[studio_persistence]`.
2. The first error line from the affected endpoint (intake or presign).
3. The Postgres `studio_*` table counts:

   ```sql
   SELECT 'studio_store' AS t, COUNT(*) FROM studio_store
   UNION ALL SELECT 'studio_draft', COUNT(*) FROM studio_draft
   UNION ALL SELECT 'studio_run', COUNT(*) FROM studio_run
   UNION ALL SELECT 'studio_asset', COUNT(*) FROM studio_asset
   UNION ALL SELECT 'studio_event', COUNT(*) FROM studio_event;
   ```

Share these in the platform incident channel and someone will pair on
the diagnosis.
