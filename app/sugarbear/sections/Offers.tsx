"use client";

import Image from "next/image";
import { offersCopy, microcopy } from "../copy";
import { useSugarbear } from "../state";
import { Reveal } from "../components/Reveal";
import { useAddToCart } from "../useAddToCart";

/**
 * SECTION — Premium Offers (final luxury rebuild)
 *
 * Editorial pricing experience matching the rest of the page —
 * three cream cards with bespoke editorial bundle still-lifes,
 * not ecommerce thumbnails.
 *
 * Composition:
 *   1. Centered editorial intro      eyebrow + headline + body
 *   2. Three calm bundle cards       1 / 2 / 3 bottles, card 3 gently
 *                                    emphasized (warmer cream + gold
 *                                    border + small floating "أفضل قيمة"
 *                                    pill above)
 *   3. Bottom trust row              three quiet pills with gold dots
 *
 * Card-level features encoded in copy.ts so the UI stays declarative.
 */
export function Offers() {
  const { bundle, setBundle } = useSugarbear();
  const addToCart = useAddToCart();

  return (
    <section
      id="sb-offers"
      style={{
        position: "relative",
        background:
          "radial-gradient(80% 55% at 50% 0%, rgba(212, 184, 148, 0.16) 0%, transparent 65%), " +
          "linear-gradient(180deg, #f5f0e8 0%, #efe7dc 100%)",
        paddingTop: "clamp(90px, 12vw, 180px)",
        paddingBottom: "clamp(100px, 12vw, 180px)",
        overflow: "hidden",
      }}
    >
      <div
        className="relative px-6 md:px-10"
        style={{ maxWidth: 1320, margin: "0 auto" }}
      >
        {/* ── 1) Centered editorial intro ─────────────────────────── */}
        <Reveal>
          <div
            style={{
              maxWidth: 720,
              marginInline: "auto",
              textAlign: "center",
            }}
          >
            <p
              className="sb-eyebrow"
              style={{
                display: "inline-flex",
                alignItems: "center",
                color: "var(--sb-gold-deep)",
                marginBottom: 18,
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  height: 1,
                  width: 28,
                  background:
                    "linear-gradient(90deg, transparent, var(--sb-gold), transparent)",
                }}
              />
              <span style={{ margin: "0 14px" }}>{offersCopy.eyebrow}</span>
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  height: 1,
                  width: 28,
                  background:
                    "linear-gradient(90deg, transparent, var(--sb-gold), transparent)",
                }}
              />
            </p>
            <h2
              style={{
                fontFamily: "var(--font-sb-display), serif",
                fontSize: "clamp(36px, 5.4vw, 70px)",
                lineHeight: 1.08,
                fontWeight: 700,
                color: "var(--sb-ink)",
                letterSpacing: "-0.02em",
                whiteSpace: "pre-line",
                margin: 0,
              }}
            >
              {offersCopy.headline}
            </h2>
            <p
              style={{
                marginTop: "clamp(20px, 2.6vw, 28px)",
                fontSize: "clamp(15.5px, 1.4vw, 17.5px)",
                lineHeight: 1.9,
                color: "var(--sb-charcoal)",
                fontWeight: 400,
                maxWidth: 680,
                marginInline: "auto",
                whiteSpace: "pre-line",
              }}
            >
              {offersCopy.body}
            </p>
          </div>
        </Reveal>

        {/* ── 2) Bundle cards ─────────────────────────────────────── *
         *  Mobile  →  vertical stack                                  *
         *  Tablet+ →  three across, card 3 gently emphasised          *
         * ─────────────────────────────────────────────────────────── */}
        <div
          className="grid grid-cols-1 md:grid-cols-3"
          style={{
            marginTop: "clamp(48px, 6vw, 84px)",
            gap: "clamp(18px, 2vw, 34px)",
            alignItems: "stretch",
          }}
        >
          {offersCopy.bundles.map((b, i) => (
            <Reveal key={b.id} delay={((i % 3) + 1) as 1 | 2 | 3}>
              <BundleCard
                bundle={b}
                selected={bundle === b.id}
                onSelect={() => setBundle(b.id)}
                onAddToCart={() => {
                  setBundle(b.id);
                  addToCart(b.pieces);
                }}
              />
            </Reveal>
          ))}
        </div>

        {/* ── 3) Bottom trust row ─────────────────────────────────── */}
        <Reveal delay={3}>
          <ul
            style={{
              marginTop: "clamp(48px, 6vw, 80px)",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "center",
              gap: "10px 0",
              listStyle: "none",
              padding: 0,
            }}
          >
            {offersCopy.trustRow.map((t, i) => (
              <li
                key={t}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "var(--sb-charcoal)",
                  letterSpacing: "0.02em",
                  opacity: 0.92,
                }}
              >
                <span style={{ paddingInline: "clamp(14px, 1.8vw, 24px)" }}>
                  {t}
                </span>
                {i < offersCopy.trustRow.length - 1 && (
                  <span
                    aria-hidden
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "var(--sb-gold)",
                      opacity: 0.6,
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 *  Bundle card
 *
 *      ┌────────────────────────────────────────┐
 *      │            "أفضل قيمة" (only card 3)   │
 *      │ ┌──────────────────────────────────┐   │
 *      │ │       editorial bundle image     │   │
 *      │ └──────────────────────────────────┘   │
 *      │ شهر واحد · للبداية                     │
 *      │ ١٩٩ ريال                                │
 *      │ ١٩٩ ريال للعلبة      [وفّري ١٤٨ ريال] │
 *      │ ─────────────────────────────────────  │
 *      │ ✓ توصيل خلال ٤٨ ساعة                   │
 *      │ ✓ الدفع عند الاستلام                   │
 *      │                                        │
 *      │ [    اختاري هذه       ]                │
 *      └────────────────────────────────────────┘
 *
 *  Markup uses a hidden radio + visible card label so the whole card
 *  is one big radio target with full keyboard support.
 * ──────────────────────────────────────────────────────────────────── */
function BundleCard({
  bundle,
  selected,
  onSelect,
  onAddToCart,
}: {
  bundle: (typeof offersCopy.bundles)[number];
  selected: boolean;
  onSelect: () => void;
  onAddToCart: () => void;
}) {
  const isFeatured = bundle.highlight;

  return (
    <label
      style={{
        position: "relative",
        cursor: "pointer",
        display: "block",
        height: "100%",
        // Top padding leaves room for the floating "أفضل قيمة" pill on
        // the featured card (now floated 26 px above); non-featured
        // cards keep the same offset so all three cards sit at identical
        // heights in the grid.
        paddingTop: 28,
      }}
    >
      <input
        type="radio"
        name="sb-offers-bundle"
        className="sb-offer-input"
        checked={selected}
        onChange={onSelect}
      />

      {/* Soft warm halo — featured card only.                            *
       *  Absolutely-positioned, behind the card, ~16px wider on every    *
       *  side so it reads as a quiet focus glow rather than an inset     *
       *  background. Stays put through hover lift + selection changes.   */}
      {isFeatured && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: "-16px",
            borderRadius: 40,
            background:
              "radial-gradient(closest-side, rgba(212, 184, 120, 0.10) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}

      <div
        className="sb-offer-card"
        // Selection-driven visual state. The brief is explicit:
        //   • selected   → warm cream gradient + stronger gold border
        //                  + deeper warm shadow + subtle gold inset glow
        //   • inactive   → softer white wash + lighter border + lighter shadow
        // The floating "أفضل قيمة" badge stays tied to `isFeatured`
        // (card 3 is always the best value regardless of selection),
        // but it never drives the card's background/border/shadow.
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          background: selected
            ? "linear-gradient(180deg, #f8f1e6 0%, #f4eadb 100%)"
            : "rgba(255, 255, 255, 0.52)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: selected
            ? "1px solid rgba(191, 161, 106, 0.32)"
            : "1px solid rgba(191, 161, 106, 0.18)",
          borderRadius: 32,
          padding: "clamp(26px, 3vw, 40px)",
          boxShadow: selected
            ? "0 45px 90px rgba(70, 55, 35, 0.12), 0 0 0 1px rgba(184, 153, 104, 0.18) inset"
            : "0 35px 80px rgba(70, 55, 35, 0.08)",
          transition: "all 0.35s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* "أفضل قيمة" floating pill — only on the featured card.        *
         *  Floated 26 px above the card top so it never touches or       *
         *  overlaps the image area (which now extends edge-to-edge       *
         *  from the card's rounded top corner). zIndex puts it above     *
         *  both the warm halo and the image frame.                       */}
        {isFeatured && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -26,
              insetInline: 0,
              margin: "0 auto",
              width: "fit-content",
              background: "var(--sb-charcoal)",
              color: "var(--sb-gold-soft)",
              fontSize: 10.5,
              letterSpacing: "0.22em",
              padding: "9px 18px",
              borderRadius: 999,
              fontWeight: 700,
              zIndex: 2,
              boxShadow:
                "0 14px 30px rgba(44, 40, 38, 0.26), " +
                "0 0 0 1px rgba(212, 184, 148, 0.40) inset",
            }}
          >
            {microcopy.bestValue}
          </span>
        )}

        {/* ── Editorial bundle image (1/2/3 bottles still-life) ── *
         *  Container breaks OUT of the card's clamp(26-40)px padding   *
         *  via matching negative margins on top + sides, so the photo  *
         *  fills the full top of the card edge-to-edge. Card border-   *
         *  radius is matched on the top corners only; the image stops  *
         *  just above the title with a tighter bottom margin.          *
         *                                                              *
         *  Visual emphasis: `object-fit: cover` so the image fills the *
         *  frame width-to-width, then `transform: scale(1.12)` (or     *
         *  1.18 on the featured card) pushes the bottles closer still. *
         *  `object-position` is biased a touch above centre so the     *
         *  scale doesn't clip the bottle bases.                         */}
        <div
          className="sb-offer-image"
          style={{
            position: "relative",
            // Negative margins matching the card's own padding break the
            // frame out to the card's rounded top edges.
            marginTop: "calc(clamp(26px, 3vw, 40px) * -1)",
            marginInline: "calc(clamp(26px, 3vw, 40px) * -1)",
            marginBottom: "clamp(14px, 1.8vw, 22px)",
            width: "auto",
            height: "var(--sb-offer-image-h, 320px)",
            // Match the card's outer radius on the top corners only.
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            overflow: "hidden",
            // Soft warm halo behind the photo — same vocabulary as the
            // hero ambient glow, so the bottles feel lit rather than
            // pasted onto flat colour. Warm gradient on top of a pale
            // cream wash so cropped edges of the silk + marble blend
            // into the card surface.
            background:
              "radial-gradient(60% 55% at 50% 55%, rgba(232, 204, 151, 0.22) 0%, transparent 70%), " +
              "linear-gradient(180deg, rgba(255, 252, 244, 0.55) 0%, rgba(255, 252, 244, 0.30) 100%)",
          }}
        >
          <Image
            src={bundle.image}
            alt={`${bundle.headline} — ${bundle.sub}`}
            fill
            sizes="(max-width: 768px) 92vw, (max-width: 1024px) 38vw, 440px"
            priority={isFeatured}
            style={{
              objectFit: "cover",
              // Slightly above true centre so the scaled image never
              // clips the bottle bases on the featured card.
              objectPosition: "center 42%",
              // Reduced ~7% from the previous 1.12 / 1.18 so the cards
              // breathe more cleanly without losing image presence.
              // Featured card keeps a +6% lift over the others.
              transform: isFeatured ? "scale(1.10)" : "scale(1.04)",
              transformOrigin: "center center",
              transition: "transform 0.45s ease",
              filter:
                "drop-shadow(0 18px 30px rgba(70, 55, 35, 0.14)) " +
                "drop-shadow(0 6px 14px rgba(184, 153, 104, 0.18))",
            }}
          />
        </div>

        {/* ── Title + sub ─────────────────────────────────────── */}
        <div style={{ textAlign: "center" }}>
          <h3
            style={{
              fontFamily: "var(--font-sb-display), serif",
              fontSize: "clamp(22px, 2.4vw, 26px)",
              fontWeight: 700,
              lineHeight: 1.2,
              color: "var(--sb-ink)",
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            {bundle.headline}
          </h3>
          <p
            style={{
              marginTop: 4,
              fontFamily: "var(--font-sb-display), serif",
              fontStyle: "italic",
              fontSize: "clamp(13.5px, 1.2vw, 15px)",
              color: "var(--sb-charcoal-soft)",
              fontWeight: 400,
              opacity: 0.85,
              margin: "4px 0 0",
            }}
          >
            {bundle.sub}
          </p>
        </div>

        {/* ── Price + per-bottle + savings ────────────────────── */}
        <div
          style={{
            marginTop: "clamp(12px, 2vw, 22px)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 8,
            }}
          >
            <span
              className="sb-num"
              style={{
                fontFamily: "var(--font-sb-display), serif",
                fontSize: "clamp(40px, 5vw, 56px)",
                fontWeight: 700,
                lineHeight: 1,
                color: "var(--sb-ink)",
                letterSpacing: "-0.02em",
              }}
            >
              {bundle.price}
            </span>
            <span
              style={{
                fontSize: "clamp(14px, 1.3vw, 16px)",
                color: "var(--sb-charcoal-soft)",
                fontWeight: 500,
                letterSpacing: "0.02em",
              }}
            >
              {microcopy.currency}
            </span>
          </div>
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              color: "var(--sb-charcoal-soft)",
              fontWeight: 500,
              opacity: 0.78,
              margin: "8px 0 0",
            }}
          >
            {bundle.perBottleNote}
          </p>
          {bundle.tag && (
            <span
              style={{
                display: "inline-block",
                marginTop: 10,
                background: isFeatured
                  ? "var(--sb-charcoal)"
                  : "rgba(184, 153, 104, 0.14)",
                color: isFeatured
                  ? "var(--sb-gold-soft)"
                  : "var(--sb-gold-deep)",
                padding: "6px 14px",
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "0.10em",
                borderRadius: 999,
              }}
            >
              {bundle.tag}
            </span>
          )}
        </div>

        {/* ── Hairline divider ────────────────────────────────── */}
        <span
          aria-hidden
          style={{
            display: "block",
            height: 1,
            margin: "clamp(16px, 2.4vw, 30px) clamp(8px, 1.4vw, 18px) 0",
            background:
              "linear-gradient(90deg, transparent, rgba(184, 153, 104, 0.32), transparent)",
          }}
        />

        {/* ── Feature list ────────────────────────────────────── */}
        <ul
          style={{
            marginTop: "clamp(14px, 2.4vw, 26px)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            color: "var(--sb-charcoal)",
            fontSize: "clamp(13px, 1.15vw, 14.5px)",
            lineHeight: 1.6,
            listStyle: "none",
            padding: 0,
            flex: 1,
          }}
        >
          {bundle.features.map((f) => (
            <li
              key={f}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                opacity: 0.9,
              }}
            >
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 100%), " +
                    "rgba(255, 252, 244, 0.55)",
                  boxShadow: "0 0 0 1px rgba(184, 153, 104, 0.32) inset",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--sb-gold-deep)",
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12.5l4.5 4.5L19 7" />
                </svg>
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {/* ── CTA pill ─────────────────────────────────────── *
         *  Real interactive button: clicking it selects this   *
         *  bundle AND adds it to the cart, then opens the      *
         *  luxury cart drawer. The outer label/radio still     *
         *  handles pure-selection-without-checkout for users   *
         *  who click elsewhere on the card.                    *
         * ─────────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={(e) => {
            // Prevent the click from also bubbling to the label and
            // double-firing the radio change (the onAddToCart handler
            // already calls setBundle so selection is covered).
            e.preventDefault();
            onAddToCart();
          }}
          style={{
            marginTop: "clamp(16px, 2.6vw, 28px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: 56,
            borderRadius: 999,
            paddingInline: 26,
            background: selected ? "var(--sb-charcoal)" : "transparent",
            color: selected ? "var(--sb-cream)" : "var(--sb-charcoal)",
            border: selected
              ? "1px solid rgba(212, 184, 148, 0.35)"
              : "1px solid rgba(44, 40, 38, 0.85)",
            fontSize: "clamp(13.5px, 1.25vw, 15px)",
            fontWeight: 600,
            letterSpacing: "0.01em",
            boxShadow: selected
              ? "0 12px 28px rgba(44, 40, 38, 0.20)"
              : "none",
            transition: "all 0.35s ease",
            cursor: "pointer",
          }}
        >
          {bundle.cta}
        </button>
      </div>
    </label>
  );
}
