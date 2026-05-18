# ELFANAA · فناء — Brand Identity

> A premium GCC beauty & wellness house — luxe-pharmacy, editorial-feminine, trusted.
>
> The reference identity of every surface on this storefront is the [`/sugarbear`](https://elfanaa.com/sugarbear) landing page. When in doubt, defer to it.

---

## 1. Positioning

ELFANAA is a **premium Gulf beauty & wellness brand** built on the intersection of four registers:

- **Luxury feminine beauty** — warm, editorial, never loud.
- **Trusted wellness** — pharmacy-grade authority and clinical credibility.
- **Clean modern aesthetics** — cream surfaces, deep espresso ink, generous whitespace.
- **High-conversion ecommerce UX** — single CTA per surface, cash-on-delivery trust signals, COD-first checkout.

The brand should feel like a **luxury wellness house** or a **premium beauty pharmacy**, never like a generic dropshipper, TikTok-shop colour explosion, or aggressive discount store.

## 2. Audience (Primary ICP)

GCC women — Saudi Arabia, UAE, Kuwait, Qatar — aged **22–40**, interested in skincare, haircare, supplements, gummies, serums, creams, masks, oils, and feminine self-care rituals.

## 3. Voice & Tone

| Register | Yes | No |
| --- | --- | --- |
| Emotional warmth | _"شعر أكثر كثافة، ولمعان يبان من أول نظرة."_ | _"Buy now — only 3 left!!!"_ |
| Authority by clarity | _"Cash on delivery — don't pay a riyal until it arrives."_ | _"Limited-time CRAZY offer."_ |
| Quiet confidence | _"كل منتج مبني على مكوّن فعّال بنسبة علاجية."_ | _"#1 best product in the world!"_ |

Arabic is the brand's primary language; English is the secondary surface. Both must read with the same editorial cadence — short sentences, no exclamation points, never ALL-CAPS.

## 4. Colour Palette

The palette is published as design tokens in `styles/tokens.css`. Every Tailwind colour on the site (`bg`, `surface`, `ink`, `muted`, `line`, `accent`, `brand`, `brand-soft`) resolves from these — change them in one place, the whole storefront re-skins.

| Token | Role | Hex | Tailwind |
| --- | --- | --- | --- |
| `--color-bg` | Primary background — page canvas | `#F4EFE6` | `bg-bg` |
| `--color-surface` | Deeper cream — alternating bands, inputs, footer | `#EAE1D2` | `bg-surface` |
| `--color-brand-soft` | Sand — eyebrow chips, hover surfaces | `#E0D3BD` | `bg-brand-soft` |
| `--color-ink` | Deep espresso — primary text + CTA fill | `#1F1815` | `text-ink` / `bg-ink` |
| `--color-muted` | Warm taupe — secondary text | `#7B6E65` | `text-muted` |
| `--color-line` | Biscuit — hairlines, dividers | `#DDD2C2` | `border-line` |
| `--color-accent` | Rose-gold / champagne — links, badges, rules | `#C7A27C` | `text-accent` |
| `--color-accent-deep` | Warm gold — eyebrow text | `#9E7C57` | (editorial) |
| `--color-accent-soft` | Light champagne — gradient stops, selection | `#E0C6A5` | (editorial) |

**Buttons (primary CTA)** are always deep-espresso `#1F1815` on cream — with a whisper of gold in the hover glow (`.fn-cta-glow`).

**Status colours** (`success`, `warning`, `danger`) are warm-leaning to match the palette and used sparingly — they never become the dominant brand colour.

## 5. Typography

| Variable | Font | Where it lives |
| --- | --- | --- |
| `--font-display` | **Cormorant Garamond** | Latin display: hero headlines, brand wordmark "ELFANAA", section H2s |
| `--font-arabic-display` | **Amiri** | Arabic wordmark "فناء" only — sacred brand glyph |
| `--font-sans` | **Inter** | Latin UI workhorse — buttons, body, secondary text |
| `--font-arabic` | **Tajawal** | Arabic UI workhorse — body, buttons, nav, captions |

Tajawal is the body register of the `/sugarbear` landing page; adopting it globally aligns the entire storefront with the brand's reference identity (warm wellness vs. Cairo's harder geometric edges).

Wordmark rules live in `components/brand/brand.config.ts` — never outline, gradient, italicise, or rotate the wordmark. Never recolour the wordmark outside `text-ink` (light surface) and `text-bg` (dark surface).

## 6. Editorial Primitives

A small reusable vocabulary lifted out of the `/sugarbear` page and published in `styles/luxury.css` for the whole storefront to compose with:

- `.fn-eyebrow` + `.fn-rule` — small-caps editorial label with a soft gold hairline. The section-handshake of every premium page.
- `.fn-dot-divider` — gold dot between two fading hairlines. Used for editorial closure (footer, between sections).
- `.fn-card-luxury` — cream card with a candle-warm gold-tinted shadow on hover. Reusable for product, trust, and recommendation tiles.
- `.fn-cta-glow` — espresso CTA with a whisper-of-gold halo on hover. The brand's primary action affordance.
- `.fn-photo-frame` — editorial image wrapper with a champagne ring + warm shadow.
- `.fn-bg-editorial` — radial cream wash with a soft champagne halo top-right; the hero/section base.
- `.fn-num` — tabular LTR numerals for prices, ratings, counts.

## 7. Motion

Slow, deliberate, opacity + transform only.

- `cubic-bezier(0.22, 1, 0.36, 1)` is the project's premium easing curve (exposed as `--ease-premium` and Tailwind `ease-premium`).
- Hero copy reveals on a 150ms cascade (eyebrow → headline → subhead → trust → CTA).
- Cards lift on hover (`translateY(-3px to -4px)`) with a warm gold-tinted shadow bloom — never a hard "pop".
- Everything inside `@media (prefers-reduced-motion: reduce)` collapses to an instant state.

## 8. Imagery

- **Editorial photography over product cut-outs** — when given a choice, lean toward the lifestyle/ritual shot.
- **Warm light, never cool** — golden hour, candlelight, soft daylight.
- **No faces in hero shots** — preserves audience self-projection (matches the Hims/Aesop pattern).
- **Photos sit beneath a cream wash**, not an ink overlay — the photo joins the palette, the palette never fights the photo.

## 9. Layout Rhythm

- Single hero per page. Single primary CTA per surface.
- Alternating bands: `bg-bg` → `bg-surface` → `bg-brand-soft/40` → `bg-bg`. Never two identical bands in a row.
- Generous vertical padding: `py-20 md:py-28` minimum on editorial sections.
- Logical-property utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) everywhere — the brand is Arabic-first.

## 10. Pattern for Future Products

Every new SKU that ships a bespoke landing page inherits this identity automatically because:

1. The shared tokens / fonts / primitives in `styles/tokens.css`, `styles/luxury.css`, and `app/layout.tsx` flip the whole site at once.
2. Each new product opts into its premium landing route via `landingPath` in `data/products.ts` and a redirect entry in `next.config.mjs` (see the Sugarbear → `/sugarbear` precedent).
3. Bespoke pages live under `app/<route>/...` and may layer route-scoped CSS (e.g. `app/sugarbear/sugarbear.css`) for that product's specific editorial flourishes — but they must consume the global tokens for any colour that should re-skin with the rest of the site.

## 11. What This Identity Refuses

- Cheap dropshipping aesthetics.
- Harsh white layouts (cream is the new white).
- Saturated colours competing with the rose-gold accent.
- Tech / gadget visual language.
- TikTok-shop colour explosions.
- Aggressive discount / urgency styling (`SALE!!!`, neon banners, countdown timers without warmth).

When in doubt, **look at `/sugarbear`** — it is the canonical brand surface.
