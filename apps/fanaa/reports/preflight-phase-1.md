# ELFANAA — Pre-Flight Report · Phase 1 (No-Docker)

Generated: Sunday 3 May 2026, 23:21 UTC+1

---

## Pre-Flight Scoreboard

| # | Check | Pass / Fail | Notes |
|---|---|---|---|
| A1 | Dockerfiles | ⚠ **MINOR ISSUES** | Both multi-stage, non-root runtime USER, correct EXPOSE/NODE_ENV. Two deviations — see Blockers #3 and Polish #1. |
| A2 | docker-compose.yml | ✗ **FAIL** | Healthchecks ✓, named volume ✓, `depends_on` with health conditions ✓. DB credentials and DATABASE_URL **hardcoded** — not injectable from `.env` without editing the file. See Blocker #2. |
| A3 | Env var coverage | ✓ **PASS** | Every `process.env.*` consumed by frontend has a matching entry in `.env.example`. All backend vars documented in `backend/.env.example`. No ghost vars. All six vars called out in the spec confirmed present with correct names and placeholder defaults. |
| A4 | Missing-env failure modes | ⚠ **PARTIAL** | See detail table below. |
| B1 | Frontend production build | ✗ **FAIL** | TypeScript error in `data/upsells.ts:34` — build exits 1. Cannot produce a deployable artefact. See Blocker #1. |
| B2 | Backend venv boot | ✓ **PASS** | `pip install` clean. All three bad-DB boot scenarios fail at startup before serving requests. `/health` endpoint confirmed in code. Local Postgres: ⊘ SKIPPED (Phase 2). |
| B3 | End-to-end order flow | ⊘ **SKIPPED** | B2 Postgres step was skipped; no DB to accept writes against. Phase 2. |
| C1 | README Setup walkthrough | ⚠ **MINOR** | "By hand" step 1 still requires Docker for the database. No Docker-free alternative path. See Polish #5. |
| C2 | README EasyPanel deploy | ⚠ **MINOR** | DNS ✓, ports ✓, env var names ✓. Hardcoded default password not flagged as needing replacement. No backup guidance. See Blockers #2 and Polish #4. |
| C3 | README Pixel + Webhook docs | ✓ **PASS** | Every env var name in the README exactly matches the name consumed by code (case-sensitive). Zero mismatches. |

---

## A4 — Missing-env failure mode detail

| Scenario | Observed behaviour | Verdict |
|---|---|---|
| `DATABASE_URL` unset | Config uses hardcoded default → attempts to connect to `elfanaa_database` → fails at `run_migrations()` during lifespan. Process exits before serving any request. | ✓ Boot-time fail — but no clear "DATABASE_URL not configured" message; error is a raw SQLAlchemy connection traceback. |
| `DATABASE_URL` = malformed string | SQLAlchemy fails to parse the URL at module-import time → uvicorn exits before binding to the port. | ✓ Pre-boot fail — very loud. |
| `DATABASE_URL` = unreachable host | Fails at `run_migrations()` with a connection timeout. Boot-time fail. | ✓ |
| `NEXT_PUBLIC_API_BASE_URL` unset | `apiUrl()` returns the path unchanged; storefront falls back to its own `/api/orders` Next.js route. Zero crashes. | ✓ Graceful fallback. |
| All pixel IDs unset | `bootPixels()` guards every init behind `if (ids.meta)` / `if (ids.tiktok)` / `if (ids.snapchat)`. No-op. | ✓ Completely safe. |
| `WEBHOOK_URL` unset | `dispatch_signed(url=None, ...)` returns `{"ok": True, "skipped": True}`. Order succeeds, webhook step logs nothing (no "skipped" log line, just silently no-ops). | ✓ Order safe. ⚠ Skipped silently — no log. |

---

## Blockers

### Blocker 1 — TypeScript error kills the production build

**File:** `data/upsells.ts` line 34
**Severity:** BLOCKER — `npm run build` exits 1; EasyPanel will build from source and fail.

```
Type error: Argument of type '(Product | undefined)[]' is not
assignable to parameter of type '{ id: string; }[]'.
```

**Root cause:** `getProductById()` returns `Product | undefined`. Line 34 calls it inside `flatMap`, producing `(Product | undefined)[]`, which is passed to `dedupeById<T extends { id: string }>` — the constraint rejects `undefined`. The runtime guard (`if (!it || ...)` inside `dedupeById`) correctly handles it; the type signature doesn't.

**Proposed fix:**

```typescript
// Change dedupeById signature (line 67) from:
function dedupeById<T extends { id: string }>(items: T[]): T[]
// to:
function dedupeById<T extends { id: string }>(items: (T | undefined)[]): T[]
```

The body already handles `undefined` with `if (!it || seen.has(it.id)) continue;` — only the signature needs updating.

---

### Blocker 2 — Hardcoded DB credentials in docker-compose.yml

**File:** `docker-compose.yml` lines 26–27 and 53
**Severity:** BLOCKER for production security.

```yaml
POSTGRES_PASSWORD: elfanaa          # line 27 — hardcoded, cannot be overridden via .env
DATABASE_URL: postgresql+asyncpg://elfanaa:elfanaa@...   # line 53 — same
```

Any EasyPanel deployment using this compose file directly ships the `elfanaa`/`elfanaa` credentials. EasyPanel's env-var injection overrides `${VAR}` substitutions but cannot override hardcoded literal values.

**Proposed fix:**

```yaml
# elfanaa_database service:
POSTGRES_DB: elfanaa
POSTGRES_USER: elfanaa
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-elfanaa}

# elfanaa_api service:
DATABASE_URL: ${DATABASE_URL:-postgresql+asyncpg://elfanaa:elfanaa@elfanaa_database:5432/elfanaa}
CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost:3000,https://elfanaa.com}
```

Add `POSTGRES_PASSWORD=<strong>` and `DATABASE_URL=<updated>` to both `.env.example` files with a warning comment.

---

### Blocker 3 — Backend runtime stage missing `APP_ENV=production`

**File:** `backend/Dockerfile`, runtime stage (no ENV instruction)
**Severity:** MAJOR — backend boots in `development` mode in production.

The runtime stage has no `ENV APP_ENV=production`. `config.py` defaults to `app_env = "development"`, which means:

- FastAPI `/docs` and `/openapi.json` are **publicly exposed** (`docs_url="/docs" if settings.is_dev else None`).
- SQLAlchemy `echo=True` logs every SQL statement to stdout.

**Proposed fix:** Add to the backend runtime stage:

```dockerfile
ENV APP_ENV=production \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
```

(The python env flags are already in the builder stage but not carried to the runtime stage — add them back here.)

---

## Polish Backlog

1. **Floating base image tags** — `node:22-alpine` and `python:3.12-slim` are major-version tags. They will silently drift as patch versions roll. Pin to exact versions (`node:22.15.0-alpine3.21`, `python:3.12.11-slim`) or use digest-pinned `@sha256:...` references for fully reproducible builds.

2. **DATABASE_URL config default** — `config.py` line 51 has a hardcoded default `database_url: str = "postgresql+asyncpg://..."`. If DATABASE_URL is unset in production, the app won't fail at config load time — it silently picks up the default and then fails later with a raw connection traceback. A `@field_validator` that raises a clear `ValueError("DATABASE_URL must be set explicitly in production")` when `app_env == "production"` would make misconfiguration immediately obvious.

3. **Webhook skip logging** — `dispatch_signed(url=None, ...)` returns `{"ok": True, "skipped": True}` silently. A `log.debug("webhook skipped — no URL configured for ...")` would make ops dashboards easier to read.

4. **EasyPanel docs missing password warning** — The README's EasyPanel section shows `DATABASE_URL=postgresql+asyncpg://elfanaa:elfanaa@...` without any `⚠ change the password` annotation. A single line noting "replace `elfanaa:elfanaa` with a strong password in EasyPanel's env-var UI" would prevent an operator deploying with defaults.

5. **Docker-free local dev path missing** — The README "by hand" section requires Docker for step 1 (database). There's no guidance for developers who want to run against a locally-installed Postgres without Docker. A one-liner (`createdb elfanaa && psql -c "CREATE USER elfanaa WITH PASSWORD 'elfanaa';"`) would close the gap.

6. **`elfanaa_web` compose service has no explicit healthcheck block** — The liveness check lives in the Dockerfile `HEALTHCHECK` directive, which compose inherits implicitly. An explicit `healthcheck:` block in compose makes it visible alongside the other two services and allows `depends_on: condition: service_healthy` if a fourth service were ever added that needed to wait for the web tier.
