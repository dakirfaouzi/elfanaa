import Image from "next/image";
import { ingredientsCopy } from "../copy";
import { Reveal } from "../components/Reveal";

/**
 * SECTION 5 — Ingredients (luxury editorial formulation block)
 *
 * Two-column editorial layout:
 *   • Desktop  →  image LEFT, content RIGHT, vertically centred.
 *   • Mobile   →  image first, text stack below.
 *
 * Direction (per brief):
 *   • luxury skincare campaign feel, not a supplement landing page
 *   • image preserved exactly (no aggressive crop) with rounded warm
 *     corners and a soft luxury shadow only
 *   • elegant 01 / 02 / 03 numbering with thin gold dividers between
 *     ingredient rows — no cards, no hard borders, no medical badges
 *   • finishing line ("تركيبة هادئة...") closes the section quietly
 */
export function Ingredients() {
  return (
    <section
      id="sb-ingredients"
      style={{
        // Continues the warm cream system from Section 4 → settles a
        // hair warmer here so the formulation block feels like a
        // chapter break with its own atmosphere.
        background:
          "linear-gradient(180deg, var(--sb-cream) 0%, #f4ead4 100%)",
        // Slightly tightened (top 64→120 → 56→104, bottom 72→130 →
        // 64→114) — premium breathing rhythm preserved without dead
        // cream space on desktop.
        paddingTop: "clamp(56px, 8vw, 104px)",
        paddingBottom: "clamp(64px, 9vw, 114px)",
      }}
    >
      <div className="mx-auto max-w-[1240px] px-6 md:px-12">
        {/* Two-column editorial canvas — image LEFT (lg:order-1),
         *  content RIGHT (lg:order-2). Mobile defaults to image-first
         *  via order-1/order-2 so the photograph leads the eye.       */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* ── Image column ──────────────────────────────────────── */}
          <Reveal as="div" className="lg:col-span-6 order-1 lg:order-1">
            <div
              className="sb-ing-image"
              style={{
                position: "relative",
                width: "100%",
                // -8.9 % from the previous 560 px — gives the typography
                // column more authority while the image still dominates
                // visually on desktop.
                maxWidth: 510,
                marginInline: "auto",
                borderRadius: 30,
                overflow: "hidden",
                // Soft warm luxury shadow only — no hard frames.
                boxShadow:
                  "0 50px 110px rgba(44, 40, 38, 0.18), " +
                  "0 16px 40px rgba(184, 153, 104, 0.16), " +
                  "0 0 0 1px rgba(184, 153, 104, 0.18)",
              }}
            >
              <Image
                src="/sugarbear/ingredients.png"
                alt="تركيبة Sugarbear — البيوتين، فيتامين C، وحمض الفوليك في إطار جمالي هادئ"
                fill
                sizes="(max-width: 1024px) calc(100vw - 48px), 510px"
                style={{
                  objectFit: "cover",
                  objectPosition: "center",
                }}
              />
            </div>
          </Reveal>

          {/* ── Content column ────────────────────────────────────── */}
          <Reveal
            as="div"
            delay={1}
            className="lg:col-span-6 order-2 lg:order-2"
          >
            <div
              style={{
                maxWidth: 560,
                // On desktop the content sits flush-end of its column
                // (RTL-aware via marginInline-end). On mobile we centre
                // it for editorial calm.
                marginInline: "auto",
                textAlign: "start",
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
                <span style={{ margin: "0 14px" }}>
                  {ingredientsCopy.eyebrow}
                </span>
              </p>
              <h2
                style={{
                  fontFamily: "var(--font-sb-display), serif",
                  fontSize: "clamp(30px, 4.4vw, 52px)",
                  // Subtly more breathing room in the two-line
                  // headline (1.18 → 1.26 ≈ +4 px on the 52 px size).
                  lineHeight: 1.26,
                  fontWeight: 600,
                  color: "var(--sb-ink)",
                  letterSpacing: "-0.01em",
                  whiteSpace: "pre-line",
                  margin: 0,
                  maxWidth: 480,
                }}
              >
                {ingredientsCopy.headline}
              </h2>
              <p
                style={{
                  marginTop: "clamp(18px, 2.4vw, 26px)",
                  fontSize: "clamp(15.5px, 1.4vw, 17.5px)",
                  lineHeight: 2,
                  color: "var(--sb-charcoal)",
                  fontWeight: 400,
                  maxWidth: 540,
                }}
              >
                {ingredientsCopy.body}
              </p>

              {/* ── Ingredient rows — editorial numbering + thin gold
               *  dividers. No card frames; the section's cream canvas
               *  is the canvas. Warm, elegant, never clinical.        */}
              <div style={{ marginTop: "clamp(28px, 3.4vw, 40px)" }}>
                {ingredientsCopy.items.map((item, i) => (
                  <IngredientRow
                    key={item.name}
                    index={i}
                    arabic={item.arabic}
                    name={item.name}
                    body={item.body}
                    isLast={i === ingredientsCopy.items.length - 1}
                  />
                ))}
              </div>

              {/* ── Closing finishing line — cinematic gold shimmer * 
               *  Sits a hair more separated from the ingredient list  *
               *  so it reads as the section's quiet exhale. The       *
               *  `.sb-tagline-shimmer` class paints the text in warm  *
               *  charcoal with a single soft gold band drifting       *
               *  every 8 s — luxurious, never flashy.                 */}
              <p
                className="sb-tagline-shimmer"
                style={{
                  marginTop: "clamp(32px, 4vw, 48px)",
                  fontFamily: "var(--font-sb-display), serif",
                  fontStyle: "italic",
                  fontSize: "clamp(14.5px, 1.3vw, 16px)",
                  lineHeight: 1.7,
                  fontWeight: 400,
                  letterSpacing: "0.03em",
                }}
              >
                {ingredientsCopy.outro}
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 *  Single ingredient row — quiet editorial entry.
 *
 *  ┌──────────────────────────────────────────────────────────────┐
 *  │  01    البيوتين   ·   Biotin                                 │
 *  │        يدعم مظهر الشعر الصحي والكثافة اليومية.               │
 *  └──────────────────────────────────────────────────────────────┘
 *      (thin gold hairline divider, omitted on the last row)
 *
 *  • italic Latin number in soft gold (01 / 02 / 03)
 *  • display-serif Arabic name + small italic Latin name beneath
 *  • soft body line that never reads as a feature claim
 * ──────────────────────────────────────────────────────────────────── */
function IngredientRow({
  index,
  arabic,
  name,
  body,
  isLast,
}: {
  index: number;
  arabic: string;
  name: string;
  body: string;
  isLast: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        columnGap: "clamp(16px, 2.2vw, 24px)",
        alignItems: "start",
        paddingBlock: "clamp(18px, 2.4vw, 26px)",
        // Hair-thin gold divider between rows — soft horizontal beat.
        borderBottom: isLast
          ? "none"
          : "1px solid rgba(184, 153, 104, 0.22)",
      }}
    >
      {/* Editorial 01 / 02 / 03 numeral — softer gold, lower opacity,
       *  slightly larger for an unhurried editorial feel. */}
      <span
        className="sb-num"
        style={{
          fontFamily: "var(--font-sb-latin), 'Cormorant Garamond', serif",
          fontStyle: "italic",
          // Bumped from clamp(28→36) → clamp(30→40).
          fontSize: "clamp(30px, 3.4vw, 40px)",
          fontWeight: 500,
          // Soft gold (--sb-gold-soft #d4b894) at 78 % — lighter than
          // the warm-gold accent before, so the numerals whisper rather
          // than punctuate.
          color: "var(--sb-gold-soft)",
          opacity: 0.78,
          lineHeight: 1,
          letterSpacing: "0.02em",
          // Slight optical alignment — italic glyphs sit visually low.
          marginTop: 2,
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-sb-display), serif",
              fontSize: "clamp(20px, 2vw, 24px)",
              fontWeight: 600,
              color: "var(--sb-ink)",
              lineHeight: 1.25,
              letterSpacing: "-0.005em",
              margin: 0,
            }}
          >
            {arabic}
          </h3>
          {/* Subtle gold middot + Latin name — quiet bilingual ornament */}
          <span
            aria-hidden
            style={{
              width: 4,
              height: 4,
              borderRadius: 999,
              background: "var(--sb-gold)",
              opacity: 0.6,
              display: "inline-block",
              transform: "translateY(-3px)",
            }}
          />
          {/* Latin ingredient label — softened so it never competes
           *  with the Arabic display name. Lighter italic weight via
           *  reduced opacity, slightly more refined letter-spacing. */}
          <span
            style={{
              fontFamily:
                "var(--font-sb-latin), 'Cormorant Garamond', serif",
              fontStyle: "italic",
              fontSize: "clamp(13.5px, 1.2vw, 15px)",
              color: "rgba(74, 70, 66, 0.62)",
              letterSpacing: "0.06em",
              fontWeight: 400,
            }}
          >
            {name}
          </span>
        </div>
        <p
          style={{
            marginTop: 8,
            fontSize: "clamp(14.5px, 1.2vw, 16px)",
            lineHeight: 1.85,
            color: "var(--sb-charcoal)",
            fontWeight: 400,
          }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}
