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

Rebuild the Studio service after setting the build arg — basePath is
inlined at build time, not runtime.

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
