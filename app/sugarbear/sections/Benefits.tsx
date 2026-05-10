import type { ComponentType } from "react";
import { benefitsCopy } from "../copy";
import { Reveal } from "../components/Reveal";
import {
  IconStrand,
  IconBloom,
  IconSunrise,
  IconSparkle,
} from "../components/Icons";

/**
 * SECTION 4 — Benefits (luxury feminine 4-card editorial grid)
 *
 * Four premium cards communicate the brand's emotional value props at a
 * glance. Each card is a small editorial moment — soft cream-on-cream
 * canvas, hair-thin gold border, ultra-minimal gold line icon, display
 * serif title, and a calm body line.
 *
 * Direction (per brief):
 *   • luxury beauty / GCC skincare aesthetic — never SaaS or dropship
 *   • icons are single editorial gestures (strand / bloom / sunrise /
 *     sparkle), not literal pictograms
 *   • no badges, no fake stats, no medical/scientific styling
 *   • flows continuously from Section 3 (S3 cream-warm-cream gradient
 *     hands off into S4 warm-cream-back-to-cream gradient)
 */

// Map the icon name baked into copy.ts to its concrete React component
// here (keeps copy.ts pure data, no React import).
type IconName = (typeof benefitsCopy.cards)[number]["icon"];
const ICON_MAP: Record<IconName, ComponentType<{ size?: number; color?: string }>> = {
  strand: IconStrand,
  bloom: IconBloom,
  sunrise: IconSunrise,
  sparkle: IconSparkle,
};

export function Benefits() {
  return (
    <section
      id="sb-benefits"
      style={{
        // Reverse of the Section 3 gradient — this section starts in the
        // warmer cream and settles back into the base cream, creating a
        // soft rhythmic beat between the two editorial moments.
        background:
          "linear-gradient(180deg, #f6ebd5 0%, var(--sb-cream) 100%)",
        paddingTop: "clamp(56px, 7.5vw, 100px)",
        paddingBottom: "clamp(72px, 10vw, 130px)",
      }}
    >
      <div className="mx-auto max-w-[1240px] px-6 md:px-12">
        {/* ── Editorial intro ──────────────────────────────────────── */}
        <Reveal>
          <div
            style={{
              maxWidth: 660,
              marginInline: "auto",
              textAlign: "center",
            }}
          >
            <p
              className="sb-eyebrow"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
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
              <span style={{ margin: "0 14px" }}>{benefitsCopy.eyebrow}</span>
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
                fontSize: "clamp(30px, 4.8vw, 56px)",
                lineHeight: 1.18,
                fontWeight: 600,
                color: "var(--sb-ink)",
                letterSpacing: "-0.01em",
                whiteSpace: "pre-line",
                margin: 0,
                maxWidth: 540,
                marginInline: "auto",
              }}
            >
              {benefitsCopy.headline}
            </h2>
            <p
              style={{
                marginTop: "clamp(18px, 2.4vw, 26px)",
                fontSize: "clamp(16px, 1.5vw, 18.5px)",
                lineHeight: 2.05,
                color: "var(--sb-charcoal)",
                fontWeight: 400,
                maxWidth: 580,
                marginInline: "auto",
              }}
            >
              {benefitsCopy.intro}
            </p>
          </div>
        </Reveal>

        {/* ── 4-card editorial grid ────────────────────────────────── *
         *  Mobile  → 1 col, generous breathing                         *
         *  ≥ sm    → 2 cols                                            *
         *  ≥ lg    → 4 cols                                            *
         * ──────────────────────────────────────────────────────────── */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          style={{
            marginTop: "clamp(40px, 5.6vw, 72px)",
            gap: "clamp(16px, 1.8vw, 24px)",
          }}
        >
          {benefitsCopy.cards.map((card, i) => {
            const Icon = ICON_MAP[card.icon];
            return (
              <Reveal
                key={card.title}
                delay={((i % 4) + 1) as 1 | 2 | 3 | 4}
              >
                <BenefitCard Icon={Icon} title={card.title} body={card.body} />
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 *  Individual luxury card.
 *
 *  • Layered cream canvas — warm cream on top, slightly deeper cream
 *    underneath via inset highlight.
 *  • Hair-thin gold border that warms on hover.
 *  • Soft gold "candle" halo behind the icon disc.
 *  • Display serif title + softer body, generous internal padding.
 *  • Hover: 2 px lift + warmer shadow, no jumpiness.
 * ──────────────────────────────────────────────────────────────────── */
function BenefitCard({
  Icon,
  title,
  body,
}: {
  Icon: ComponentType<{ size?: number; color?: string }>;
  title: string;
  body: string;
}) {
  return (
    <article
      className="sb-bundle-card" /* re-uses the existing card hover stack */
      style={{
        position: "relative",
        background:
          "linear-gradient(180deg, rgba(255, 252, 244, 0.92) 0%, rgba(248, 240, 224, 0.86) 100%)",
        border: "1px solid rgba(184, 153, 104, 0.22)",
        borderRadius: 14,
        padding: "clamp(28px, 3.2vw, 38px) clamp(22px, 2.6vw, 30px)",
        minHeight: 268,
        display: "flex",
        flexDirection: "column",
        textAlign: "start",
        boxShadow:
          "0 1px 0 rgba(255, 255, 255, 0.6) inset, 0 6px 18px rgba(44, 40, 38, 0.05)",
        // Hairline gold accent on the top edge — quiet "page-break" line
        // that gives every card a subtle editorial ornament.
        backgroundClip: "padding-box",
      }}
    >
      {/* Top hairline gold ornament — sits inside the rounded corner. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          insetInline: "18%",
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(184, 153, 104, 0.55), transparent)",
        }}
      />

      {/* Icon disc — soft candle halo + cream face + gold line glyph. */}
      <div
        style={{
          position: "relative",
          width: 56,
          height: 56,
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(80% 80% at 35% 30%, #fff8e7 0%, #f4e3c5 100%)",
          color: "var(--sb-gold-deep)",
          boxShadow:
            "inset 0 0 0 1px rgba(184, 153, 104, 0.28), 0 6px 14px rgba(184, 153, 104, 0.18)",
        }}
      >
        {/* Outer halo — barely-there warm bloom that lifts the disc off
         *  the card without making it feel skeumorphic. */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: -8,
            borderRadius: 999,
            background:
              "radial-gradient(60% 60% at 50% 50%, rgba(232, 204, 151, 0.30) 0%, rgba(232, 204, 151, 0) 70%)",
            pointerEvents: "none",
          }}
        />
        <Icon size={22} />
      </div>

      {/* Title */}
      <h3
        style={{
          marginTop: 22,
          fontFamily: "var(--font-sb-display), serif",
          fontWeight: 600,
          fontSize: "clamp(20px, 1.8vw, 22px)",
          color: "var(--sb-ink)",
          lineHeight: 1.25,
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </h3>

      {/* Body */}
      <p
        style={{
          marginTop: 10,
          fontSize: "clamp(14px, 1.1vw, 15px)",
          lineHeight: 1.85,
          color: "var(--sb-charcoal)",
          fontWeight: 400,
        }}
      >
        {body}
      </p>
    </article>
  );
}
