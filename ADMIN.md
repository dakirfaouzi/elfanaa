# Fanaa Admin — operations manual

A premium DTC analytics + operations dashboard living inside the storefront's
Next.js app. Built for the GCC luxury wellness niche, mobile-first, additive
to the existing FastAPI + Sheets stack.

This document is the single source of truth for setup, env, deploy, and the
integration boundaries that keep checkout / Sheets / pixels untouched.

---

## TL;DR — first-time setup

```bash
# 1. Set the env vars (.env / platform env tab — same place you set DATABASE_URL)
#    ADMIN_DATABASE_URL  — reuse the existing Postgres; e.g.
#                          postgresql://elfanaa:elfanaa@elfanaa_database:5432/elfanaa
#    ADMIN_EMAIL, ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH), JWT_SECRET
#    ORDERS_WEBHOOK_URL  — point at https://YOUR_DOMAIN/api/admin/ingest/orders
#    WEBHOOK_SECRET      — reuse the existing one /api/orders already uses

# 2. Redeploy. That's it.
docker compose up -d --build           # local
# (or push to EasyPanel — it restarts the services and you're done)

# 3. Visit https://YOUR_DOMAIN/admin/login and sign in.
```

**No manual `prisma migrate` or `psql` step required.** The admin tables are
created automatically by the FastAPI container's lifespan migration on
startup — the same hook that already creates `orders`, `order_items`, and
`order_events`. See *Database migrations* below for the architecture.

---

## What is and isn't touched in production

### Touched (additive, audited)

| File | Change |
|---|---|
| `package.json` | +deps: `prisma`, `@prisma/client`, `jose`, `bcryptjs`, `recharts`, `swr`, `date-fns`, `ua-parser-js` (+ types) |
| `app/providers.tsx` | +1 component mount: `<AnalyticsTracker />` (page-view tracking; no-op outside production env) |
| `lib/pixels/eventId.ts` | Extended `readAttributionCookies()` to also surface `_fa_vid` and `_fa_sid` (same forwarding pattern as `_fbp`/`_fbc`) |
| `components/checkout/CodCheckoutModal.tsx` | +2 lines: include `visitor_id` and `session_id` in the existing `context` payload bag |
| `middleware.ts` | NEW — gates `/admin/*` and `/api/admin/*` only |
| `backend/app/db/migrations.py` | +1 call to `run_admin_migrations(conn)` inside the existing lifespan hook |
| `backend/app/db/admin_migrations.py` | NEW — reads and applies `admin_schema.sql` on every FastAPI boot |
| `backend/app/db/admin_schema.sql` | NEW — idempotent SQL for all admin tables |
| `docker-compose.yml` | +`ADMIN_*` / `MAXMIND_*` env passthrough for the Next.js service |

### Untouched (verified)

`app/api/orders/route.ts`, `app/api/orders/[orderId]/upsell/route.ts`, the
Sheets dispatch path, the FastAPI service, the COD modal logic / pricing /
validation / phone normalisation, the upsell + cross-sell components, all
pixels, the cart store, the locale provider, the storefront routing, the
deployment configs, and every `data/*.ts` file.

---

## Architecture

```
storefront ─┬─ /api/track             (event ingest, MaxMind + UA filter)
            │       ↓
            │   Postgres analytics DB ──→ /admin (dashboard)
            │       ↑
checkout ──→ /api/orders ──→ ORDERS_WEBHOOK_URL ──→ /api/admin/ingest/orders
            │   (HMAC-signed payload)             (HMAC-verified subscriber)
            ↓
        Google Sheets, CRM webhook, shipping webhook (unchanged)
```

### Integration model

* The admin DB is **independent** of the FastAPI orders DB. We never reach
  into the backend's tables. The dashboard's authoritative source for orders
  is the `order_mirror` table populated via the existing signed webhook
  contract — the order ID and customer details mirror what the customer
  already sees on the thank-you page.
* `/api/track` is **non-blocking**. Every call returns `204` immediately;
  storage happens in the background. If Postgres is offline the storefront
  keeps shipping orders to Sheets normally.
* `/api/admin/ingest/orders` always returns `200`. We never let a slow or
  failing analytics DB poison the order-fanout dispatcher.

---

## Environment variables

See `.env.admin.example` for the canonical list. Highlights:

| Var | Required | What it does |
|---|---|---|
| `ADMIN_DATABASE_URL` | ✅ | Postgres conn string for analytics tables. |
| `ADMIN_EMAIL` | ✅ | Email allowed to sign into the admin. |
| `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH` | ✅ | Plain or bcrypt hash. Hash wins if both set. |
| `JWT_SECRET` (or `SESSION_SECRET`) | ✅ | Signs admin session cookie. 32+ random bytes. |
| `MAXMIND_ACCOUNT_ID` + `MAXMIND_LICENSE_KEY` | ⚠ recommended | Enables VPN / proxy / datacenter detection. |
| `WEBHOOK_SECRET` | ✅ | Same value used by `/api/orders`; required for ingest HMAC. |
| `ORDERS_WEBHOOK_URL` | ✅ | Set to `https://YOUR_DOMAIN/api/admin/ingest/orders`. |
| `ADMIN_ALLOWED_COUNTRIES` | ❌ | Default `SA,AE,KW,QA,BH,OM,YE`. |
| `ADMIN_QUALITY_THRESHOLD` | ❌ | Default `60` / 100. |
| `ADMIN_AUTH_COOKIE` | ❌ | Default `_fa_admin`. |

Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Generate a password hash (recommended for production):

```bash
npm run admin:hash-password "your-strong-password"
```

---

## Database migrations

**Migrations run automatically on every FastAPI boot — no CLI required.**

The architecture matches the existing orders schema exactly:

```
backend/app/db/migrations.py        — single entry point, called by lifespan
        ↓
   ┌────┴────────────────────────────────────────────────────┐
   ▼                                                         ▼
Base.metadata.create_all()                       run_admin_migrations()
(orders, order_items, order_events)              (visitor, session, event,
                                                  order_mirror, *_item,
                                                  traffic_quality, admin_audit)
                                                         ↑
                                              backend/app/db/admin_schema.sql
                                              (idempotent, IF NOT EXISTS +
                                               DO blocks for FKs, v1 tracking)
```

Every statement in `admin_schema.sql` is idempotent: `CREATE TABLE IF NOT
EXISTS`, `CREATE INDEX IF NOT EXISTS`, and FK adds wrapped in `DO $$ …
EXCEPTION WHEN duplicate_object` blocks. Booting the FastAPI container ten
times applies the schema exactly once. The `_admin_schema_version` table
gates future bumps.

### When to use the Prisma CLI

For developer workflows only — never required on the server:

- `npm run db:generate` regenerates the TypeScript client types after
  editing `prisma/schema.prisma`.
- `prisma studio` is a handy local viewer (point it at `ADMIN_DATABASE_URL`).
- The legacy `prisma/migrations/0001_init.sql` file remains as a manual
  apply path (e.g. for a brand-new external Postgres where FastAPI doesn't
  run). It's byte-equivalent to `admin_schema.sql`.

### Adding a schema change later

1. Edit `prisma/schema.prisma` and regenerate the client:
   ```bash
   npm run db:generate
   ```
2. Append an idempotent block to `backend/app/db/admin_schema.sql`:
   ```sql
   DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM "_admin_schema_version" WHERE "version" = 2) THEN
       -- your ALTERs / CREATE INDEXes (use IF NOT EXISTS / DO/EXCEPTION patterns)
       INSERT INTO "_admin_schema_version" ("version") VALUES (2);
     END IF;
   END $$;
   ```
3. Redeploy. FastAPI's next boot applies it.

### Tables created

| Table | Purpose |
|---|---|
| `visitor` | Long-lived visitor (1y cookie). Aggregates lifetime sessions / orders / revenue. |
| `session` | 30-min sliding session with device, geo, traffic-quality flags. |
| `event` | Granular event log (page_view, product_view, add_to_cart, order_*, upsell_*, etc.). |
| `order_mirror` + `order_mirror_item` | Mirror of every confirmed order with line items. |
| `traffic_quality` | Per-session fingerprint of VPN / proxy / Tor / bot / anonymous flags. |
| `admin_audit` | Login / logout audit trail. |

---

## Traffic quality — how filtering works

Every event ingested by `/api/track` runs through this pipeline:

1. **Bot UA check** — fast first pass using a maintained pattern list
   (`lib/admin/bot.ts`). Bots fail immediately.
2. **MaxMind GeoIP2 Insights** — `lookupIp(ip)` returns country, city, ISP,
   plus the anonymizer traits: `is_anonymous_vpn`, `is_anonymous_proxy`,
   `is_public_proxy`, `is_residential_proxy`, `is_tor_exit_node`,
   `is_hosting_provider`. Cached 12h in-process per IP.
3. **Quality score** — composed in `lib/admin/quality.ts`. Each flag has a
   transparent penalty. Default threshold `60/100` — below that the
   session is marked invalid and excluded from analytics counts (it stays
   visible on the Traffic Quality page).
4. **GCC allowlist** — sessions whose country isn't in
   `ADMIN_ALLOWED_COUNTRIES` are flagged. Default: `SA,AE,KW,QA,BH,OM,YE`.

Privacy: raw IPs and full user-agents are NEVER persisted. Only their
SHA-256 hashes (salted with `JWT_SECRET`) are stored.

---

## Pages

| Route | What it shows |
|---|---|
| `/admin/login` | Email + password login (rate-limited slow-fail). |
| `/admin` | Overview — KPI grid, revenue chart, behavioural funnel, top products / landings / cities / sources / devices. |
| `/admin/orders` | Table with search / status filter / sort / pagination + premium order drawer with line items, session attribution, status + notes editor. |
| `/admin/funnel` | Full storefront funnel with drop-off rates + upsell sub-funnel. |
| `/admin/products` | Per-product CTR, conversion rate, AOV, revenue. |
| `/admin/geo` | Cities, ISPs, browsers, OSes. GCC-filtered. |
| `/admin/traffic` | VPN / proxy / hosting / Tor / bot counts + recent filtered sessions. |
| `/admin/settings` | Env health check + traffic-filter overview + ingest setup instructions. |

---

## Tracking events from your code

The tracker is exposed as a tiny client API:

```ts
import { track } from "@/lib/track/client";

track("cta_click", {
  productId: "p_004",
  productSlug: "sugarbear-hair",
  surface: "hero",
});

track("add_to_cart", {
  productId: "p_004",
  value: 19900,        // halalas
  currency: "SAR",
});
```

`page_view` is auto-fired on every client-side navigation by
`AnalyticsTracker`. You don't need to call it manually.

Reserved event names the dashboard understands:

```
page_view, product_view, cta_click, add_to_cart, checkout_open,
order_submit, order_success, upsell_view, upsell_accept, upsell_reject,
cross_sell_accept
```

You can fire any other name — they show up in raw events but won't power
the funnel or per-product CTR until you call the matching name.

---

## Future-scaling notes

* **Meta / TikTok / Snapchat ROAS**: tables already exist for events and
  attribution. Add an `ad_spend` table + a nightly importer from each
  platform's reporting API, then join on `utm_source`/`utm_campaign`.
* **CAC / profit tracking**: extend `OrderMirror` with `cogsMinor`,
  `shippingCostMinor`, `paymentFeeMinor`. The dashboard's
  `getProductPerformance` is the natural extension point.
* **Warehouse / fulfilment**: the order drawer already exposes a `status`
  enum + `notes` field. Webhook out from PATCH to your WMS.
* **CRM**: every order carries `phone` and (when MaxMind is on) `city` /
  `isp`. Stream `order_mirror.created` events to your CRM via an additional
  `dispatchWebhook` call from `/api/admin/ingest/orders` (same HMAC).

---

## Failure modes

| Symptom | Diagnosis |
|---|---|
| `/admin` redirects in a loop | `JWT_SECRET` not set or admin login not configured. Check `/admin/settings`. |
| Dashboard shows zeros | `ADMIN_DATABASE_URL` unset, migration not applied, or `<AnalyticsTracker />` isn't reaching `/api/track`. Inspect Network → `/api/track` returns 204. |
| Orders aren't appearing | `ORDERS_WEBHOOK_URL` not pointing at `/api/admin/ingest/orders`, OR `WEBHOOK_SECRET` mismatch between caller and receiver. Check server logs for `invalid_signature`. |
| VPN / proxy columns are always 0 | `MAXMIND_ACCOUNT_ID` / `MAXMIND_LICENSE_KEY` missing on the Next.js service. (They exist on FastAPI but Next has its own server runtime.) |
| Visitor count looks small | The traffic-quality filter is doing its job. Switch range, then check `/admin/traffic` — anything filtered is shown there. |

---

## Security checklist

- [x] All admin routes behind `middleware.ts` JWT check.
- [x] Cookie is HttpOnly + Secure (prod) + SameSite=Lax.
- [x] Slow-fail (600ms) on bad credentials.
- [x] Login attempts logged to `admin_audit`.
- [x] Raw IPs hashed (salted with `JWT_SECRET`) before persistence.
- [x] HMAC signed + timestamp-replay-protected order ingest.
- [x] Admin routes excluded from page-view tracking.
- [x] `robots: noindex` on the admin layout.
- [ ] Rotate `JWT_SECRET` periodically — invalidates all live admin sessions.

---

## Roadmap (not yet built — clean extension points exist)

* Per-product trend graphs (data is in `event` + `order_mirror_item`).
* Daily ROAS via Meta/TikTok cost APIs.
* SMS / WhatsApp drip to abandoned-checkout phones.
* Returning-customer reactivation segments.
* Slack alerts for traffic-quality anomalies.
