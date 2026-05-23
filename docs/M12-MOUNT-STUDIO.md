# M12 — Mount Studio at `elfanaa.com/studio`

This guide explains how to put the Studio app behind the storefront so
that `https://elfanaa.com/studio` serves the AI Studio while everything
else on `elfanaa.com` keeps serving the live storefront.

The mount is implemented in two pieces:

| Piece | What it does | Where |
|------|------|------|
| Studio `basePath` | Tells the Studio Next.js app that **its own root is `/studio`** — links, assets, manifests, redirects all bake in the prefix. | `apps/studio/next.config.mjs`, build arg `NEXT_PUBLIC_STUDIO_BASE_PATH` |
| Storefront `rewrites()` proxy | Tells the storefront's Next.js to forward `/studio` and `/studio/*` requests to the internal Studio service URL. | `apps/fanaa/next.config.mjs`, env var `STUDIO_INTERNAL_URL` |

Both are env‑gated. When the two env vars are unset, behaviour is
identical to M11 (Studio at root, storefront serves its own 404 for
`/studio`).

---

## TL;DR — production rollout (EasyPanel)

Set these three env / build args, redeploy both services, then visit
`https://elfanaa.com/studio`.

### Studio service (EasyPanel)

| Tab | Key | Value |
|-----|-----|-------|
| Build Arguments | `NEXT_PUBLIC_STUDIO_BASE_PATH` | `/studio` |
| Environment Variables | `NEXT_PUBLIC_STUDIO_BASE_PATH` | `/studio` |
| Environment Variables | (already set from M10) `STUDIO_PERSISTENCE_MODE`, `ADMIN_DATABASE_URL`, `STORAGE_DRIVER`, `R2_*`, `STUDIO_EMAIL`, `STUDIO_PASSWORD_HASH`, `STUDIO_JWT_SECRET` | unchanged |
| Mounts | Volume mount | Host/Volume: `elfanaa_studio_data` · Container path: `/app/.platform-data` |

Rebuild the Studio service after setting the build arg — basePath is
inlined at build time, not runtime.

> **CRITICAL: the `/app/.platform-data` mount.** Without it, every Studio
> rebuild discards the entire run history. The M6 worker writes runs to
> `.platform-data/runs/<runId>.json` on the container's writable layer,
> which Docker throws away when the image is replaced. Symptoms of a
> missing mount: `/studio/runs` shows "No runs yet" after a rebuild,
> direct run URLs return 404, and the "Replay run" button vanishes.
> Drafts are unaffected because they're stored in Postgres. See the
> dedicated [Persistent volume](#persistent-volume) section below.

### Storefront service (EasyPanel)

| Tab | Key | Value |
|-----|-----|-------|
| Environment Variables | `STUDIO_INTERNAL_URL` | `http://elfanaa_studio:3000` (or the internal hostname your EasyPanel assigns the Studio service — see "Internal URL" in the Studio service overview) |

EasyPanel automatically forwards every entry in "Environment Variables"
as a Docker `--build-arg`, and `apps/fanaa/Dockerfile` declares the
matching `ARG STUDIO_INTERNAL_URL`. **Rebuild** the storefront service
after adding the env var (not just restart) — `rewrites()` is evaluated
inside `next build` and baked into `.next/routes-manifest.json`. The
standalone server reads the manifest at boot and never re-evaluates
rewrites(), so setting the env var without rebuilding leaves the
rewrite array empty and `/studio` 404s.

After the build completes, the build log should contain:

```
[build] STUDIO_INTERNAL_URL=http://elfanaa_studio:3000
```

An empty value there is the canonical cause of the `/studio` 404.

### Verify

```
curl -I https://elfanaa.com/studio
# Expected: 307 redirect to /studio/login or /studio/drafts
```

Open `https://elfanaa.com/studio` in a browser. You should:

1. Land on the Studio login screen at `/studio/login` (path-prefixed).
2. After signing in, get redirected to `/studio/drafts`.
3. Browser DevTools → Application → Cookies: `_fa_studio` cookie has
   `Path: /studio` (scoped to the sub-path; never sent to storefront
   pages).
4. Network tab: every Studio API call goes to
   `https://elfanaa.com/studio/api/...` (no leakage to the storefront's
   `/api/...` namespace).
5. The storefront homepage `https://elfanaa.com/` still serves the
   storefront — no regressions.

---

## Alternative: route directly via Traefik (no storefront rewrite)

If you prefer the storefront and Studio to be fully decoupled at the
HTTP level (no Next.js reverse proxy), leave `STUDIO_INTERNAL_URL`
UNSET on the storefront and add this Traefik rule (EasyPanel → Studio
service → Domains tab):

```
Host: elfanaa.com
Path Prefix: /studio
Strip Prefix: NO          ← do not strip; the Studio app expects the
                            prefix because basePath = /studio
```

Either approach works. The reverse-proxy default keeps everything in
one config file (`apps/fanaa/next.config.mjs`); the Traefik approach
keeps the two apps fully independent at runtime.

---

## Local development with the mount

`docker compose up --build` now builds the Studio image with
`NEXT_PUBLIC_STUDIO_BASE_PATH=/studio` by default (see
`docker-compose.yml`) and wires `STUDIO_INTERNAL_URL` to the docker
network address of the Studio service.

```powershell
# Standard up:
docker compose up --build

# Then:
#   http://localhost:3000/studio          → Studio login (proxied via web)
#   http://localhost:3001/studio          → Studio direct (bypasses proxy)
#   http://localhost:3000/                → Storefront homepage (unchanged)
```

To go back to the M2-M11 layout (Studio at root, on its own subdomain),
either:

* Set `NEXT_PUBLIC_STUDIO_BASE_PATH=` (empty) in `.env` before
  `docker compose up --build`, **and** unset `STUDIO_INTERNAL_URL`, OR
* Point `studio.elfanaa.com` at the Studio service directly in EasyPanel
  with no path prefix and unset `STUDIO_INTERNAL_URL` on the storefront.

---

## Cookie scope note

`_fa_studio` (the Studio JWT cookie) is now set with `Path: /studio`
when the mount is active. Effects:

* Storefront pages never receive the cookie — defence-in-depth on top
  of `HttpOnly`, `Secure`, `SameSite=Lax`.
* Logging out clears the cookie using the **same** path, so the browser
  actually removes it (cookies with different paths are distinct).

If you switch deployment layouts (e.g. move Studio from `/studio` to a
subdomain), the operator must log in again — old cookies live at the
old path and will not be sent to the new location. This is by design.

---

## Rollback

Single env‑var flip — no code revert needed:

```
# In the storefront service:
unset STUDIO_INTERNAL_URL
# In the Studio service:
unset NEXT_PUBLIC_STUDIO_BASE_PATH      (then redeploy: build arg is
                                          inlined at build time)
```

Both apps revert to M11 behaviour automatically. The mount logic is
fully additive in source and gated by env at runtime + build time.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `elfanaa.com/studio` → storefront 404 | Storefront was only **restarted** after setting `STUDIO_INTERNAL_URL`, not **rebuilt**. `rewrites()` is baked at build time; the runtime env var alone has no effect. | Trigger a full rebuild in EasyPanel. Confirm by grepping the build log for `[build] STUDIO_INTERNAL_URL=` — empty value means Docker didn't receive the build arg (check the `ARG STUDIO_INTERNAL_URL` line still exists in `apps/fanaa/Dockerfile`). |
| `elfanaa.com/studio` → 502 / `ECONNREFUSED` | `STUDIO_INTERNAL_URL` points to a hostname the storefront container can't resolve. | In EasyPanel, copy the Studio service's "Internal URL" exactly. On Docker compose use the service name `elfanaa_studio` (not `localhost`). |
| Studio CSS / JS 404s in DevTools | Studio was built without the basePath build arg. | Set `NEXT_PUBLIC_STUDIO_BASE_PATH=/studio` in the Studio service's Build Arguments tab and rebuild. |
| Login loops back to `/studio/login` | `_fa_studio` cookie is scoped to a different path than the basePath (typically left over from an old `/` mount). | Clear cookies for `elfanaa.com` in the browser. |
| Storefront `/admin` or analytics broken | Should not happen — the M12 changes do not touch storefront business logic. | If it does, set `STUDIO_INTERNAL_URL=` (empty) to disable the rewrite; the storefront returns to its exact M11 behaviour. |
| `/studio/runs` shows "No runs yet" after a rebuild · direct run URL returns 404 · "Replay run" button vanishes | No persistent volume is mounted at `/app/.platform-data`. The M6 worker writes runs to the container's writable layer, which Docker discards on every image replacement. Drafts survive because they're in Postgres. | See [Persistent volume](#persistent-volume) below — add the mount in EasyPanel → elfanaa_studio → **Mounts**. The lost runs are unrecoverable; future runs persist correctly. The entrypoint logs `[entrypoint] INFO: persistent volume detected at /app/.platform-data` on every healthy boot. |

---

## Persistent volume

The M6 worker persists every pipeline execution to
`.platform-data/runs/<runId>.json` on the Studio container's filesystem,
and `apps/studio/lib/studio/run-loader.ts` reads them back from there
for both the `/studio/runs` list and the `/studio/runs/[id]` detail
page. Without a Docker volume mounted at that path, **every rebuild
discards the entire run history**:

* `/studio/runs` shows "No runs yet"
* direct run URLs return 404
* the "Replay run" button disappears from the UI
* drafts orphan from their producer run record (the draft survives in
  Postgres, but the run that produced it is gone)

> Drafts are stored in Postgres via `@platform/persistence` and survive
> rebuilds regardless of this mount. Runs are filesystem-only until the
> M10-to-M13 dual-read migration completes — for now, the volume is
> mandatory.

### EasyPanel setup (one-time)

1. Open EasyPanel → **elfanaa_studio** service → **Mounts** tab.
2. Click **Add Mount** and choose **Volume** (not File / not Bind).
3. Name: `elfanaa_studio_data` · Container path: `/app/.platform-data`
4. Save and **redeploy** the service (a plain restart is not enough —
   Docker only resolves new mounts on container creation).
5. Verify in the **Logs** tab — on a healthy boot you will see one of:

   ```
   [entrypoint] INFO: ${DATA_DIR} is empty (fresh mount or first boot)
   ```

   (first ever boot against this volume) followed on subsequent boots
   by:

   ```
   [entrypoint] INFO: persistent volume detected at /app/.platform-data (initialised 2026-05-23T18:00:00Z)
   ```

   If you instead see:

   ```
   [entrypoint] WARN: /app/.platform-data/runs is not writable by uid=1001 gid=1001
   ```

   the mount is a root-owned bind mount. SSH into the host and run:

   ```
   chown -R 1001:1001 <host-path-mounted-at-/app/.platform-data>
   ```

   Named volumes (the recommended path above) avoid this entirely
   because Docker copies the directory's nextjs:nodejs ownership from
   the Dockerfile's pre-created `/app/.platform-data` into the volume
   on first init.

### Local development

`docker-compose.yml` already declares `elfanaa_studio_data` as a named
volume and mounts it at `/app/.platform-data`. `docker compose down`
keeps the volume; `docker compose down -v` wipes it (equivalent of a
fresh deployment).

### Recovering after this has already happened

There is no recovery for runs lost to a missing mount — they were never
written to a durable store. You have two options:

1. **Accept the loss**, add the mount as above, and start fresh. All
   future runs persist. Drafts that orphan from their (now missing)
   producer run remain editable in `/studio/drafts` — only the
   replay-from-source-run path is broken for them.
2. **Re-run the affected products** by dispatching new intake jobs.
   `/studio/intake` accepts the same supplier URL again and produces a
   new run that's persisted to the volume.
