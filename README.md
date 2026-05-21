# ELFANAA · الفناء

**تفاصيل تصنع الفخامة — Details craft luxury.**

A high-converting, premium DTC storefront for **Saudi Arabia**, built for the
**[elfanaa.com](https://elfanaa.com)** brand. Cash on Delivery only, Arabic-first,
mobile-first. Engineered for high AOV with a 1 / 2 / 3 volume bundle and a
single 99 SAR post-purchase upsell.

> Two services — `web` (Next.js) and `api` (FastAPI) — fronted by Postgres,
> dockerised, EasyPanel-ready, GitHub-ready.

---

## Table of contents

1. [What's in the box](#whats-in-the-box)
2. [Tech stack](#tech-stack)
3. [Repository layout](#repository-layout)
4. [Quick start (local)](#quick-start-local)
5. [Environment variables](#environment-variables)
6. [Deployment (EasyPanel)](#deployment-easypanel)
7. [Order flow end-to-end](#order-flow-end-to-end)
8. [Pricing model (199 / 279 / 349 SAR)](#pricing-model-199--279--349-sar)
9. [Post-purchase upsell (99 SAR)](#post-purchase-upsell-99-sar)
10. [Pixel tracking — Meta / TikTok / Snapchat with CAPI dedup](#pixel-tracking)
11. [Google Sheets webhook](#google-sheets-webhook)
12. [Adding products](#adding-products)
13. [CRO patterns at a glance](#cro-patterns-at-a-glance)
14. [Documentation map](#documentation-map)
15. [Hand-off — `FINAL_PROMPT.md`](#hand-off)

---

## What's in the box

- **Storefront** — Home, Shop, Product detail (×3), About, Contact, Thank-you.
- **Cart drawer** — no cart page, cross-sells inline, free-shipping progress bar.
- **Checkout popup** — two fields (Name + Saudi phone), validated server-side.
- **Post-purchase upsell** — single 99 SAR offer, 12-second timer, scoring engine.
- **Backend (FastAPI)** — orders + upsell endpoints, Postgres persistence, async
  migrations on startup, structured logging, CORS-aware.
- **Pixel layer** — Meta / TikTok / Snapchat, browser pixels deferred to first
  interaction, server-side CAPI fires Purchase with shared `event_id` for dedup.
- **Webhooks** — signed outbound (`x-elfanaa-signature`) for CRM/shipping +
  Google Sheets fan-out for ops.
- **Docker** — `docker-compose up` brings the whole stack up locally.

---

## Tech stack

| Layer        | Tech                                                         |
| ------------ | ------------------------------------------------------------ |
| Storefront   | Next.js 15 (App Router) · React 19 · Tailwind 3 · Zustand    |
| Backend      | FastAPI · SQLAlchemy 2.0 (async) · asyncpg · Pydantic v2     |
| Database     | PostgreSQL 16                                                |
| Pixels (web) | Meta `fbq` · TikTok `ttq` · Snapchat `snaptr` (lazy-loaded)  |
| Pixels (CAPI)| Meta Conversions API · TikTok Events API · Snapchat CAPI    |
| Container    | Multi-stage Dockerfile (≈180 MB web, ≈220 MB api)            |
| Deploy       | EasyPanel (or any Docker host); `docker-compose.yml` is the truth |

---

## Repository layout

```
.
├── app/                       # Next.js App Router pages & route handlers
│   ├── about/                 # About page (manifesto, pillars, promise, CTA)
│   ├── contact/               # Contact page (channels, form, hours)
│   ├── shop/, products/[slug]/, thank-you/[orderId]/
│   ├── api/orders/            # In-Next fallback order routes (used when
│   │                          # NEXT_PUBLIC_API_BASE_URL is unset)
│   └── opengraph-image.tsx    # Edge-rendered OG card
├── backend/                   # FastAPI service
│   ├── app/
│   │   ├── api/routes/        # health.py, orders.py
│   │   ├── core/              # config, logging, security, phone validation
│   │   ├── db/                # database.py, models.py, migrations.py
│   │   ├── schemas/           # Pydantic v2 (camelCase aliasing)
│   │   ├── services/
│   │   │   ├── catalog.py     # Server-side mirror of frontend catalog
│   │   │   ├── pricing.py     # Tiered re-pricing (parity w/ TS engine)
│   │   │   ├── webhooks.py    # Outbound signed webhooks + Sheets
│   │   │   ├── orders.py      # Domain service (create, accept upsell, ...)
│   │   │   └── pixels/        # Meta / TikTok / Snap CAPI clients
│   │   └── main.py            # FastAPI app factory + lifespan
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── components/
│   ├── brand/                 # Logo system (Mark, Wordmark, Flourish, Logo)
│   ├── cart/, checkout/, layout/, product/, sections/, ui/
│   ├── providers/PixelProvider.tsx     # Defers pixel boot to first interaction
│   └── sections/about,contact/
├── data/                      # products.ts, collections.ts, site.ts (brand)
├── lib/
│   ├── analytics.ts           # track() + trackCommerce() facade
│   ├── api.ts                 # apiUrl() — toggles between local/Next and FastAPI
│   ├── pixels/                # Browser pixel adapters + dedup id helper
│   ├── pricing.ts, upsell/strategy.ts, webhooks/, phone.ts, ...
├── webhook-script.js          # Apps Script for Google Sheets (standalone)
├── sheet-template.csv         # Header row + 3 example rows for the Sheet
├── Dockerfile                 # Storefront container
├── docker-compose.yml         # Full local stack (db + api + web)
├── .env.example               # Frontend env contract
└── FINAL_PROMPT.md            # Hand-off prompt for the next AI coder
```

---

## Quick start (local)

```bash
# 1. Start the full stack (database + API + web)
docker compose up --build

# Database becomes ready, FastAPI runs migrations on boot, Next.js builds
# and serves on :3000. The frontend already points to the API on :8000
# via NEXT_PUBLIC_API_BASE_URL set in docker-compose.yml.
```

Or run each piece by hand for hot-reload:

```bash
# 1) Database only
docker compose up elfanaa_database -d

# 2) Backend (FastAPI) — from /backend
python -m venv .venv && source .venv/bin/activate    # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 3) Frontend (Next.js) — from repo root
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 to talk to FastAPI
npm run dev
```

Visit:
- Storefront: <http://localhost:3000>
- API docs: <http://localhost:8000/docs> (dev mode only)
- Health: <http://localhost:8000/health>

---

## Environment variables

### Frontend — `.env.local` (see `.env.example`)

| Variable                          | Required | Description                                                              |
| --------------------------------- | -------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`            | yes      | Canonical site URL (`https://elfanaa.com`).                              |
| `NEXT_PUBLIC_DEFAULT_LOCALE`      | no       | `ar` (default) or `en`.                                                  |
| `NEXT_PUBLIC_CURRENCY`            | no       | `SAR` (default).                                                         |
| `NEXT_PUBLIC_API_BASE_URL`        | no       | If set, the storefront posts orders directly to FastAPI. **MUST be a build arg** — see "EasyPanel build vs. runtime env" below. |
| `NEXT_PUBLIC_META_PIXEL_ID`       | no       | Browser-side Meta pixel id. Tokens stay in `backend/.env`.               |
| `NEXT_PUBLIC_TIKTOK_PIXEL_ID`     | no       | Browser-side TikTok pixel id.                                            |
| `NEXT_PUBLIC_SNAPCHAT_PIXEL_ID`   | no       | Browser-side Snap pixel id.                                              |
| `WEBHOOK_SECRET`                  | partial  | HMAC secret for the in-Next.js fallback dispatcher.                      |
| `ORDERS_WEBHOOK_URL`              | no       | CRM/ERP webhook (legacy fallback only).                                  |
| `SHIPPING_WEBHOOK_URL`            | no       | Shipping partner webhook (legacy fallback only).                         |
| `GOOGLE_SHEETS_WEBHOOK_URL`       | no       | Apps Script web app URL (legacy fallback only).                          |
| `GOOGLE_SHEETS_API_KEY`           | no       | Shared secret for the Apps Script (legacy fallback only).                |

### Backend — `backend/.env` (see `backend/.env.example`)

> Any variable documented in this table can be overridden in EasyPanel's env-var UI without editing source.

| Variable                            | Required | Description                                                            |
| ----------------------------------- | -------- | ---------------------------------------------------------------------- |
| `APP_ENV`                           | no       | `production` / `development`.                                          |
| `APP_HOST` / `APP_PORT`             | no       | Defaults `0.0.0.0:8000`.                                               |
| `LOG_LEVEL`                         | no       | `INFO` / `DEBUG`.                                                      |
| `DATABASE_URL`                      | yes      | `postgresql+asyncpg://elfanaa:elfanaa@elfanaa_database:5432/elfanaa`.  |
| `CORS_ORIGINS`                      | yes      | Comma-separated allowed origins.                                       |
| `WEBHOOK_SECRET`                    | yes      | HMAC secret for outbound signed webhooks.                              |
| `ORDERS_WEBHOOK_URL`                | no       | CRM/ERP webhook.                                                       |
| `SHIPPING_WEBHOOK_URL`              | no       | Shipping partner.                                                      |
| `GOOGLE_SHEETS_WEBHOOK_URL` / `_API_KEY` | no  | Apps Script URL + key.                                                 |
| `META_PIXEL_ID` / `META_CAPI_ACCESS_TOKEN` | no | Meta CAPI.                                                          |
| `TIKTOK_PIXEL_ID` / `TIKTOK_EVENTS_ACCESS_TOKEN` | no | TikTok Events API.                                                |
| `SNAPCHAT_PIXEL_ID` / `SNAPCHAT_CAPI_ACCESS_TOKEN` | no | Snapchat CAPI.                                                  |
| `MAXMIND_ACCOUNT_ID` / `MAXMIND_LICENSE_KEY` | no | MaxMind GeoIP2 Insights credentials. Required only when `ENABLE_IP_FRAUD_CHECK=true`. |
| `ENABLE_IP_FRAUD_CHECK`             | no       | `true` to gate non-KSA / VPN / proxy / hosting-IP orders. Default `false` (allow-all). |
| `ALLOWED_COUNTRIES`                 | no       | Comma-separated ISO-3166 alpha-2 codes. Default `SA`.                  |
| `WHITELISTED_PHONES`                | no       | Comma-separated E.164 phones that bypass the IP gate (QA / founder / ops). |

### IP fraud gate — MaxMind GeoIP2

The backend hardens COD against fraud (the highest-risk payment method)
by gating each `POST /orders` against MaxMind's GeoIP2 Insights API:

- Requests from outside `ALLOWED_COUNTRIES` (default `SA`) are rejected with
  `403 geo_blocked`.
- Requests from anonymising proxies, VPNs, Tor exit nodes, and hosting
  providers are rejected with the same code.
- Whitelisted phones bypass every check — useful for the founder's roaming
  device, QA, and ops.
- The check fails **open**: a MaxMind outage never blocks real customers;
  the failure is logged with the IP for ops to review.
- Results are cached in-process for one hour per IP, so a single buyer
  refreshing the checkout never burns more than one MaxMind query.

The storefront also calls `GET /geo/me` when the checkout modal opens to
surface a soft "we ship within KSA only" banner — purely advisory; the
authoritative gate runs server-side.

To enable in production:

1. Sign up at <https://www.maxmind.com> and subscribe to **GeoIP2 Insights**.
2. Generate a license key (Account → Manage License Keys).
3. Set `MAXMIND_ACCOUNT_ID`, `MAXMIND_LICENSE_KEY`, and
   `ENABLE_IP_FRAUD_CHECK=true` in EasyPanel → `elfanaa_api` → Environment.
4. Redeploy the backend. Watch logs for any `order rejected by ip fraud gate`
   entries — they include `country` + `reason` for forensic analysis.

---

## Deployment (EasyPanel)

Three services, in this order:

1. **`elfanaa_database`** — Postgres 16
   - Image: `postgres:16-alpine`
   - Env: `POSTGRES_DB=elfanaa`, `POSTGRES_USER=elfanaa`, `POSTGRES_PASSWORD=<strong>`
   - Volume: persistent, mounted at `/var/lib/postgresql/data`.

2. **`elfanaa_api`** — FastAPI
   - Source: this repo, build context `./backend`, Dockerfile `./backend/Dockerfile`.
   - Domain: `api.elfanaa.com` (HTTPS via EasyPanel's Let's Encrypt).
   - Port mapping: container `8000` → public `443/80` via reverse proxy.
   - Env: every value in `backend/.env.example`. Most importantly:
     `DATABASE_URL=postgresql+asyncpg://elfanaa:elfanaa@elfanaa_database:5432/elfanaa`
   - Healthcheck: `GET /health`.

3. **`elfanaa_web`** — Next.js
   - Source: this repo root, Dockerfile `./Dockerfile`.
   - Domain: `elfanaa.com`.
   - Env: every `NEXT_PUBLIC_*` from `.env.example`. Set
     `NEXT_PUBLIC_API_BASE_URL=https://api.elfanaa.com`.
   - **Build vs. runtime — read this if Google Sheets stays empty.**
     Next.js inlines every `process.env.NEXT_PUBLIC_*` lookup into the
     browser bundle at `npm run build` time. EasyPanel's regular
     **"Environment Variables"** tab applies *only at container runtime*,
     which is too late — the JS has already been baked. Each
     `NEXT_PUBLIC_*` value MUST be added to the **"Build Arguments"**
     tab (or equivalent) so it reaches `npm run build` inside the
     Docker builder stage. The frontend Dockerfile (`./Dockerfile`)
     declares the matching `ARG`s; `docker-compose.yml` forwards them
     via `services.elfanaa_web.build.args`.
     - **Symptom of forgetting this:** the browser POSTs to
       `https://elfanaa.com/api/orders` (the embedded Next.js
       fallback) instead of `https://api.elfanaa.com/orders`. The
       FastAPI service never sees the order, the Sheets dispatcher
       on the API service never runs, and the spreadsheet stays
       empty. The fallback route logs a structured warning in this
       case; hitting `/api/diagnostics/sheets` reports
       `routing.mode = "standalone"` to confirm.
     - **Fix:** set `NEXT_PUBLIC_API_BASE_URL` as a Build Argument
       (not just an env var), trigger a full rebuild (not a restart),
       and verify with `/api/diagnostics/sheets` that
       `routing.resolvedOrderPostUrl` becomes
       `https://api.elfanaa.com/orders`.

> ⚠ **Required before going live:** every default value below uses
> `elfanaa:elfanaa` for local dev convenience. Replace
> `POSTGRES_PASSWORD` and the password segment of `DATABASE_URL`
> with a strong secret in EasyPanel's env-var UI. The backend will
> refuse to boot in production with the local-dev default
> (see `backend/app/core/config.py` validator).

EasyPanel's "compose" import accepts `docker-compose.yml` directly. The
service names match the database connection string in the spec, so no
URL rewriting is needed.

---

## Order flow end-to-end

```
Customer adds product to cart
   └─► AddToCart   (browser pixel — Meta / TT / Snap)

Customer opens cart drawer → clicks "Checkout"
   └─► InitiateCheckout    (browser pixel)

Modal opens → customer enters Name + Saudi phone → Confirm
   ├─ Frontend mints   purchase_event_id
   ├─ POST /orders     { fullName, phone, cart, locale, context: { event_id, fbp, fbc, ttp, ... } }
   ├─ Backend validates (Saudi mobile only), re-prices from catalog,
   │   inserts Order + items into Postgres,
   │   fires Purchase to all CAPIs with the SAME event_id (dedup).
   └─► Browser pixel Purchase (same event_id) → platforms collapse
       the pair into one conversion.

Frontend transitions to Upsell screen (12s timer)
   ├─ "Add it for 99 SAR" → POST /orders/{id}/upsell/accept
   │   └─ Backend appends an `upsell` line; receipt updates.
   └─ Decline / expire → no-op, customer continues.

Router pushes to /thank-you/{orderId}
   ├─ Order summary, upsell result, cross-sells.
   └─ Receipt is restored from sessionStorage (no second API call).

Side-effects in the same backend handler (best-effort, non-blocking):
   ├─ Signed webhook → CRM / Klaviyo / Make / Zapier
   ├─ Signed webhook → Shipping partner (Aramex / SMSA / J&T)
   └─ Apps Script POST → Google Sheets row append (Orders / Upsells tabs)
```

---

## Pricing model (199 / 279 / 349 SAR)

Implemented as a **tier ladder** on each product. The engine lives in
[`lib/pricing.ts`](./lib/pricing.ts) (frontend) and
[`backend/app/services/pricing.py`](./backend/app/services/pricing.py)
(server-trusted re-compute). Both use the same algorithm:

- Exact-tier match wins (1 → 199, 2 → 279, 3 → 349).
- Below the smallest tier: per-unit base price.
- Above the largest tier: top tier as a "block", remainder at the top-tier
  unit rate. Customers are never punished for adding one more.

To change the ladder, edit `data/products.ts` (each product's
`offerTiers`) and the mirror in `backend/app/services/catalog.py`.

---

## Post-purchase upsell (99 SAR)

Single offer screen, surfaced after the customer's COD details validate.
Algorithm in [`lib/upsell/strategy.ts`](./lib/upsell/strategy.ts):

- Anchor-credibility window: only products with base price between
  **1.5×** and **6×** of 99 SAR are eligible.
- Scoring: editorial overrides (+999) > curated upsellIds (+50) >
  same-collection (+30) > complementary collection (+20) > ideal anchor
  (+10) > rating tiebreaker.
- Timer: **12 seconds** (configurable). When it hits zero the offer
  is genuinely gone — we don't silently accept and we don't reset.

Editorial overrides live in the same file:

```ts
const editorialOverrides: Record<string, string> = {
  p_001: "p_002",  // cushion buyer → lantern offer
  p_002: "p_003",  // lantern buyer → vase offer
  p_003: "p_001",  // vase buyer → cushion offer
};
```

---

## Pixel tracking

Two layers — **browser pixels** and **server-side CAPI** — sharing one
`event_id` per event so platforms dedup the pair into a single conversion.

### Browser pixels — `lib/pixels/`

- Booted by `<PixelProvider />` on **first user interaction** (with a
  4-second fallback). This keeps the heavy 3rd-party scripts out of FCP.
- One unified facade — components call `pixelTrack({ name, eventId, ... })`,
  the facade fans out to Meta / TikTok / Snap.
- Event IDs minted via `newEventId(prefix)`. The Purchase id is forwarded
  to the backend in the `/orders` body so server CAPI uses the same value.

### Server CAPI — `backend/app/services/pixels/`

- Sends only `Purchase` (the highest-value event). Browser handles the rest.
- Hashes PII per platform spec (`hash_for_capi`): SHA-256 of trimmed +
  lowercased `phone` (E.164 without `+` for Meta/Snap), `email`,
  `first_name`, `last_name`, `country`.
- Reads attribution cookies (`_fbp`, `_fbc`, `_ttp`, `_scid`) from the
  request's `context` block and forwards them un-hashed.

### Setup

1. Create a pixel in each ads platform → copy the **Pixel ID**.
2. Generate a **CAPI access token** (Meta: System User; TikTok: Events
   Manager → "Settings" → "Generate access token"; Snapchat: Conversions
   API → "Generate token").
3. Frontend `.env.local`:
   ```env
   NEXT_PUBLIC_META_PIXEL_ID=
   NEXT_PUBLIC_TIKTOK_PIXEL_ID=
   NEXT_PUBLIC_SNAPCHAT_PIXEL_ID=
   ```
4. Backend `backend/.env`:
   ```env
   META_PIXEL_ID=
   META_CAPI_ACCESS_TOKEN=
   META_CAPI_TEST_EVENT_CODE=    # optional, for "Test Events" tab

   TIKTOK_PIXEL_ID=
   TIKTOK_EVENTS_ACCESS_TOKEN=
   TIKTOK_TEST_EVENT_CODE=

   SNAPCHAT_PIXEL_ID=
   SNAPCHAT_CAPI_ACCESS_TOKEN=
   ```

### Verifying dedup

- **Meta**: Events Manager → "Test events" → place a real (or test)
  order. You should see one `Purchase` event with two source rows
  (browser + server) collapsed under the same `Event ID`.
- **TikTok**: Events Manager → "Test event code" tab. Each event posts
  with `event_id` field; both browser and server should land in the
  same row.
- **Snapchat**: Events Manager → "Conversions API" tab.

---

## Google Sheets webhook

The backend (or the Next.js fallback) ships every order as a JSON row
to a **single Apps Script web app** that appends to a Google Sheet.

### Setup (≈5 minutes)

1. Create a new Sheet → name it **"ELFANAA · Orders"**.
2. Open **Extensions → Apps Script** → paste [`webhook-script.js`](./webhook-script.js).
3. Replace the `API_KEY` constant with a long random string.
4. **Deploy → New deployment → Web app**:
   - Execute as: **Me**.
   - Who has access: **Anyone**.
   - Copy the resulting `…/exec` URL.
5. Set in `backend/.env` (and/or `.env.local` for the fallback):
   ```env
   GOOGLE_SHEETS_WEBHOOK_URL=<the URL>
   GOOGLE_SHEETS_API_KEY=<same as API_KEY>
   ```
6. Run `setupHeaders()` once from the Apps Script editor. Or import
   [`sheet-template.csv`](./sheet-template.csv) into row 1.

The script writes orders to an **Orders** tab and post-purchase upsell
acceptances to an **Upsells** tab.

### Verify in one click (no test order required)

After every deploy, hit:

```
https://<your-site>/api/diagnostics/sheets        # Next.js / single-tier
https://<your-api>/diagnostics/sheets             # FastAPI / two-tier
```

The endpoint reports whether `GOOGLE_SHEETS_WEBHOOK_URL` and
`GOOGLE_SHEETS_API_KEY` are set in the running container, then sends a
`kind: "ping"` POST to the Apps Script that returns without appending
a row. Typical failure modes and what the response tells you:

| `ok` | `stage`                       | What to do                                                                                                              |
|------|-------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| `false` | `env`                      | Add `GOOGLE_SHEETS_WEBHOOK_URL` / `GOOGLE_SHEETS_API_KEY` in EasyPanel → redeploy.                                       |
| `false` | `auth-or-app`              | The env-var key and the `API_KEY` in `webhook-script.js` don't match. Fix one, redeploy the Apps Script (New version). |
| `false` | `transport`                | The `/exec` URL doesn't respond — usually "Who has access" isn't set to **Anyone** or the deployment was deleted.       |
| `true`  | `appended-instead-of-pinged` | Integration works, but the deployed Apps Script is the old version. Redeploy it to pick up the `kind:"ping"` handler.   |
| `true`  | `ping-acknowledged`        | Healthy — the next COD order will append a row.                                                                         |

### Example payload

```json
{
  "kind": "order",
  "received_at": "2026-05-03T16:00:00Z",
  "order_id": "ord_a1b2c3d4e5f6",
  "full_name": "محمد العتيبي",
  "phone": "0512345678",
  "phone_e164": "+966512345678",
  "items": "وسادة مجلس أرضية × 3 (349 SAR)",
  "item_count": 3,
  "subtotal_sar": 349.00,
  "upsell_sar": 99.00,
  "total_sar": 448.00,
  "currency": "SAR",
  "payment_method": "cod",
  "locale": "ar",
  "source": "https://elfanaa.com/products/majlis-floor-cushion"
}
```

---

## Adding products

1. **Frontend** — `data/products.ts`: append a new entry with `id`, `slug`,
   localised `title` + `description`, `images`, `price`, `offerTiers`,
   `collection`, `upsellIds`. Put it on the home page by appending its id
   to `bestSellerIds`.
2. **Backend mirror** — `backend/app/services/catalog.py`: add the same
   product to `PRODUCTS`. The id and base price MUST match — the backend
   re-prices and rejects unknown ids.
3. **Collections** — if the product introduces a new collection,
   `data/collections.ts` automatically builds the list from the products
   array; add the new collection entry there too.

---

## CRO patterns at a glance

- **Single-CTA hero** — one button above the fold, no competing actions.
- **Free-shipping progress bar** in the cart drawer (threshold from `siteConfig.freeShippingThreshold`).
- **Tier nudges** — "add one more, save 119 SAR" computed from `nextTier()`.
- **Trust strip** — COD, fast delivery, quality guarantee, immediately under the hero.
- **Reassurance list** in the checkout modal — "you pay nothing today",
  "we call to confirm", "WhatsApp backup".
- **Single discount** — only the post-purchase upsell carries a price cut.
  Everywhere else the price stays honest. This protects margin AND makes
  the offer feel real.
- **Honest urgency** — the 12-second timer doesn't reset on idle; expired
  is expired. Customers learn to trust the brand.
- **Social proof** — review counts surface in product cards and detail
  pages; cross-sells in the drawer reinforce "people who bought X also…".

---

## Documentation map

The repository ships three documentation files. Read in this order:

| File | Audience | What's inside |
| ---- | -------- | ------------- |
| [`README.md`](./README.md) | Operators + first-day developers | Setup, env vars, EasyPanel deployment, webhook setup, pixel setup, order lifecycle |
| [`frontend-docs.md`](./frontend-docs.md) | Frontend / fullstack engineers | Folder structure, page composition, every major component, state management, UX flow, RTL/Tailwind conventions, "how to modify" recipes, CRO rationale |
| [`FINAL_PROMPT.md`](./FINAL_PROMPT.md) | The next AI coder | Self-contained handover brief — paste into a fresh chat to bring an agent up to speed in one message |

---

## Hand-off

A self-contained handover prompt for the next AI coder lives in
[`FINAL_PROMPT.md`](./FINAL_PROMPT.md). Copy that file's contents into
your next chat to bring a fresh agent up to speed in one message.

---

## License

Proprietary — © 2026 ELFANAA. All rights reserved.
