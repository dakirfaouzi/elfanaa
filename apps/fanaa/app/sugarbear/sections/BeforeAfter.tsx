import Image from "next/image";
import { beforeAfterCopy } from "../copy";
import { Reveal } from "../components/Reveal";

/**
 * SECTION 3 — Before / After (visual proof, luxury beauty campaign style)
 *
 * Single dominant editorial diptych photograph (the official campaign
 * before/after shot, with Arabic labels baked-in by the art-director)
 * + minimal centered typography + a soft low-contrast reassurance line.
 *
 * Direction (per brief):
 *   • feels like a luxury beauty campaign, not a fitness/medical ad
 *   • visual proof + emotional reassurance + believable transformation
 *   • soft warm cinematic tones — no hard borders, no badges, no arrows
 *   • no abstract SVG strand placeholders — REAL image carries the proof
 *
 * Composition:
 *   eyebrow      "نتائج تُلاحظ مع الاستمرار"
 *      ↓
 *   headline     "شعر يبدو أكثر صحة، / ولمعان يُرى من أول فرق."
 *      ↓
 *   body         (calm narrow paragraph)
 *      ↓
 *   ┌───────────────────────────────────────────────┐
 *   │                                               │
 *   │   campaign before/after diptych — 681 × 1024  │
 *   │   labels: قبل الانتظام  ·  بعد الانتظام       │
 *   │                                               │
 *   └───────────────────────────────────────────────┘
 *      ↓
 *   "النتائج تختلف من شخص لآخر..."   (low-contrast disclaimer)
 */
export function BeforeAfter() {
  return (
    <section
      id="sb-before-after"
      style={{
        // Subtle warm-cream → warmer-cream gradient — gives this section
        // a felt-warmer atmosphere than Section 2 without breaking the
        // palette continuity.
        background:
          "linear-gradient(180deg, var(--sb-cream) 0%, #f6ebd5 100%)",
        // Tightened top padding (was 72→130 → now 44→80) so the
        // storytelling between Section 2 and Section 3 flows as one
        // continuous thought instead of being separated by a wide
        // cream gap. Bottom stays generous-but-trimmed.
        paddingTop: "clamp(44px, 6vw, 80px)",
        paddingBottom: "clamp(56px, 8vw, 110px)",
      }}
    >
      <div className="mx-auto max-w-[1240px] px-6 md:px-12">
        {/* ── Editorial intro — eyebrow + headline + supporting copy ── *
         *  Wider intro column (640 → 660) absorbs the slightly larger   *
         *  body type without forcing widow-orphan line breaks.          *
         * ──────────────────────────────────────────────────────────── */}
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
              <span style={{ margin: "0 14px" }}>{beforeAfterCopy.eyebrow}</span>
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
              {beforeAfterCopy.headline}
            </h2>
            <p
              style={{
                marginTop: "clamp(18px, 2.4vw, 26px)",
                // One notch up on size + a hair more line-height than
                // Section 2 (2.0 → 2.1) so this paragraph breathes
                // visibly more — readability without weight.
                fontSize: "clamp(16px, 1.5vw, 18.5px)",
                lineHeight: 2.1,
                color: "var(--sb-charcoal)",
                fontWeight: 400,
                maxWidth: 580,
                marginInline: "auto",
              }}
            >
              {beforeAfterCopy.body}
            </p>
          </div>
        </Reveal>

        {/* ── Dominant editorial diptych ────────────────────────────── *
         *  Native 681 × 1024 (≈ 2:3 portrait) so the campaign labels    *
         *  ("قبل الانتظام" / "بعد الانتظام") and the warm cinematic     *
         *  tones are preserved exactly as art-directed. Capped at       *
         *  780 px on desktop (gives the diptych real campaign presence  *
         *  without forcing the page into an oversized poster); on       *
         *  mobile fills the column edge-to-edge with rounded corners.   *
         * ──────────────────────────────────────────────────────────── */}
        <Reveal delay={1}>
          <div
            className="sb-ba-image"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 780,
              marginInline: "auto",
              marginTop: "clamp(32px, 4.6vw, 56px)",
              borderRadius: 12,
              overflow: "hidden",
              // Very soft luxury shadow only — no hard frames, no harsh
              // contrast. Lets the image melt into the warm cream page.
              boxShadow:
                "0 50px 110px rgba(44, 40, 38, 0.18), " +
                "0 14px 36px rgba(184, 153, 104, 0.14), " +
                "0 0 0 1px rgba(184, 153, 104, 0.16)",
            }}
          >
            <Image
              src="/sugarbear/before-after.png"
              alt={`${beforeAfterCopy.beforeLabel} — ${beforeAfterCopy.afterLabel} · ${beforeAfterCopy.headline.replace(
                /\n/g,
                " "
              )}`}
              fill
              sizes="(max-width: 1024px) calc(100vw - 48px), 780px"
              style={{
                objectFit: "cover",
                // Anchor to the bottom so the campaign labels
                // ("قبل الانتظام" / "بعد الانتظام") are always
                // preserved when the mobile aspect-ratio (5:6) trims a
                // sliver from the top of the image.
                objectPosition: "center bottom",
              }}
            />
          </div>
        </Reveal>

        {/* ── Editorial reassurance — premium luxury-skincare voice.   *
         *  Sized + warmed so it reads as *reassurance*, not as hidden  *
         *  legal text. Still soft + clearly subordinate to the image.  *
         * ──────────────────────────────────────────────────────────── */}
        <Reveal delay={2}>
          {/* Soft gold middot rule above the line — visually attaches
           *  the disclaimer to the diptych instead of leaving it
           *  floating in the cream. */}
          <div
            aria-hidden
            style={{
              marginTop: "clamp(32px, 4.4vw, 48px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "var(--sb-gold)",
                opacity: 0.5,
                display: "inline-block",
              }}
            />
          </div>
          <p
            style={{
              marginTop: 14,
              maxWidth: 580,
              marginInline: "auto",
              textAlign: "center",
              // Bumped from 12.5 → 13.5 so it reads at a glance.
              fontSize: 13.5,
              // Slightly tighter line-height for a single-line feel,
              // a touch more open than 1.55.
              lineHeight: 1.75,
              // Warmer than --sb-stone (which leaned cool/grey-beige).
              // Custom rgba on charcoal-soft so it stays subtle but
              // clearly readable; opacity 0.78 keeps it premium-quiet.
              color: "rgba(74, 70, 66, 0.78)",
              fontWeight: 400,
              letterSpacing: "0.005em",
            }}
          >
            {beforeAfterCopy.disclaimer}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
