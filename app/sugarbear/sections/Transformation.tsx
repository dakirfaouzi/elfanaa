import Image from "next/image";
import { transformationCopy } from "../copy";
import { Reveal } from "../components/Reveal";

/**
 * SECTION 2 — Transformation / "Daily Ritual"
 *
 * Editorial luxury campaign moment. The conversion-heavy hero hands the
 * reader off to a quiet, image-led pause: a single dominant lifestyle
 * poster (which carries its own baked-in display headline) followed by a
 * tighter typography block and a soft tag-line.
 *
 * Direction (per brief):
 *   • image MUST visually dominate — used in its native 9:16 aspect with
 *     no aggressive cropping, preserving the campaign's warm cinematic
 *     tones exactly as art-directed
 *   • mobile-first vertical pacing, tighter gaps so the flow feels
 *     intimate (not floating in dead space)
 *   • desktop bottom whitespace cut by ~40 % so the section ends
 *     intentionally beneath the tag-line rather than drifting into a void
 *
 * Composition:
 *   eyebrow (centered hairline rule)
 *      ↓
 *   ┌──────────────────────────────────────────────┐
 *   │                                              │
 *   │      campaign poster — 9:16 portrait         │
 *   │      ("لمعان ونعومة طبيعية")                  │
 *   │                                              │
 *   └──────────────────────────────────────────────┘
 *      ↓ (tightened 28→48 px)
 *   "كل صباح يبدأ بلحظة اهتمام بنفسك."
 *      ↓
 *   body copy   (narrow column, 2.0 line-height)
 *      ↓
 *   نعومة  ·  لمعان  ·  كثافة     (gold middots)
 */
export function Transformation() {
  return (
    <section
      id="sb-transformation"
      style={{
        background: "var(--sb-cream)",
        // Asymmetric vertical breathing — top stays generous so the
        // section feels like a chapter break after the hero, but the
        // bottom is trimmed ~40 % so the tag-line marks a clear visual
        // exit instead of floating in empty cream.
        paddingTop: "clamp(72px, 11vw, 140px)",
        paddingBottom: "clamp(44px, 6.5vw, 88px)",
      }}
    >
      <div className="mx-auto max-w-[1240px] px-6 md:px-12">
        {/* ── Eyebrow — centered, with hairline rules either side ───── */}
        <Reveal>
          <p
            className="sb-eyebrow"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--sb-gold-deep)",
              marginBottom: "clamp(22px, 3.4vw, 38px)",
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
            <span style={{ margin: "0 14px" }}>{transformationCopy.eyebrow}</span>
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
        </Reveal>

        {/* ── Dominant editorial poster ─────────────────────────────── *
         *  Native 9:16 aspect (564×1024) so we never crop the model or  *
         *  the warm vanity scene baked into the campaign art-direction. *
         *  Capped at 560 px wide on desktop to keep the layout column-  *
         *  centred with breathing room either side; on mobile fills the *
         *  column inside the section padding (perfectly centered).      *
         * ──────────────────────────────────────────────────────────── */}
        <Reveal delay={1}>
          <div
            style={{
              position: "relative",
              width: "100%",
              // Modest desktop widening — gives the poster more presence
              // without losing the centred-editorial framing. Mobile is
              // unaffected (column is < maxWidth on every phone).
              maxWidth: 600,
              marginInline: "auto",
              aspectRatio: "564 / 1024",
              borderRadius: 8,
              overflow: "hidden",
              // Soft warm shadow + a near-invisible gold hairline for that
              // matted-print luxury feel. No harsh edges.
              boxShadow:
                "0 50px 110px rgba(44, 40, 38, 0.20), " +
                "0 16px 40px rgba(184, 153, 104, 0.16), " +
                "0 0 0 1px rgba(184, 153, 104, 0.18)",
            }}
          >
            <Image
              src="/sugarbear/transformation.png"
              alt="لمعان ونعومة طبيعية — شعر أكثر حيوية، نعومة وإشراقاً مع كل يوم"
              fill
              sizes="(max-width: 1024px) calc(100vw - 48px), 600px"
              style={{
                // The poster is art-directed — preserve every pixel of
                // the campaign typography and warm tones. With matching
                // aspect-ratio + cover, there is no crop.
                objectFit: "cover",
                objectPosition: "center",
              }}
            />
          </div>
        </Reveal>

        {/* ── Quiet typography block — tighter, narrower, breathy ───── */}
        <Reveal delay={2}>
          <div
            style={{
              // Tightened from 40→72 px to 28→48 px so the image and
              // headline read as one continuous emotional thought on
              // both mobile and desktop.
              marginTop: "clamp(28px, 4.2vw, 48px)",
              // Widened from 540 → 600 to match the new image width and
              // give the typography block matching horizontal presence
              // without losing centred elegance.
              maxWidth: 600,
              marginInline: "auto",
              textAlign: "center",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-sb-display), serif",
                fontWeight: 600,
                // Headline hierarchy is *unchanged* per brief — left at
                // the same scale (clamp 28→52) and 1.18 line-height.
                fontSize: "clamp(28px, 4.6vw, 52px)",
                lineHeight: 1.18,
                letterSpacing: "-0.01em",
                color: "var(--sb-ink)",
                whiteSpace: "pre-line",
                margin: 0,
                // Narrower than the wrapper to keep elegant rag-right
                // line-breaks and stop the headline reaching the column
                // edges on desktop.
                maxWidth: 480,
                marginInline: "auto",
              }}
            >
              {transformationCopy.headline}
            </h2>
            <p
              style={{
                marginTop: "clamp(18px, 2.4vw, 26px)",
                // Bumped one notch larger on desktop (15→17 → 15.5→18)
                // so the body reads comfortably across the widened
                // composition without becoming heavy.
                fontSize: "clamp(15.5px, 1.45vw, 18px)",
                // Slightly more breathable line-height for editorial calm.
                lineHeight: 2,
                // Darker than charcoal-soft (#4a4642) — uses the full
                // charcoal token (#2c2826) for clearer readability while
                // the lighter weight keeps the voice quiet and feminine.
                color: "var(--sb-charcoal)",
                fontWeight: 400,
                maxWidth: 540,
                marginInline: "auto",
              }}
            >
              {transformationCopy.body}
            </p>

            {/* Minimalist emotional tag-row — three words, gold middots.
             *  No pills, no boxes — just a quiet caps line that reads as
             *  a brand mantra rather than a feature list. */}
            <div
              style={{
                marginTop: "clamp(24px, 3.4vw, 36px)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                flexWrap: "wrap",
                fontFamily: "var(--font-sb-body)",
                fontSize: 12.5,
                fontWeight: 600,
                letterSpacing: "0.32em",
                color: "var(--sb-charcoal-soft)",
                textTransform: "none",
              }}
            >
              {transformationCopy.tags.map((tag, i) => (
                <span
                  key={tag}
                  style={{ display: "inline-flex", alignItems: "center", gap: 14 }}
                >
                  <span>{tag}</span>
                  {i < transformationCopy.tags.length - 1 && (
                    <span
                      aria-hidden
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 999,
                        background: "var(--sb-gold)",
                        opacity: 0.65,
                        display: "inline-block",
                      }}
                    />
                  )}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
