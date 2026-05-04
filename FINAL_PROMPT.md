# ELFANAA — Hand-off prompt for the next AI coder

> Copy everything below the `---` line into a fresh chat with another
> coding agent. It is written as a single self-contained brief so the
> next AI can ship features without re-reading the codebase end-to-end.
>
> Companion documents:
> - [`README.md`](./README.md) — repo overview, env vars, deployment, webhook setup.
> - [`frontend-docs.md`](./frontend-docs.md) — deep frontend reference (pages, components, state, CRO logic).

---

## Role & context

You are a senior full-stack ecommerce engineer continuing work on
**ELFANAA (الفناء)** — a high-converting, premium DTC storefront for
Saudi Arabia. The frontend lives at `https://elfanaa.com`, the API at
`https://api.elfanaa.com`. The brand sells home & garden pieces with a
calm, luxurious, **Saudi-dialect** tone — emotional copy, premium
imagery, slow rhythm. The customer is **Cash on Delivery (COD) only**.

The repository is **already shipped**. The previous engineer built:

1. A complete Next.js 15 (App Router) storefront in Arabic + English
   with full RTL support, brand system (`الفناء` Najdi-arch logo,
   Amiri Arabic wordmark, Cormorant Garamond Latin, antique brass
   `#B4894A` accent).
2. A FastAPI backend with PostgreSQL, async migrations on startup,
   signed webhooks, and server-side Pixel CAPI fan-out for Meta /
   TikTok / Snapchat.
3. A pixel layer that defers browser scripts to first interaction and
   shares an `event_id` with server-side CAPI for deduplication.
4. A Google Sheets webhook (Apps Script) for ops dashboards.
5. A complete Docker setup (`docker compose up --build` brings everything
   up — Postgres + FastAPI + Next.js).
6. A **full CRO frontend**: tier offer selector (1/2/3), scarcity
   signals, benefits / lifestyle / reviews / FAQ on every PDP, sticky
   CTAs (mobile global + desktop PDP), checkout popup with
   social-proof + activity scarcity, single 99 SAR post-purchase
   upsell with 12s timer, thank-you page with cross-sells.

You are **not** rebuilding any of this. You are extending it.

---

## Tech stack (do NOT swap)

- **Frontend**: Next.js 15 App Router, React 19, Tailwind 3, Zustand 5,
  Lucide React. TypeScript strict mode.
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0 async, asyncpg,
  Pydantic v2, httpx, phonenumbers.
- **Database**: PostgreSQL 16 (named volume `elfanaa_pgdata`).
- **Container runtime**: Docker (multi-stage builds, ~180 MB web image,
  ~220 MB api image).
- **Deploy target**: EasyPanel (VPS Docker host with Let's Encrypt and
  reverse proxy). Three services: `elfanaa_database`, `elfanaa_api`,
  `elfanaa_web`. Service names match the connection string in the spec.

Do not introduce new state libraries, ORMs, CSS frameworks, or test
runners without explicit user approval.

---

## Repository layout (memorise)

```
.
├── app/                          # Next.js pages + route handlers
│   ├── about/, contact/, shop/, products/[slug]/, thank-you/[orderId]/
│   ├── api/orders/               # In-Next fallback (when NEXT_PUBLIC_API_BASE_URL is unset)
│   └── opengraph-image.tsx
├── backend/
│   ├── app/
│   │   ├── api/routes/           # health.py, orders.py
│   │   ├── core/                 # config, logging, security (HMAC + CAPI hashing), phone validation
│   │   ├── db/                   # database (async engine), models, migrations
│   │   ├── schemas/              # Pydantic v2 with camelCase aliasing
│   │   ├── services/
│   │   │   ├── catalog.py        # MUST mirror data/products.ts exactly
│   │   │   ├── pricing.py        # MUST mirror lib/pricing.ts exactly
│   │   │   ├── orders.py         # Domain service
│   │   │   ├── webhooks.py       # Outbound signed + Sheets dispatch
│   │   │   └── pixels/           # CAPI clients: meta, tiktok, snapchat
│   │   └── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── components/
│   ├── brand/                    # Logo, BrandMark, Wordmark, Flourish (variant API)
│   ├── cart/                     # CartDrawer, CartLineItem, CrossSellSlot, FreeShippingBar, …
│   ├── checkout/                 # CodCheckoutModal, PostPurchaseUpsell
│   ├── layout/                   # Header, Footer, AnnouncementBar, MobileStickyCTA, Container
│   ├── product/                  # ProductGallery, ProductDetails (PDP), OfferSelector,
│   │                             # ScarcitySignals, ProductBenefits, ProductLifestyle,
│   │                             # ProductReviews, ProductFAQ, ProductStickyBar, PDPTrustRow
│   ├── providers/                # PixelProvider, LocaleProvider, UIProvider
│   ├── sections/                 # HomeHero, TrustStrip, ShopByFeeling, BestSellers,
│   │                             # Testimonials, BrandStory, FeaturedCollection, RelatedProducts
│   │   ├── about/
│   │   └── contact/
│   ├── thankyou/                 # ConfirmationHero, DeliveryTimeline, OrderReceipt, …
│   └── ui/                       # Button, Drawer, Modal, Input, Badge, Price, RatingStars
├── data/                         # products, collections, feelings, upsells, site (brand)
├── hooks/                        # useCart, useUI, useLocale, useUpsells, useCountdown, …
├── lib/
│   ├── analytics.ts              # track() + trackCommerce() — single emission point
│   ├── api.ts                    # apiUrl() — toggles between local /api/* and FastAPI
│   ├── pixels/                   # Browser pixel adapters (meta, tiktok, snapchat) + dedup
│   ├── pricing.ts, upsell/strategy.ts, webhooks/, phone.ts, seo.ts, order-receipt.ts, …
├── webhook-script.js             # Google Apps Script (standalone)
├── sheet-template.csv            # 14-column header + sample rows
├── Dockerfile, docker-compose.yml, .dockerignore
├── README.md, FINAL_PROMPT.md, frontend-docs.md
```

---

## Frontend architecture overview

The storefront is a **server-component-first** Next.js app. Pages and
layouts render on the server; only the components that need
interactivity carry `"use client"`. The JS bundle is intentionally
lean (≈170 KB gzipped first-load).

### Page composition

| Route                   | Server / Client | Composition                                                                           |
| ----------------------- | --------------- | ------------------------------------------------------------------------------------- |
| `/`                     | Server          | Hero → Trust → ShopByFeeling → BestSellers → Testimonials → BrandStory                |
| `/shop`                 | Server → Client | ShopPromo → ShopHeader → ShopToolbar (sticky) → ProductGrid                           |
| `/products/[slug]`      | Server          | Gallery + Details (offer selector + sticky CTA) → Benefits → Lifestyle → Reviews → FAQ → RelatedProducts |
| `/thank-you/[orderId]`  | Client          | ConfirmationHero → UpsellAcceptedBanner → DeliveryTimeline → Receipt → Trust → CrossSells → Recommendations → Contact |
| `/about`, `/contact`    | Server          | Editorial sub-sections (`components/sections/{about,contact}/`)                       |

### Global mounted overlays (in `app/providers.tsx`)

- `<CartDrawer />` — opens via `useUI().openCart()`
- `<CodCheckoutModal />` — opens via `useUI().openCheckout()` (replaces drawer)
- `<MobileStickyCTA />` — global mobile bar, hidden over hero, lights up after scroll
- `<PixelProvider />` — defers Meta/TikTok/Snap pixel scripts to first user interaction (or 4 s)

### State machines

- **Cart** (`hooks/useCart.ts`) — Zustand store, persisted to localStorage.
- **UI** (`hooks/useUI.ts`) — Zustand store, NOT persisted (drawer/modal/mobile-nav open state).
- **Locale** (`components/providers/LocaleProvider.tsx`) — React context exposing `{ locale, t }`.
- **Order receipt** (`lib/order-receipt.ts`) — sessionStorage cache for the thank-you page.

### Brand surface

Logo system uses a **variant API**:

```tsx
<Logo variant="primary | secondary | icon"
      size="sm | md | lg"
      tagline="auto | stacked | inline | hidden"
      tone="auto | light"
      asStatic={false} />
```

- Tagline appears in **exactly three places**: hero lockup, header (subtle), footer (inline).
- `tone="light"` only over photographic heroes. Default is `auto`.
- Brand mark is a Najdi-style pointed arch with a courtyard plant
  (`components/brand/BrandMark.tsx`). Uses dynamic `strokeWidth`
  calculation to keep visual weight consistent across sizes.

For a full frontend reference (every section, every prop, every
decision), see [`frontend-docs.md`](./frontend-docs.md).

---

## CRO strategy explanation

The store is a **Saudi COD funnel**, optimised end-to-end for AOV.
Every UX decision below ladders up to one of two goals:

1. **Move the customer from 1 unit to 2 or 3** (the tier ladder).
2. **Add the 99 SAR upsell** to qualifying orders.

### Pricing & offer architecture

- **Tier ladder** (per product): `1 = 199 SAR · 2 = 279 SAR · 3 = 349 SAR`.
  Three options only — choice paralysis starts at four.
- **Single discount in the entire store** is the post-purchase 99 SAR
  upsell. Everything else is full price. This protects margin AND
  keeps the offer credible.
- **Money is integer minor units** everywhere — both TS (`lib/pricing.ts`)
  and Python (`backend/app/services/pricing.py`).

### Conversion components per page

| Page          | Key CRO components                                                                       |
| ------------- | ---------------------------------------------------------------------------------------- |
| Home          | Single-CTA hero · Trust pillars · Mood entry · Best sellers · Real-city testimonials       |
| Shop          | Promo strip ("3 for 349") · Editorial header · Sticky chip nav + sort                     |
| **PDP**       | Emotional headline · Star rating · Scarcity pills · **Tier selector** · Primary CTA · Trust row · Benefits · Lifestyle · Reviews · FAQ · Sticky bar |
| Cart drawer   | Free-shipping progress · Tier-saved badge · Next-tier nudge · Cross-sells                 |
| Checkout popup| Social-proof banner · Concurrent-activity counter · Reassurance list · Live total CTA     |
| Upsell screen | Anchor pricing (compare-at + savings) · 12s honest countdown · Single product             |
| Thank-you     | Confirmation hero · Delivery timeline · Same-price cross-sells · Broader recommendations  |

### Key CRO decisions (the "why")

- **Open the drawer on add** — preserves the customer's "yes" momentum.
- **Checkout is a popup, not a page** — keeps name+phone+summary in
  one viewport, no URL bar exit, no reload on keyboard open.
- **Two fields only** — name + Saudi phone. Address is collected on
  the confirmation call. Mobile completion rate is 2–3x a 6-field form.
- **Phone numbers always render LTR** — even in RTL. Digits visually
  reverse otherwise, and trust collapses (Fazil Digital Riyadh playbook).
- **Honest expiry on the upsell** — when 12 s ends, the offer is gone.
  No auto-accept, no idle reset. Brand earns lifetime trust over a
  small per-order conversion delta.
- **Two scarcity pills max** — three+ on the same surface reads as
  desperation (Cialdini + Aftersell research).

For the full rationale see [`frontend-docs.md` § 8](./frontend-docs.md#8-cro-decisions-explained).

---

## UX flow (cart → upsell → thank-you)

### 1) Add to cart → cart drawer

```
PDP                           Cart store              UI store
─────                          ──────────              ────────
OfferSelector → setSelected
Click "اطلب الآن"
   │
   ├─► useCart.add(productId, selected)
   │      └─► trackCommerce("add_to_cart")  → Meta / TT / Snap
   │
   └─► setTimeout(useUI.openCart, 220ms)    → drawer slides in
```

The drawer renders:

- `FreeShippingBar` (progress to 499 SAR threshold)
- `CartLineItem` for each line — qty stepper, "saved X" badge,
  "add 1 more, save Y" next-tier nudge
- `CrossSellSlot` (cap 2, full price, single-tap add)
- `CartSummary` footer (subtotal + checkout CTA)

### 2) Cart → checkout popup

```
Click "تأكيد الطلب · 349 ر.س."
   ├─► trackCommerce("begin_checkout")     → Meta / TT / Snap
   └─► useUI.openCheckout()                → drawer closes, modal opens

Modal screen 1 ("form"):
   • CheckoutScarcityBanner (social proof + concurrent activity)
   • Field — full name (blur validation)
   • Field — Saudi phone (auto-format, dir="ltr")
   • Reassurance list ("no payment now", "we'll call to confirm", "WhatsApp backup")
   • Sticky aside — order summary
   • Footer CTA — "تأكيد الطلب · 349 ر.س." (live total)
```

### 3) Submit form

```
submit()
   ├─ Validate name + Saudi phone
   ├─ Mint purchase_event_id   = newEventId("pur")
   ├─ Read attribution cookies = readAttributionCookies()  (_fbp, _fbc, _ttp, _scid)
   │
   ├─► POST /orders {
   │     fullName, phone, cart, locale,
   │     context: { event_id, fbp, fbc, ttp, sc_click_id, user_agent, landing_url, referrer }
   │   }
   │       └─► (server) validate phone, re-price cart from catalog,
   │                    INSERT INTO orders + order_items,
   │                    fire signed webhooks (CRM, shipping),
   │                    POST to Google Sheets,
   │                    fire Purchase to Meta/TT/Snap CAPIs (same event_id).
   │
   ├─ saveReceipt({ ...receipt, upsellStatus: "pending" })  → sessionStorage
   ├─ trackCommerce("place_order", { eventId: purchase_event_id })
   │       └─► browser Purchase pixel — same event_id → platforms dedup the pair.
   │
   └─► setScreen("upsell")
```

### 4) Upsell screen → thank-you

```
PostPurchaseUpsell mounts
   ├─ usePostPurchaseUpsell(orderProductIds) → picks ONE product, 99 SAR
   ├─ useCountdown(12)                       → smooth shrinking bar
   ├─ track("view_upsell")
   │
   ├ Accept ─► POST /orders/{id}/upsell/accept
   │           └─► attachUpsellLine() to receipt
   │           └─► onComplete("accepted")
   │
   ├ Decline ─► setUpsellStatus("declined")
   │           └─► onComplete("declined")
   │
   └ Expire ─► button morphs to "Continue"
              click ─► onComplete("expired")

Modal closes → router.push(`/thank-you/${orderId}`)

Thank-you page mount:
   ├─ loadReceipt(orderId)  ← sessionStorage
   ├─ useCart.clear()       (cart is now an artifact of a finished order)
   └─ Render ConfirmationHero · UpsellAcceptedBanner · Timeline · Receipt
              · TrustReinforcement · CrossSells · Recommendations · ContactPanel
```

---

## Cart + upsell system explanation

Two distinct upsell surfaces — never conflate them:

| Concept                  | Where                          | Price        | Behaviour                                             |
| ------------------------ | ------------------------------ | ------------ | ----------------------------------------------------- |
| **Cross-sell**           | Cart drawer + thank-you page   | Full price   | Multiple items, persistent, low friction              |
| **Post-purchase upsell** | Checkout modal screen 2        | **99 SAR**   | Single item, 12 s honest timer, the only discount     |

### Cross-sell algorithm — `data/upsells.ts`

```ts
resolveCartCrossSells(cart, max): Product[]
```

- Picks products NOT in the cart.
- Scores each by `upsellIds` matches (curated) + same-collection.
- Returns up to `max` (drawer caps at 2, thank-you at 3).

### Post-purchase upsell algorithm — `lib/upsell/strategy.ts`

```ts
selectPostPurchaseUpsell(orderProductIds): {
  product, offerPrice, savings, reason, score
} | null
```

- Hard filter: candidate's base price must be **1.5x–6x** of 99 SAR
  (anchor credibility window).
- Score:
  - +999  Editorial override (`editorialOverrides[id]`)
  - +50   Curated `upsellIds` of any cart product
  - +30   Same collection
  - +20   Complementary collection
  - +10   Inside the **2x–4x ideal anchor** band
  - tie-break: rating count, log-scaled
- Tunables in the same file: `POST_PURCHASE_OFFER_PRICE`,
  `POST_PURCHASE_TIMER_SECONDS`, `MIN/MAX_ANCHOR_RATIO`, `IDEAL_ANCHOR_LOW/HIGH`.

### Cart store contract — `hooks/useCart.ts`

```ts
add(productId, quantity = 1, variantId?)        // merges into existing line
remove(productId, variantId?)
setQuantity(productId, quantity, variantId?)
clear()

// Selectors
itemCount(): number
subtotal(): Money                               // recomputed from lineTotal()
freeShippingProgress(): { current, threshold, ratio }
selectResolvedLines(state)                      // joins lines with their product records
```

The PDP's tier selector calls `add(productId, selected)` with `selected ∈ {1,2,3}` — a single line of N items, NOT three lines of one item. This is what makes `lineTotal()` apply the tier price (199 / 279 / 349) instead of `quantity × unit_price`.

---

## How frontend and backend connect

### Two endpoints, one shape

The frontend talks to **either** the in-Next.js fallback at `/api/orders`
**or** the FastAPI backend at `https://api.elfanaa.com/orders`. Both
endpoints accept the **same camelCase JSON shape** and return the same
receipt structure.

```env
# Local dev with the fallback (no FastAPI running):
# leave NEXT_PUBLIC_API_BASE_URL unset

# Local dev with the FastAPI backend:
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Production:
NEXT_PUBLIC_API_BASE_URL=https://api.elfanaa.com
```

`lib/api.ts → apiUrl(path)` rewrites `/api/orders` to the FastAPI URL
when the env var is set, otherwise leaves it alone. **All client code
calls `apiUrl()`** — components never branch between fallback and prod.

### Order request shape

```jsonc
POST /orders
{
  "fullName": "محمد العتيبي",
  "phone": "0512345678",                     // accepts 05X / +9665X / 5X / 009665X
  "locale": "ar",
  "cart": {
    "currency": "SAR",
    "lines": [
      { "productId": "p_001", "quantity": 3 }
    ]
  },
  "context": {
    "event_id": "pur_AbCdEfGh1234",          // same id used by browser Purchase pixel
    "fbp": "fb.1.1714712...", "fbc": "fb.1.1714712...",
    "ttp": "01H...", "sc_click_id": "...",
    "user_agent": "...",
    "landing_url": "...",
    "referrer": "..."
  }
}
```

### Server responsibilities (regardless of which endpoint)

1. **Validate Saudi phone** — `phonenumbers` (Python) / regex (Next.js
   fallback). Mobile only; fixed-line and non-Saudi rejected.
2. **Re-price every line** — using the server-side catalog
   (`backend/app/services/catalog.py` or `data/products.ts` mirror
   in `app/api/orders/`). The client total is **discarded**.
3. **Persist** — orders + order_items + order_events tables (FastAPI),
   or in-memory event log (fallback).
4. **Fan out** (best-effort, non-blocking):
   - Signed webhook → CRM / Klaviyo / Make / Zapier
   - Signed webhook → Shipping partner
   - Apps Script POST → Google Sheets
   - Server-side `Purchase` to Meta / TikTok / Snapchat CAPIs with the
     **shared `event_id`** for browser-server dedup.
5. **Return** the receipt in camelCase. The frontend's
   `normaliseOrderResponse()` adapts both the FastAPI shape (with `items`,
   flat totals) and the legacy fallback shape (with `lines`, nested
   totals) into a single `OrderReceipt`.

### Upsell accept

```
POST /orders/{orderId}/upsell/accept
{ "productId": "p_002" }

→ Server appends an `upsell` line at the canonical 99 SAR offer price
  (the client never sends a price), emits an `upsell_accepted` event,
  returns the updated line.
```

The frontend then `attachUpsellLine()` to the in-memory receipt before
routing to `/thank-you/:id`.

---

## Pixels (Meta / TikTok / Snapchat)

Two layers — **browser pixels** and **server-side CAPI** — sharing one
`event_id` per event so platforms collapse the pair into a single conversion.

### Browser pixels — `lib/pixels/`

- Booted by `<PixelProvider />` on **first user interaction** (with a
  4-second fallback). Keeps the heavy 3rd-party scripts out of FCP.
- One unified facade — components call `pixelTrack({ name, eventId, … })`,
  the facade fans out to Meta / TikTok / Snap.
- Components NEVER touch `fbq` / `ttq` / `snaptr` directly. They go
  through `track()` / `trackCommerce()` in `lib/analytics.ts`.
- Event IDs minted via `newEventId(prefix)`. The Purchase id is forwarded
  to the backend in the `/orders` body so server CAPI uses the same value.

### Server CAPI — `backend/app/services/pixels/`

- Sends only `Purchase` (the highest-value event). Browser handles the rest.
- Hashes PII per platform spec (`hash_for_capi`): SHA-256 of trimmed +
  lowercased `phone` (E.164 without `+` for Meta/Snap), `email`,
  `first_name`, `last_name`, `country`.
- Reads attribution cookies (`_fbp`, `_fbc`, `_ttp`, `_scid`) from the
  request's `context` block and forwards them un-hashed.

When Meta / TikTok / Snap envs are unset, the CAPI clients are no-ops.
Browser pixels also silently no-op without their respective `NEXT_PUBLIC_*_PIXEL_ID`.

---

## Webhook system explanation

### Outbound signed webhooks (CRM, shipping)

Fired from `backend/app/services/orders.py` `_fanout_after_create()`.

```
HMAC-SHA256(body, secret) → x-elfanaa-signature: sha256=<hex>
```

Receivers verify by computing the same HMAC over the raw body. Helper:
`lib/webhooks/verify.ts` (frontend / Edge functions).

Configure in `backend/.env`:

```env
WEBHOOK_SECRET=<long random>
ORDERS_WEBHOOK_URL=https://your-crm.example.com/hooks/orders
SHIPPING_WEBHOOK_URL=https://shipping-partner.example.com/orders
```

### Google Sheets webhook (ops dashboard)

A standalone **Apps Script** at `webhook-script.js`. Deployed once as a
"Web app" with public access, reachable at `https://script.google.com/.../exec`.

Setup (≈5 minutes, full step-by-step in `README.md`):

1. Create a new Sheet, paste `webhook-script.js` into Apps Script.
2. Replace `API_KEY` in the script with a long random string.
3. Deploy → New deployment → Web app, "Execute as: Me", "Anyone".
4. Set `GOOGLE_SHEETS_WEBHOOK_URL` and `GOOGLE_SHEETS_API_KEY` in
   `backend/.env` (and/or `.env.local` for the in-Next fallback).
5. Run `setupHeaders()` once from the Apps Script editor, OR import
   `sheet-template.csv` into row 1.

The script writes orders to an **Orders** tab and post-purchase upsell
acceptances to an **Upsells** tab. Schema is the 14 columns listed in
`sheet-template.csv`.

### Pixel CAPIs

The same fan-out path also dispatches `Purchase` to all configured CAPIs
in parallel via `services/pixels/dispatch.py` (uses `asyncio.gather` so
a slow vendor doesn't block the others).

---

## Domain rules (NEVER violate)

1. **Money is integer minor units.** 199 SAR = `19900`. Float math is
   forbidden in pricing, totals, or storage. Both TS and Python engines
   honour this.
2. **The client's reported price is ignored.** `POST /orders` (frontend
   route) and the FastAPI endpoint both re-price every cart line from
   the server-side catalog. A malicious user editing Zustand cannot pay
   10 SAR for a 199 SAR product.
3. **Saudi phone validation is strict.**
   - Frontend: `lib/phone.ts` (`validateSaudiPhone`).
   - Backend: `backend/app/core/phone.py` (uses `phonenumbers`).
   - Accepts `05XXXXXXXX`, `+9665XXXXXXXX`, `5XXXXXXXX`, `009665XXXXXXXX`.
   - Rejects fixed-line numbers and non-Saudi numbers.
4. **Tier pricing**: 1 = 199 / 2 = 279 / 3 = 349 SAR. Implemented in
   `lib/pricing.ts` and mirrored in `backend/app/services/pricing.py`.
   The two MUST stay aligned.
5. **Single discount**: only the post-purchase upsell carries a price
   cut (99 SAR fixed). Anywhere else, products carry honest base prices.
   Do not add coupon codes, sitewide sales, or bundle %-off without
   explicit instruction.
6. **One CTA per surface.** No double primary buttons in heroes, no
   competing actions in the cart drawer.
7. **No traditional checkout page.** Checkout is a popup
   (`CodCheckoutModal`) that flows: form → upsell → router push to
   `/thank-you/[orderId]`. Cart is a drawer, never a page.
8. **Brand surface rules**:
   - Tagline ("تفاصيل تصنع الفخامة" / "Details craft luxury.") appears
     in **exactly three places**: hero lockup, header (subtle), footer
     (inline). Never in announcement bars, breadcrumbs, or buttons.
   - Logo `tone="light"` only over photographic heroes. Default is `auto`.
   - Phone numbers always render `dir="ltr"`, even in RTL.
9. **Sticky CTAs do not stack.** `MobileStickyCTA` is `md:hidden`,
   `ProductStickyBar` is `hidden md:block`. They never paint together.
10. **Pure pricing helpers.** `lineTotal()`, `effectiveUnitPrice()`,
    `tierSavings()`, `nextTier()` are pure — safe to call from
    selectors, server actions, and route handlers. Don't re-implement
    `qty × unitPrice` anywhere; it breaks bundles silently.

---

## How to extend the project

### Add a fourth product

```
1. data/products.ts                        Append full product entry (see frontend-docs § 7.1)
2. backend/app/services/catalog.py         Mirror id, slug, base price, offer_tiers, collection
3. data/products.ts → bestSellerIds        (optional) include the new id to surface on home
4. data/collections.ts                     (only if the product introduces a NEW collection)
```

Backend rejects unknown ids during re-pricing — both files MUST stay aligned.

### Change tier ladder

```
1. data/products.ts                        Edit `TIER_OFFER` (or per-product offerTiers)
2. backend/app/services/catalog.py         Mirror the change in `_TIERS`
```

### Tweak post-purchase upsell

```
1. lib/upsell/strategy.ts                  POST_PURCHASE_OFFER_PRICE, POST_PURCHASE_TIMER_SECONDS,
                                           anchor ratios, editorialOverrides, scoring
```

### Add a new dictionary string

```
1. lib/i18n/dictionaries.ts                Edit BOTH the `ar` and `en` blocks
                                           — TS infers types from `ar`; missing keys break the build
```

Templated strings use `{name}` placeholders + `.replace("{name}", value)` in the consumer.

### Add a new pixel event

```
1. lib/analytics.ts                        Add to EventName + PIXEL_NAME_MAP
2. lib/pixels/<vendor>.ts                  Per-platform name map (if the vendor uses different vocab)
3. Caller                                  trackCommerce("my_event", { product, value, ... })
```

### Add a new server-side CAPI

```
1. backend/app/services/pixels/<vendor>.py        send_event(event: PixelEvent) -> ...
2. backend/app/services/pixels/dispatch.py        Register in dispatch_purchase()
3. backend/.env                                   Add VENDOR_PIXEL_ID, VENDOR_CAPI_TOKEN
```

### Add a new webhook destination

```
1. backend/app/services/webhooks.py        New helper (signed dispatch or vendor-specific format)
2. backend/app/services/orders.py          Wire into _fanout_after_create()
3. backend/.env                            Add the URL + auth env
```

### Persist a new order field

```
1. backend/app/db/models.py                Add the column (Mapped[...])
2. Boot the api                            create_all() applies the new column
                                           (Real Alembic migrations are on the TODO list — see below)
3. backend/app/schemas/order.py            Surface in Pydantic (input + output) if customer-facing
4. Consumers (frontend / Sheets)           Update the receipt shape if returned to the client
```

### Add a new section to a page

See `frontend-docs.md § 7.4` for the canonical pattern. Short version:

1. Create `components/sections/MyNewSection.tsx`.
2. Add dictionary entries to both locale blocks of `lib/i18n/dictionaries.ts`.
3. Import and slot into `app/<page>/page.tsx`.

### Common cheat sheet

| Task                              | Files to touch                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| Add a 4th product                 | `data/products.ts` + `backend/app/services/catalog.py` (mirror) + `bestSellerIds` (optional)|
| Change tier ladder                | `data/products.ts` + `backend/app/services/catalog.py`                                       |
| Tweak upsell selection            | `lib/upsell/strategy.ts`                                                                     |
| Tune scarcity hints               | `data/products.ts` (per product `stockLeft`, `recentBuyers`)                                 |
| Add a new dictionary string       | `lib/i18n/dictionaries.ts` (both `ar` and `en` blocks)                                       |
| Add a new pixel event             | `lib/analytics.ts` (`PIXEL_NAME_MAP`) + adapters in `lib/pixels/`                            |
| Add a new CAPI                    | `backend/app/services/pixels/<vendor>.py` + register in `dispatch.py`                        |
| Add a new webhook destination     | Wire in `backend/app/services/orders.py` `_fanout_after_create()`                            |
| Persist a new order field         | `backend/app/db/models.py` + restart for `create_all` (or write Alembic)                     |
| Adjust deferred pixel boot        | `components/providers/PixelProvider.tsx` (`FALLBACK_DELAY_MS`, `INTERACTION_EVENTS`)         |
| Update brand colours / fonts      | `tailwind.config.ts` (or `app/layout.tsx` for fonts)                                         |
| Update logo lockup                | `components/brand/{Logo,BrandMark,Wordmark,Flourish}.tsx`, `app/icon.svg`, `public/brand/*.svg` |

---

## Coding standards

- **TypeScript**: strict mode, no `any` unless interfacing with untyped
  third-party (e.g. `fbq`, `ttq`). Use `type` not `interface` for plain
  data; `interface` only for class / extension targets.
- **Tailwind**: project uses semantic tokens — `bg-bg`, `bg-brand-soft`,
  `text-ink`, `text-muted`, `text-accent`, `border-line`, `shadow-card`,
  `ease-premium`. NEVER use raw Tailwind colours like `bg-amber-500`;
  pull a token from `tailwind.config.ts`.
- **RTL**: use logical CSS (`ps-`, `pe-`, `start-`, `end-`, `ms-`, `me-`)
  not `pl-`/`pr-`. Test the layout in `dir="rtl"`.
- **Comments**: explain *why*, not *what*. The codebase uses doc-block
  preambles on non-trivial files explaining trade-offs and intent.
  Match that voice; no obvious narration.
- **No new dependencies** without checking with the user. The dependency
  surface is intentionally small.
- **Server vs client components**: default to server. Only use
  `"use client"` when the file calls a hook, manages state, or attaches
  an event listener. `useLocale()` requires a client boundary because
  the locale provider is a client context.

---

## Outstanding work (good first PRs)

1. **Phone-OTP confirmation** — currently the COD modal trusts the phone
   field. Add a Twilio Verify (or Unifonic for KSA) OTP step gated by
   a feature flag. Insert it between form-validate and order-submit.
2. **Address capture (post-COD)** — current funnel skips address by
   design. Add an optional second screen on the thank-you page that
   captures city + landmark, posted to `PUT /orders/{id}` and dispatched
   to the shipping webhook on save.
3. **Returns portal** — `/returns` page with order id + phone lookup,
   posts to a new `/orders/{id}/return-request` route.
4. **Real Alembic migrations** — the current `Base.metadata.create_all`
   is fine for an MVP but should graduate to Alembic before the schema
   gains foreign keys to other tables.
5. **Email transactional sender** — backend doesn't email today. Wire
   Resend / SES with templates that mirror the brand's typographic style.
6. **Live inventory** — backend `Order` model has no inventory check.
   Add an `inventory_count` column to a future `products` table and
   reserve+release on order create. Once live, swap `stockLeft` /
   `recentBuyers` on `data/products.ts` from static numbers to live
   computed values surfaced through the API.
7. **Real-time activity counter** — replace the per-session random in
   `CheckoutScarcityBanner` with a live count from a presence channel
   (Vercel KV / Pusher / Ably).
8. **Reviews ingestion** — the `reviews` array on each product is
   editorial. Wire to a real review platform (Stamped.io / Loox /
   Junip) and read on the server, falling back to the editorial set.
9. **Search** — the header has a search button that's currently
   non-functional. Wire to a typesense/algolia index over products.

---

## Final reminder

The user is a non-technical founder. Always:

- Explain WHAT the change does and WHY it converts better in 1–2 lines.
- Avoid jargon ("server-trusted re-pricing" → "we ignore the cart price
  in case it was tampered with, and recompute from our own catalog").
- When you ship a feature, mention how to test it in the running app.
- Never claim work is done if you only edited types or stubs — verify
  the change loads in the running stack (`docker compose up --build`).
- Respect the brand voice — copy is **Saudi dialect**, never formal
  Arabic, never translated word-for-word.

For the deep frontend reference, see [`frontend-docs.md`](./frontend-docs.md).
For the operational README (env vars, deployment, webhook setup), see
[`README.md`](./README.md).

Welcome to ELFANAA. Treat every detail like it'll be on camera.
