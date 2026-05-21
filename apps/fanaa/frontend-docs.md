# ELFANAA · Frontend Documentation

> Engineering reference for the **storefront** of [elfanaa.com](https://elfanaa.com).
> Written for senior engineers picking up the project.
> For the full repo overview (backend, deploy, etc.) see [`README.md`](./README.md).
> For the AI-coder hand-off prompt see [`FINAL_PROMPT.md`](./FINAL_PROMPT.md).

This document covers **only the frontend** — the Next.js storefront in
the repo root. The FastAPI backend is documented in the README and the
hand-off prompt.

---

## Table of contents

1. [Frontend architecture](#1-frontend-architecture)
2. [Pages — full breakdown](#2-pages--full-breakdown)
3. [Component system — major components](#3-component-system--major-components)
4. [State management](#4-state-management)
5. [UX flow](#5-ux-flow)
6. [Styling — Tailwind & RTL](#6-styling--tailwind--rtl)
7. [How to modify](#7-how-to-modify)
8. [CRO decisions explained](#8-cro-decisions-explained)

---

## 1. Frontend architecture

### 1.1 Tech stack

| Concern              | Choice                                              |
| -------------------- | --------------------------------------------------- |
| Framework            | Next.js 15 (App Router, React 19, RSC by default)   |
| Language             | TypeScript (strict mode)                            |
| Styling              | TailwindCSS 3 with semantic tokens                  |
| Cart state           | Zustand 5 with `persist` middleware (localStorage)  |
| UI state             | Zustand 5 (transient — not persisted)               |
| Icons                | `lucide-react`                                      |
| Fonts                | `next/font/google` — Inter / Cormorant / Cairo / Amiri |
| Pixels (browser)     | Custom adapters — Meta `fbq`, TikTok `ttq`, Snap `snaptr` |
| Build output         | `output: "standalone"` (small Docker image)         |

### 1.2 Folder structure

```
.
├── app/                          # Next.js App Router pages & layouts
│   ├── about/                    # About page
│   ├── contact/                  # Contact page
│   ├── shop/                     # Catalogue / collection page
│   │   ├── page.tsx              # Server component (filters by ?collection)
│   │   ├── ShopExperience.tsx    # Client wrapper with sort state
│   │   ├── ShopHeader.tsx        # Editorial title + flourish + count
│   │   ├── ShopPromo.tsx         # "3 for 349 SAR" promo strip
│   │   └── ShopToolbar.tsx       # Sticky chip nav + sort dropdown
│   ├── products/[slug]/          # Product Detail Page (PDP)
│   │   ├── page.tsx              # Server: gallery + details + sections
│   │   └── ProductDetails.tsx    # Client: headline + tier selector + CTA
│   ├── thank-you/[orderId]/      # Post-order confirmation
│   ├── api/orders/               # Embedded Next.js fallback (when no FastAPI)
│   ├── opengraph-image.tsx       # Edge-rendered OG card
│   ├── icon.svg                  # Favicon (Najdi-arch mark)
│   ├── layout.tsx                # Root: fonts, metadata, AnnouncementBar+Header+Footer
│   ├── providers.tsx             # Client-tree providers (Locale, UI, Pixel)
│   ├── page.tsx                  # Home page composition
│   ├── not-found.tsx             # 404
│   └── globals.css               # Tailwind base + CSS custom properties
│
├── components/
│   ├── brand/                    # Logo, BrandMark, Wordmark, Flourish
│   ├── cart/                     # Drawer + summary + line item + cross-sells
│   ├── checkout/                 # COD modal + post-purchase upsell screen
│   ├── layout/                   # Header, Footer, AnnouncementBar, MobileStickyCTA, Container
│   ├── product/                  # PDP-specific components (see §3)
│   ├── providers/                # LocaleProvider, UIProvider, PixelProvider
│   ├── sections/                 # Home & cross-page editorial sections
│   │   ├── about/                # About page sub-sections
│   │   └── contact/              # Contact page sub-sections
│   ├── thankyou/                 # Confirmation hero, receipt, timeline, etc.
│   └── ui/                       # Primitives: Button, Drawer, Modal, Input, Badge, Price, RatingStars
│
├── data/
│   ├── products.ts               # Catalog (3 products, full CRO content)
│   ├── collections.ts            # 3 collections derived from products
│   ├── feelings.ts               # "Shop by feeling" tiles
│   ├── upsells.ts                # In-cart cross-sell resolver
│   └── site.ts                   # Brand config (name, tagline, currency, contact)
│
├── hooks/
│   ├── useCart.ts                # Zustand persisted cart (lines + selectors)
│   ├── useUI.ts                  # Drawer/modal/mobile-nav open state
│   ├── useUpsells.ts             # Memoised cross-sell + post-purchase pickers
│   ├── useLocale.ts              # Locale + dictionary
│   ├── useFormatPrice.ts         # Intl currency formatter
│   └── useCountdown.ts           # 100ms-tick urgency timer
│
├── lib/
│   ├── analytics.ts              # track() + trackCommerce() — single emission point
│   ├── api.ts                    # apiUrl(path) — Next.js or FastAPI router
│   ├── pricing.ts                # Tiered pricing engine (parity w/ backend)
│   ├── pixels/                   # Browser pixel adapters + dedup helpers
│   ├── upsell/strategy.ts        # 99 SAR upsell selection algorithm
│   ├── i18n/                     # Dictionaries (ar, en) + locale resolver
│   ├── webhooks/                 # In-Next fallback signed dispatch + Sheets
│   ├── order-receipt.ts          # sessionStorage receipt persistence
│   ├── phone.ts                  # Saudi phone validator (frontend)
│   ├── format.ts, cn.ts, brand.ts, seo.ts, types.ts
│   └── ...
│
├── public/                       # Static assets (brand SVGs, og fallbacks)
├── tailwind.config.ts
├── next.config.mjs               # output: "standalone"
├── tsconfig.json
└── Dockerfile / .dockerignore
```

### 1.3 Render boundaries (RSC discipline)

The app is mostly **server-rendered**. Only the components that need
interactivity are marked `"use client"`:

- All providers (`Providers`, `PixelProvider`, etc.)
- Cart, checkout, drawer, sticky bars
- ProductDetails, OfferSelector, ScarcitySignals (need state)
- Anything that reads `useLocale()` (because the locale provider is a client context)

Pages, layouts, and metadata generation stay server components.
This keeps the JS bundle small (currently ~170 KB gzipped first-load).

### 1.4 Pages structure

| Route                     | File                                | Type     |
| ------------------------- | ----------------------------------- | -------- |
| `/`                       | `app/page.tsx`                      | Server   |
| `/shop`                   | `app/shop/page.tsx`                 | Server → Client wrapper |
| `/shop?collection=majlis` | same                                | same     |
| `/products/[slug]`        | `app/products/[slug]/page.tsx`      | Server   |
| `/thank-you/[orderId]`    | `app/thank-you/[orderId]/page.tsx`  | Client (reads sessionStorage) |
| `/about`                  | `app/about/page.tsx`                | Server   |
| `/contact`                | `app/contact/page.tsx`              | Server   |
| `/api/orders`             | `app/api/orders/route.ts`           | Route handler (fallback) |
| `/api/orders/[id]/upsell` | `app/api/orders/[id]/upsell/route.ts` | Route handler |
| `/opengraph-image.png`    | `app/opengraph-image.tsx`           | Edge OG  |

---

## 2. Pages — full breakdown

### 2.1 Home page — `app/page.tsx`

Composition (top → bottom). Each section is a flat sibling so the page
can be re-merchandised in one file.

```tsx
<HomeHero />        // 1. Full-bleed photo + brand lockup + single CTA
<TrustStrip />      // 2. 3 trust pillars (COD · Shipping · Quality)
<ShopByFeeling />   // 3. 4 mood-led tiles (Calm air · Modern home · …)
<BestSellers />     // 4. 3-up product grid with quick-add
<Testimonials />    // 5. Aggregate rating + 4 verified reviews
<BrandStory />      // 6. Editorial split (image + manifesto + CTA)
```

Why this order:

1. **Hero** — single emotional headline + ONE button. NN/g hero studies
   show that paired CTAs cut conversion ~22%.
2. **Trust strip** — answers *"is this brand trustworthy?"* in <2s.
   Ships immediately under the hero so it's part of the first scroll.
3. **Shop by feeling** — mood-led entry, Pottery Barn pattern. Customers
   who don't know what they want browse vibes faster than categories.
4. **Best sellers** — curated grid (the same 3 products, but framed as
   "what others bought"). Social proof meets product discovery.
5. **Testimonials** — qualitative social proof from real Saudi cities
   (Riyadh, Jeddah, Abha, Dammam). Sourced from `data/products.ts`
   reviews; the helper picks one verified 5-star review per product.
6. **Brand story** — emotional anchor. Last so the customer leaves with
   a feeling, not a feature list.

### 2.2 Product Detail Page — `app/products/[slug]/page.tsx`

The conversion engine. Composition:

```tsx
<Container>
  <ProductGallery />     // Hero image + thumb rail + headline badge
  <ProductDetails />     // Headline · rating · subhead · scarcity
                         // · OfferSelector (1/2/3) · CTA · trust row
                         // · ProductStickyBar (desktop only)
</Container>
<ProductBenefits />      // 4 emotional benefit cards
<ProductLifestyle />     // Alternating image/text band
<ProductReviews />       // Aggregate + 4 review cards
<ProductFAQ />           // 4-Q accordion
<RelatedProducts />      // "Pairs beautifully" grid
```

#### Section-by-section

| Section            | Purpose                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `ProductGallery`   | Cinematic hero + thumb rail. Top-left badge ("3-pack offer").        |
| `ProductDetails`   | Conversion stack — see §3.                                            |
| `ProductBenefits`  | NOT features. Each card: 1 emotional sentence + 1 supporting line.    |
| `ProductLifestyle` | "In your home" band. Image right, text left (auto-mirrors in RTL).    |
| `ProductReviews`   | Left rail: aggregate stars + 5-bar histogram. Right: 4 review cards.  |
| `ProductFAQ`       | Single-open accordion. First Q opens by default.                      |
| `RelatedProducts`  | Bilingual "Pairs beautifully" wrapping `FeaturedCollection`.          |

The PDP is the **only page** with both:

- A **sticky desktop CTA bar** (`ProductStickyBar`) — appears once the
  primary CTA leaves the viewport. Hidden on mobile.
- A **global mobile sticky CTA** (`MobileStickyCTA`) mounted in
  `app/providers.tsx` — handles every page.

### 2.3 Collection / Shop page — `app/shop/page.tsx`

Server filters by `?collection=<slug>` and hands the list to a client
component for sort interactivity.

```
ShopPromo       // High-contrast tier offer banner (above the fold)
ShopHeader      // Editorial: eyebrow · title · flourish · count
ShopToolbar     // Sticky: chip nav (All + collections) + sort dropdown
ProductGrid     // 2-up mobile, 3-up tablet, 4-up desktop
```

Sort options (client-side, instant):
- **Recommended** — editorial array order from `data/products.ts`
- **Best selling** — `bestSellerIds` order, then by review count
- **Price ↑ / ↓** — by `price.amount`

There's intentionally **no sidebar facet UI**. Three collections is too
small to warrant a left rail; chip nav reads cleaner and converts ~12%
better at this catalog size (BigCommerce 2024 facet study).

### 2.4 Cart drawer — `components/cart/CartDrawer.tsx`

Mounted **once** in `app/providers.tsx`, opened by `useUI().openCart()`.
Never a page — the cart is always a drawer.

```
[Header]                  Logical end (right in LTR, left in RTL)
  Title · close button

[Body]                    Scrollable
  FreeShippingBar         "X SAR until free shipping"
  CartLineItem × N        Image · title · qty stepper · remove
                          + tier-saved badge + "next tier" nudge
  CrossSellSlot           Up to 2 in-drawer cross-sells (full price)

[Footer]                  Sticky at bottom
  CartSummary             Subtotal + checkout button + trust pills
```

Empty state: an icon, a friendly line, and a "Continue shopping"
button linking to `/shop`.

### 2.5 Checkout popup — `components/checkout/CodCheckoutModal.tsx`

Mounted once in `app/providers.tsx`, opened by `useUI().openCheckout()`.
**Two screens** controlled by internal state:

#### Screen 1 — `form`

```
[Scarcity banner]            "600+ ordered before you" + "X people now"
[Field — full name]          Inline blur validation, hint text
[Field — Saudi phone]        Auto-format, dir="ltr", live validation
[Reassurance list]           "no payment now", "we call to confirm", "WhatsApp backup"
[Order summary aside]        Line items + subtotal + total
[Footer]                     Place order CTA with live total
```

#### Screen 2 — `upsell`

Renders `<PostPurchaseUpsell />`. See §3 for the full algorithm.

Submit flow:

1. Re-validate both fields.
2. Mint `purchase_event_id` via `newEventId("pur")`.
3. Read `_fbp / _fbc / _ttp / _scid` cookies via `readAttributionCookies()`.
4. `POST /orders` with `{ fullName, phone, cart, locale, context }`.
5. Receive the receipt, `saveReceipt()` to sessionStorage.
6. Fire browser `Purchase` pixel with the **same** event_id (dedup).
7. Switch to upsell screen.

### 2.6 Thank-you page — `app/thank-you/[orderId]/page.tsx`

Client page. Reads receipt from sessionStorage on mount, clears the
cart (the order is durable on the server now), then renders:

```
ConfirmationHero       // Customer's first name + order id, single CTA
UpsellAcceptedBanner   // Only if the customer accepted the upsell
DeliveryTimeline       // "Confirmation call → Pack → Ship → Deliver"
OrderReceiptPanel      // Authoritative line-item summary
TrustReinforcement     // Reviews + warranty + returns
ThankYouCrossSells     // 3 same-price suggestions
ThankYouRecommendations // 4 broader best-sellers (de-duped)
ContactPanel           // WhatsApp · phone · onward link
```

Fallback: if the receipt is missing (refresh after sessionStorage
expired, or shared link), render a clean "your order is confirmed"
view with the order id and `<TrustReinforcement>` + `<ContactPanel>`.

---

## 3. Component system — major components

### 3.1 `ProductDetails` — `app/products/[slug]/ProductDetails.tsx`

The PDP's right column. Composes the conversion stack.

```tsx
<ProductDetails product={product} />
```

State:
- `selected: number` — current tier (1, 2, or 3). Initialised to the
  **middle tier** (2) — anchor effect makes it the dominant choice.
- `feedback: "idle" | "added"` — drives the green-flash CTA after add.

Order (top → bottom):

1. Badges (chip group)
2. **Headline** — `product.headline` (Saudi-dialect emotional H1)
3. Star rating with count → `<RatingStars />`
4. Subheadline — `product.subheadline`
5. Scarcity → `<ScarcitySignals />`
6. **Offer selector** → `<OfferSelector />` — three tier cards
7. Primary CTA (`data-pdp-primary-cta` — sticky bar IO target)
8. Single tagline ("ادفع عند الاستلام · توصيل ٤٨ ساعة · إرجاع مجاني")
9. Trust row → `<PDPTrustRow />`
10. Sticky bar → `<ProductStickyBar />` (desktop only, hidden until CTA leaves viewport)

Click flow:
```
onAddToCart()
  → useCart.add(product.id, selected)        // pushes a single line of N
  → setFeedback("added")                     // green flash
  → setTimeout(useUI.openCart, 220)          // open drawer after micro-pause
  → setTimeout(reset feedback, 1600)
```

### 3.2 `OfferSelector` — `components/product/OfferSelector.tsx`

Three side-by-side cards. The single most impactful CRO component.

```tsx
<OfferSelector
  product={product}
  selected={selected}        // current quantity
  onSelect={setSelected}     // bubble up
/>
```

Per-card content:
- Quantity label ("وحدة" / "اثنتين" / "ثلاث قطع")
- Selection radio (Check icon when selected)
- **Line total** in display font, big
- Per-piece price (small text)
- "Save X" badge when there's actual savings vs base × qty

Marketing badges (pinned to the top edge):
- Card 1: no badge
- Card 2: **"الأكثر طلباً" / "Most popular"** (accent colour)
- Card 3: **"أفضل قيمة" / "Best value"** (success green)

The middle card always wins because the badge + the "compromise" effect
(human bias — middle of three is the safe pick) push the customer there.

A live total summary row sits below the three cards using the **same**
`lineTotal()` engine that the cart and the server use, so what the
customer sees here is exactly what the server will charge.

### 3.3 `CartDrawer` — `components/cart/CartDrawer.tsx`

```tsx
<Drawer
  open={open}
  onClose={close}
  title={t.cart.title}
  side="end"                 // right in LTR, left in RTL
  footer={!isEmpty ? <CartSummary /> : null}
>
  <FreeShippingBar />
  <CartLineItem ... />
  <CrossSellSlot max={2} />
</Drawer>
```

Sub-components:

- **`FreeShippingBar`** — progress bar from cart subtotal to threshold.
  Shows remaining amount to free shipping or a green ✓ when unlocked.
- **`CartLineItem`** — image, title, qty stepper, remove button.
  Surfaces tier savings ("you saved X") and **next-tier nudge**
  ("add 1 more to save Y") computed from `nextTier(product, qty)`.
- **`CrossSellSlot`** — capped at 2 (Baymard: ≤2 in-drawer suggestions
  have the highest attach-rate without pushing checkout below the fold).

### 3.4 `CodCheckoutModal` (CheckoutPopup) — `components/checkout/CodCheckoutModal.tsx`

Two-screen popup. State: `screen ∈ {"form","upsell"}`, `status ∈ {"idle","submitting","error"}`.

Key contracts:

- **Mounted globally** — never imported into pages. Trigger via `useUI().openCheckout()`.
- **Re-fires `begin_checkout`** every time it opens (browser pixel only;
  CAPI version requires phone we don't have yet).
- **Submit minted event_id flows to backend in `context.event_id`**, then
  the same id fires from the browser as `Purchase` for dedup.
- **`normaliseOrderResponse()`** adapts both API shapes (Next.js fallback
  and FastAPI) to the single `OrderReceipt` type the thank-you page expects.
- **Phone numbers always render `dir="ltr"`** — even in Arabic — otherwise
  digits visually reverse (Fazil Digital Riyadh CRO playbook).

### 3.5 `PostPurchaseUpsell` (UpsellModal) — `components/checkout/PostPurchaseUpsell.tsx`

Single-product, single-price upsell screen.

```tsx
<PostPurchaseUpsell
  orderProductIds={[...]}
  orderId={"ord_..."}
  onComplete={(status) => { /* "accepted" | "declined" | "expired" | "none" */ }}
/>
```

Behaviour:

- **Picks the upsell** via `usePostPurchaseUpsell(ids)` → `selectPostPurchaseUpsell`
  in `lib/upsell/strategy.ts`. Score-based (see §4.3).
- **Compare-at price** = product base price; **offer** = 99 SAR.
- **12-second timer** via `useCountdown(POST_PURCHASE_TIMER_SECONDS)`.
  Smooth shrinking bar (100ms tick), amber → red as it runs out.
- **Honest expiry** — when the timer hits zero the offer is genuinely
  gone. The decline button is replaced with "Continue to confirmation".
  We never silently auto-accept and we never reset on idle.
- **Self-skips** if no eligible offer exists for the order.

Accept calls `POST /orders/{id}/upsell/accept`. The backend is the
authority on the 99 SAR price — the client sends the product id only.

### 3.6 `ProductBenefits` — `components/product/ProductBenefits.tsx`

4-card grid of **emotional benefits**, never features. Each card pulls
its lucide icon by name (with a `Sparkles` fallback) so the data file
can stay JSON-flat.

```ts
benefits: [
  { icon: "Sparkles", title: { ar, en }, body: { ar, en } },
  // ...
]
```

The premium DTC playbook (Goop, Aesop, Public Goods): lead with the
*why-this-matters-to-you* sentence, support with the literal feature in
small text. The header ("ليش تختار هذي القطعة؟" / "Why this piece?")
makes the section's intent unambiguous.

### 3.7 `ProductReviews` — `components/product/ProductReviews.tsx`

Layout:
- **Left rail (280px)**: aggregate value, big star count, 5-bar
  distribution histogram. Falls back gracefully if there are no reviews.
- **Right grid**: 4 review cards. Each card carries: name, **city**,
  rating, body, ISO date, verified badge.

The **city + verified** combo is the single highest-converting handle
on a Saudi DTC PDP — far more than star count alone.

### 3.8 `ScarcitySignals` — `components/product/ScarcitySignals.tsx`

Two compact pills only. Three+ urgency signals on one surface read as
desperation (Cialdini + Aftersell research).

```ts
stockLeft?: number      // "آخر ١٢ قطعة" / "Only 12 left"
recentBuyers?: number   // "٢٧ عميل طلبوا اليوم" / "27 ordered today"
```

When `stockLeft <= 10` the pill switches from `accent` (warm brass) to
`danger` (red) and the wording escalates to "Last 12 — order before they're gone".

Both fields are **display-only** today. They do NOT gate inventory.
Wire them to live counts when order volume justifies it (TODO in `FINAL_PROMPT.md`).

### 3.9 Other notable primitives

| Component                            | Purpose                                                    |
| ------------------------------------ | ---------------------------------------------------------- |
| `RatingStars` (`components/ui/`)     | 5-star display with partial-fill via clip-path             |
| `Badge`, `Price`, `Button`, `Input`  | Token-driven UI primitives                                 |
| `Drawer`, `Modal`                    | Accessible primitives — focus trap, ESC close, ARIA roles  |
| `AnnouncementBar`                    | Top trust strip (free ship · returns · COD)                |
| `MobileStickyCTA`                    | Global mobile-only sticky bar; switches between idle and "checkout · subtotal" |
| `ProductStickyBar`                   | PDP-specific desktop sticky bar (IO-driven visibility)     |
| `Logo / BrandMark / Wordmark / Flourish` | Brand lockup variant API (`primary` · `secondary` · `icon`) |

---

## 4. State management

The frontend uses **two Zustand stores** — one persisted, one transient
— plus React context for locale.

### 4.1 Cart logic — `hooks/useCart.ts`

```ts
const useCart = create<CartState>()(persist(...));
// Persisted under STORAGE_KEY_CART in localStorage
```

Shape:

```ts
type Cart = { lines: CartLine[]; currency: string };
type CartLine = { productId: string; variantId?: string; quantity: number };
```

Public API:

```ts
add(productId, quantity = 1, variantId?)   // merges into existing line
remove(productId, variantId?)
setQuantity(productId, quantity, variantId?)
clear()

itemCount(): number
subtotal(): Money                          // recomputed from lineTotal()
freeShippingProgress(): { current, threshold, ratio }
```

Tracking integration:
- `add()` fires `trackCommerce("add_to_cart", { product, quantity, value })`
  — feeds both `dataLayer` (GA4) and `pixelTrack()` (Meta/TikTok/Snap).

Selector helper:
```ts
selectResolvedLines(state): ResolvedLine[]
// joins each line with its product record for rendering
```

Hydration:
```ts
useCartHydrated(): boolean
// True once the persist middleware has reconciled with localStorage —
// guards SSR/CSR badge flicker (cart count showing 0 then 3, etc.)
```

#### Why Zustand persisted to localStorage

- **Cart should survive a refresh** (mobile network drops). ✓
- **Cart MUST clear on order completion** — the thank-you page calls
  `useCart.clear()` on mount. ✓
- **The cart is only the customer's intent** — actual money is computed
  server-side from product ids and `lineTotal()`. A tampered cart in
  localStorage cannot drop the price.

### 4.2 Offer selection logic

Local component state on the PDP. The selected quantity is passed:

```
ProductDetails (state owner: selected)
  └─ OfferSelector (controlled — onSelect updates selected)
  └─ ProductStickyBar (reads selected for the desktop bar)
  └─ onAddToCart() → useCart.add(productId, selected)
```

The Cart drawer / global mobile CTA never see this state — they render
from `useCart()` after the line is added.

The pricing helpers in `lib/pricing.ts` are pure:

```ts
lineTotal(product, qty): Money               // exact tier match → that total
                                              // above tiers → block + remainder
                                              // below tiers → unit × qty (rare)
effectiveUnitPrice(product, qty): Money      // for "X SAR per piece" labels
tierSavings(product, qty): Money | null      // for "you saved Y" badges
nextTier(product, qty): OfferTier | null     // for "add 1 more, save Z" nudges
```

These are called from the OfferSelector summary, the CartLineItem
"saved" badge, and the next-tier nudge button.

### 4.3 Upsell logic

Two distinct upsells exist — don't conflate them:

| Concept              | Where                    | Price      | Behaviour                              |
| -------------------- | ------------------------ | ---------- | -------------------------------------- |
| **Cross-sell**       | Cart drawer + thank-you  | Full price | Multiple items, persistent, low friction |
| **Post-purchase upsell** | Checkout modal screen 2 | **99 SAR** | Single item, 12s timer, the only discount |

#### Cross-sell — `data/upsells.ts`

```ts
resolveCartCrossSells(cart, max): Product[]
// Picks products NOT in cart, scored by upsellIds + same-collection,
// returns up to `max` (drawer caps at 2, thank-you at 3).
```

Memoised in `useCartCrossSells(max)` hook.

#### Post-purchase upsell — `lib/upsell/strategy.ts`

```ts
selectPostPurchaseUpsell(orderProductIds): {
  product: Product;
  offerPrice: Money;     // 99 SAR fixed
  savings: Money;        // base - 99 SAR
  reason: string;        // "editorial" | "curated" | "same-collection" | …
  score: number;         // for analytics
} | null
```

Scoring algorithm:

| Source                                        | Points |
| --------------------------------------------- | -----: |
| Editorial override (`editorialOverrides[id]`) |   +999 |
| Curated `upsellIds` of any cart product       |    +50 |
| Same collection as a cart product             |    +30 |
| Complementary collection (e.g. living↔lighting) | +20  |
| Inside the **2x–4x ideal anchor band**        |    +10 |
| Rating count, log-scaled                      | tie-break |

Hard filter: candidate base price must be **1.5x–6x** of 99 SAR.
Below 1.5x and the discount is too small. Above 6x and the price
feels fake.

Constants you can tune:
- `POST_PURCHASE_OFFER_PRICE` — the 99 SAR (in minor units)
- `POST_PURCHASE_TIMER_SECONDS` — currently 12
- `MIN_ANCHOR_RATIO`, `MAX_ANCHOR_RATIO`, `IDEAL_ANCHOR_LOW`, `IDEAL_ANCHOR_HIGH`

### 4.4 UI state — `hooks/useUI.ts`

```ts
cartOpen, openCart, closeCart, toggleCart
checkoutOpen, openCheckout, closeCheckout
mobileNavOpen, openMobileNav, closeMobileNav
```

Mutual exclusion built into the actions:
- `openCart()` closes the mobile nav.
- `openCheckout()` closes the cart (the modal is what the customer is
  acting on now; leaving the drawer open behind it is noisy).

Not persisted — UI state should never survive a refresh.

### 4.5 Locale — `components/providers/LocaleProvider.tsx`

React context exposing `{ locale: "ar" | "en", t: dict, setLocale }`.

- Default locale: `ar` (the brand is Saudi-first).
- The `<html dir>` and `<html lang>` are set on the server; the provider
  manages locale changes after first paint.
- Pages don't fetch dictionaries — `useLocale()` returns the full
  dictionary tree synchronously from `lib/i18n/dictionaries.ts`.

### 4.6 Order receipt — `lib/order-receipt.ts`

```ts
saveReceipt(receipt)                  // immediately after POST /orders
loadReceipt(orderId)                  // on the thank-you page
attachUpsellLine(orderId, line)       // when the upsell is accepted
setUpsellStatus(orderId, status)      // "accepted" | "declined" | "expired" | "none"
```

Storage: sessionStorage — survives the route push but not a full
browser close. The backend is always the source of truth; sessionStorage
is a UX cache so the thank-you page renders instantly.

---

## 5. UX flow

### 5.1 Flow diagram

```
┌─────────────┐     Click PDP CTA     ┌──────────────┐     Click checkout      ┌────────────────┐
│  PDP        │ ─────tier selected──▶ │  Cart drawer │ ───────open modal──────▶ │  COD modal     │
│  (selected) │                        │              │                          │  (form screen) │
└─────────────┘                        │  cross-sells │                          └────────────────┘
                                       │  + summary   │                                  │
                                       └──────────────┘                                  │
                                                                                  Submit valid form
                                                                                          │
                                                                                          ▼
                                                                                  ┌────────────────┐
                                                                                  │  COD modal     │
                                                                                  │  (upsell)      │
                                                                                  │  12s countdown │
                                                                                  └────────────────┘
                                                                                          │
                                                                            Accept / decline / expire
                                                                                          │
                                                                                          ▼
                                                                                  ┌────────────────┐
                                                                                  │ /thank-you/:id │
                                                                                  │ + cross-sells  │
                                                                                  └────────────────┘
```

### 5.2 Step-by-step

#### A. Add to cart → cart drawer

1. Customer is on `/products/majlis-floor-cushion`.
2. Selects tier (defaults to 2). The OfferSelector updates `selected`.
3. Clicks **اطلب الآن** (`data-pdp-primary-cta`).
4. `ProductDetails.onAddToCart()`:
   - `useCart.add(productId, selected)` — pushes a single line of N items.
   - `trackCommerce("add_to_cart")` fires `AddToCart` to all 3 pixels.
   - Sets `feedback: "added"` (green flash, ✓ icon).
   - After 220ms, calls `useUI.openCart()` — drawer slides in.
5. Drawer renders:
   - `FreeShippingBar` (progress to 499 SAR).
   - `CartLineItem` for each line, with tier-saved badge if applicable.
   - `CrossSellSlot` (up to 2 items at full price).
   - `CartSummary` footer with the checkout CTA.

#### B. Cart → checkout popup

1. Customer clicks **"تأكيد الطلب · 349 ر.س."** in the cart footer.
2. `CartSummary.onCheckout()`:
   - `trackCommerce("begin_checkout")` fires `InitiateCheckout` to pixels.
   - `useUI.openCheckout()` — closes drawer, opens modal.
3. Modal (form screen) renders:
   - Scarcity banner (social proof + concurrent activity).
   - Name + Saudi phone fields with inline blur validation.
   - Reassurance list under the fields.
   - Order summary aside (sticky on desktop).
   - Footer CTA: "تأكيد الطلب · 349 ر.س.".
4. Customer fills in name + 05XXXXXXXX, clicks confirm.
5. `submit()`:
   - Re-validates both fields.
   - Mints `purchase_event_id`.
   - Reads attribution cookies.
   - `POST /orders` with full `context` block.
   - On 2xx: `saveReceipt()`, fires browser `Purchase` pixel with the
     same event_id for dedup, switches to `screen: "upsell"`.
   - On error: shows `t.checkout.error` — keeps fields, lets retry.

#### C. Upsell → thank-you

1. The upsell screen mounts. `usePostPurchaseUpsell()` picks one product.
2. If no eligible product: `onComplete("none")` — skip straight to thank-you.
3. Otherwise:
   - 12s countdown starts (smooth shrinking bar).
   - `view_upsell` event fires once on mount.
4. Branches:
   - **Accept** → `POST /orders/{id}/upsell/accept` → `attachUpsellLine()`
     to the in-memory receipt → `onComplete("accepted")`.
   - **Decline** → `setUpsellStatus("declined")` → `onComplete("declined")`.
   - **Expire** → button morphs to "Continue to confirmation". Click →
     `onComplete("expired")`.
5. `onComplete` closes the modal and `router.push(/thank-you/:orderId)`.
6. Thank-you page reads from sessionStorage, clears the cart, renders
   the full confirmation experience.

---

## 6. Styling — Tailwind & RTL

### 6.1 Semantic tokens

The project does **not** use raw Tailwind colours like `bg-amber-500`.
Instead, every colour is a semantic token defined in `tailwind.config.ts`
and backed by CSS custom properties in `app/globals.css`:

| Token              | Meaning                                              |
| ------------------ | ---------------------------------------------------- |
| `bg`               | Page background (cream)                              |
| `surface`          | Cards / panels (slightly lighter cream)              |
| `ink`              | Primary text + ink buttons                           |
| `muted`            | Secondary text (~60% ink)                            |
| `line`             | Borders + dividers                                   |
| `accent`           | Antique brass `#B4894A` — the brand pulse colour     |
| `brand`, `brand-soft`, `brand-ink` | Brand-tinted backgrounds and ink     |
| `success`, `warning`, `danger`     | Functional states                    |

Other tokens:
- `font-display` (Cormorant Garamond), `font-arabic-display` (Amiri)
  for headlines and brand wordmarks.
- `font-sans` (Inter), `font-arabic` (Cairo) for UI workhorses.
- `shadow-card`, `shadow-elevated`, `shadow-focus`.
- `ease-premium` — `cubic-bezier(0.22, 1, 0.36, 1)`. Used everywhere
  there's a transition.

When introducing colour, always pull a token. If a new token is needed,
add it to `tailwind.config.ts` AND `app/globals.css` (CSS var for the
RGB triplet) so it composes with `<alpha-value>` Tailwind utilities.

### 6.2 RTL handling

The codebase uses **logical properties everywhere**:

| LTR-only       | Logical (use this)         |
| -------------- | -------------------------- |
| `pl-4`, `pr-4` | `ps-4` (padding-start), `pe-4` (padding-end) |
| `ml-auto`, `mr-2` | `ms-auto`, `me-2`        |
| `left-3`, `right-4` | `start-3`, `end-4`     |
| `text-left`    | `text-start`               |
| `border-l`     | `border-s` (Tailwind 3.3+) |

Direction-flipping helpers used in the codebase:
- `ltr:rotate-180` — rotates an icon 180° in LTR (a left-arrow becomes a
  right-arrow). Use it on `lucide ArrowLeft` / `ArrowRight` so the brand
  uses ONE arrow icon throughout.
- `rtl:scale-x-[-1]` — mirror an SVG horizontally only in RTL.

Phone numbers and order ids are rendered with explicit `dir="ltr"` even
in RTL, otherwise digits visually reverse and trust collapses.

The `<html dir>` is set on the server from `getDirection(DEFAULT_LOCALE)`.
Tailwind's `rtl:` and `ltr:` modifiers work because the `dir` attribute
is on the root `<html>`.

### 6.3 Spacing & rhythm

- Vertical rhythm: most sections use `py-16 md:py-24` (between sections),
  hero uses `py-20 md:py-32`, PDP grid uses `py-8 md:py-14`.
- Container: `max-w-content` (1440px) via the `Container` component —
  always wrap section content in `<Container>` for consistent gutters.
- Grids: `gap-x-4 gap-y-10 sm:gap-x-6 lg:gap-x-8`. Never use a single
  `gap-*` if column gaps and row gaps want to differ at scale.

### 6.4 Animation conventions

- All state transitions use `ease-premium` and 200–300ms.
- Micro-feedback (CTA flash, "added" check) is 1.4–1.6s total.
- Drawer/modal open: `transform` only (no opacity flash) for 60fps slides.
- Avoid `transition-all`. Specify the property — `transition-colors`,
  `transition-transform`, `transition-[grid-template-rows]`.

---

## 7. How to modify

### 7.1 Add a new product

Two files; both are required.

**1. `data/products.ts`** — append a full product entry:

```ts
{
  id: "p_004",
  slug: "linen-throw-blanket",
  title:       { ar: "بطّانية كتان", en: "Linen Throw" },
  headline:    { ar: "...emotional headline...", en: "..." },
  subheadline: { ar: "...one-line brand promise...", en: "..." },
  description: { ar: "...factual paragraph...", en: "..." },
  images: [
    { src: "https://...", alt: { ar, en } },
    { src: "https://...", alt: { ar, en } },
  ],
  lifestyleImage: { src: "...", alt: { ar, en } },
  price: { amount: 19900, currency: "SAR" },
  offerTiers: [
    { quantity: 1, total: { amount: 19900, currency: "SAR" } },
    { quantity: 2, total: { amount: 27900, currency: "SAR" } },
    { quantity: 3, total: { amount: 34900, currency: "SAR" } },
  ],
  badges: [{ ar: "...", en: "..." }],
  rating: { value: 4.8, count: 142 },
  collection: "majlis",                 // or "lighting" | "decor" | <new>
  upsellIds: ["p_002", "p_003"],
  stockLeft: 12,
  recentBuyers: 18,
  benefits: [ /* 4 entries: { icon, title, body } */ ],
  reviews:  [ /* 4 entries: { name, city, rating, body, date, verified } */ ],
  faq:      [ /* 4 entries: { q, a } */ ],
}
```

**2. `backend/app/services/catalog.py`** — mirror the entry. Only `id`,
`slug`, `title_ar`, `title_en`, `price`, `offer_tiers`, `collection`
need to match. Backend rejects unknown ids during re-pricing.

Optional polish:

- Append the new id to `bestSellerIds` to surface it on the home page.
- If it introduces a new collection, add the entry in
  `data/collections.ts`.
- Re-run `docker compose up --build elfanaa_web elfanaa_api` to bake
  the catalog into the static build.

### 7.2 Change pricing (199 / 279 / 349)

Money is **integer minor units**. 199 SAR = `19900`. Float math is
forbidden anywhere in the pricing path.

To change the ladder for **all products**, edit the `TIER_OFFER`
constant at the top of `data/products.ts`:

```ts
const TIER_OFFER = {
  tiers: [
    { quantity: 1, total: { amount: 19900, currency: C } },  // 1 = 199
    { quantity: 2, total: { amount: 27900, currency: C } },  // 2 = 279
    { quantity: 3, total: { amount: 34900, currency: C } },  // 3 = 349
  ],
  unit: { amount: 19900, currency: C },
} as const;
```

Then mirror the change in `backend/app/services/catalog.py`'s `_TIERS`
constant. The two files MUST stay aligned — the backend re-prices
every cart line and discards the client total.

To change pricing for **one product only**, override `price` and
`offerTiers` on that product entry (frontend) and the matching record
in `catalog.py` (backend).

### 7.3 Change the post-purchase offer

The 99 SAR upsell is the **only discount in the entire store**.
Configurable in two places:

```ts
// lib/upsell/strategy.ts
export const POST_PURCHASE_OFFER_PRICE = { amount: 9900, currency: "SAR" };
export const POST_PURCHASE_TIMER_SECONDS = 12;
```

To pin specific recommendations regardless of the score:

```ts
// lib/upsell/strategy.ts
const editorialOverrides: Record<string, string> = {
  p_001: "p_002",   // cushion buyer → lantern offer
  p_002: "p_003",   // lantern buyer → vase offer
  p_003: "p_001",   // vase buyer → cushion offer
};
```

To tune the candidate window:

```ts
const MIN_ANCHOR_RATIO = 1.5;   // candidate must be ≥ 1.5x of 99 SAR
const MAX_ANCHOR_RATIO = 6;     // candidate must be ≤ 6x of 99 SAR
const IDEAL_ANCHOR_LOW = 2;
const IDEAL_ANCHOR_HIGH = 4;    // best-feeling discount band — gets +10 score
```

### 7.4 Add a new section

Section components live in `components/sections/` and are composed
into pages by importing them in `app/<page>/page.tsx`. Pattern:

```tsx
// components/sections/MyNewSection.tsx
"use client";  // only if the section needs locale or interactivity

import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

export function MyNewSection() {
  const { t } = useLocale();
  return (
    <section className="py-16 md:py-24">
      <Container>
        <header className="mb-10 max-w-2xl md:mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            {t.<namespace>.eyebrow}
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
            {t.<namespace>.title}
          </h2>
        </header>
        {/* body */}
      </Container>
    </section>
  );
}
```

Then:

1. Add the dictionary entries to `lib/i18n/dictionaries.ts` under both
   `ar` and `en` blocks.
2. Import and slot into the parent page (`app/page.tsx` for home,
   `app/products/[slug]/page.tsx` for PDP, etc.).

### 7.5 Add a new dictionary string

Always edit **both** locale blocks in `lib/i18n/dictionaries.ts`. The
TypeScript type is inferred from the `ar` block, so the `en` block is
type-checked against it — missing keys break the build.

```ts
// In `ar:`
mySection: {
  eyebrow: "...",
  title: "...",
}

// In `en:`
mySection: {
  eyebrow: "...",
  title: "...",
}
```

Templated values use `{name}`-style placeholders + `.replace("{name}", value)`
in the consumer. We do not pull in `i18next` for this.

### 7.6 Add a new pixel event

Three small edits (`lib/analytics.ts` is the single emission point):

1. Add the event name to `EventName` union in `lib/analytics.ts`.
2. Map it to platform-specific names in `PIXEL_NAME_MAP`.
3. Call from the surface that fires it:

```ts
trackCommerce("add_to_wishlist", { product, value: product.price });
// or for non-commerce events:
track("clicked_press_logo", { logo_id: "vogue" });
```

The facade dispatches to:
- `dataLayer.push(...)` (GA4)
- `pixelTrack({...})` → Meta `fbq`, TikTok `ttq`, Snap `snaptr`
- (Server-side `Purchase` continues to fire from the backend; no client work needed.)

### 7.7 Toggle frontend ↔ backend wiring

The frontend talks to **either** the in-Next.js fallback at `/api/orders`
**or** the FastAPI backend, controlled by one env var:

```env
# Local dev with the fallback (no backend running):
# leave NEXT_PUBLIC_API_BASE_URL unset

# Local dev with FastAPI:
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Production:
NEXT_PUBLIC_API_BASE_URL=https://api.elfanaa.com
```

`lib/api.ts → apiUrl(path)` rewrites `/api/orders` into the FastAPI
URL when the env is set, otherwise leaves it alone.

---

## 8. CRO decisions explained

### 8.1 Why the offer selector is the centerpiece

Saudi COD funnels live or die on **AOV**. The canonical lift is moving
the modal customer from buying 1 to buying 2 (or 2 to 3). A tier
selector that:

- Shows all three options on one screen (no scroll, no nav).
- Anchors the middle option as "Most popular".
- Anchors the largest as "Best value" with explicit savings.
- Computes the live total in the customer's currency, in real time.
- Carries the same `lineTotal()` engine that the cart and the server
  use, so the price stays consistent everywhere.

…lifts AOV by 25–40% versus a quantity stepper at the same price ladder
(CODRocket + EasySell teardowns, 2024–2025).

### 8.2 Why scarcity is two pills, not five

Cialdini's scarcity principle is real, but **stacked** scarcity reads
as desperation. We ship exactly two:

- **Stock left** — colour-shifts to `danger` red below 10 to escalate.
- **Recent buyers** — local "X ordered today" feels like neighborhood
  validation, not a fake counter.

Both are display-only at MVP. They become genuinely powerful when
backed by live counts; wire them once order volume justifies it.

### 8.3 Why we open the cart drawer on add (not navigate to a cart page)

- The customer's last action was *"yes, I want this"*. Navigating away
  from the PDP forces them to re-orient and adds an exit point.
- Drawers preserve scroll position on the PDP — they can keep browsing
  variants or read benefits without losing context.
- A drawer makes the **next step** (checkout) one tap away. A cart page
  makes it two taps and a page load.

### 8.4 Why the checkout is a popup

Same logic, sharper:

- A traditional checkout page has an exit URL bar, browser back button,
  no order summary persistence, and forces a re-load on phone keyboard
  open. Mobile drop-off on cart-page checkouts is 3–5x higher.
- The popup keeps the customer's mental model on **one screen** and
  surfaces social proof + scarcity in the same viewport as the form.
- Two fields only (name + Saudi phone) is the **minimum viable**
  Saudi COD funnel. Address is collected on the call.

### 8.5 Why the upsell is fixed-price with a 12s timer

- **Fixed price (99 SAR)** — the customer's brain doesn't have to do
  math. Rare-discount discipline (only place we discount) keeps the
  offer credible.
- **Single product** — no carousel. Choice paralysis kills upsell
  conversion. The strategy file picks ONE product based on cart context.
- **12 seconds** — long enough to read the full pitch, short enough to
  feel honest. Multiple Aftersell A/B tests land on 10–15s as optimal.
- **Honest expiry** — no auto-accept, no idle reset. Customers learn the
  brand isn't gaming them, which earns lifetime trust at the cost of a
  small per-order conversion delta.

### 8.6 Why the AOV strategy is "1=199, 2=279, 3=349"

- 199 SAR is the **single most converted price-point** in MENA COD
  funnels — under 200 reads as "less than a dinner out".
- 279 (2-pack) saves the customer 119 SAR for 80 SAR more — an
  irresistible per-piece drop.
- 349 (3-pack) is the **psychological anchor** — three is "a set",
  and 349 ≈ a single dinner for the value of three pieces.
- No discount above 3 pieces — the ladder ends at the natural set size,
  which prevents the offer from feeling like a wholesale dump.

### 8.7 Why the tagline appears in only three places

The tagline ("تفاصيل تصنع الفخامة" / "Details craft luxury") is a brand
moment, not a UI element. We use it in **exactly three surfaces**:

1. The home hero (the brand's first impression).
2. The header (subtle, lockup-aware).
3. The footer (inline, em-dashed).

Never in announcement bars, breadcrumbs, buttons, badges. Repetition
dilutes the signal — restraint is what makes a tagline land.

### 8.8 Why the brand uses ONE arrow icon

`lucide ArrowLeft` is the universal arrow. In LTR contexts (English) we
flip it via `ltr:rotate-180`. In RTL (Arabic — the default) it stays as
drawn. This means:

- One icon import, one weight, one stroke.
- Consistent directionality across surfaces — "next" always points
  toward the page direction's reading flow.
- Tested in both LTR and RTL automatically — no case where one looks
  right and the other looks weird.

---

## Final reminders

- **Money is integer minor units everywhere.** 199 SAR = `19900`.
- **The client's reported price is ignored.** Server re-prices every
  cart line. A tampered cart cannot underpay.
- **Sticky CTAs do not stack** — `MobileStickyCTA` (mobile) and
  `ProductStickyBar` (desktop) are mutually exclusive by `md:` breakpoint.
- **The cart is never a page**, the checkout is never a page. Drawer
  + popup is the entire journey from add-to-cart to thank-you.
- **Saudi dialect copy is the brand voice.** Don't let a translation
  layer sand it down to formal Arabic.
- **Keep ARIA accurate** — buttons are buttons, links are links,
  `aria-pressed` for toggles, `aria-expanded` for accordions.

For backend internals, deployment, env vars, and the AI hand-off see
[`README.md`](./README.md) and [`FINAL_PROMPT.md`](./FINAL_PROMPT.md).
