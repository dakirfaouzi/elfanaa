import Image from "next/image";
import { transformationCopy } from "../copy";
import { Reveal } from "../components/Reveal";

/**
 * SECTION 2 — Transformation / "Daily Ritual"
 *
 * Editorial luxury campaign moment. The conversion-heavy hero hands the
 * reader off to a quiet, image-led pause: a single dominant lifestyle
 * photograph followed by minimal centered typography, then a soft tag-line.
 *
 * Direction (per brief):
 *   • image MUST visually dominate the text
 *   • mobile-first vertical pacing
 *   • cream negative space, calm breathing room
 *   • emotional, not didactic — no pillar grid, no feature cards
 *
 * Composition:
 *   eyebrow (centered hairline rule)
 *      ↓
 *   ┌──────────────────────────────────────────────┐
 *   │                                              │
 *   │       full-bleed editorial photograph        │
 *   │              (3 / 4 portrait)                │
 *   │                                              │
 *   └──────────────────────────────────────────────┘
 *      ↓
 *   "كل صباح يبدأ بطقس صغير."   (display serif, large, multi-line)
 *      ↓
 *   body copy   (narrow column, 1.95 line-height)
 *      ↓
 *   ثقة  ·  نعومة  ·  أنوثة     (gold middots, quiet caps)
 *
 * Same lifestyle frame as the hero (the model's "morning ritual" with the
 * Sugarbear bottle on the marble vanity), re-cropped tighter on the hair
 * gesture so it reads as a continuation of the campaign rather than a
 * literal repetition.
 */
export function Transformation() {
  return (
    <section
      id="sb-transformation"
      style={{
        background: "var(--sb-cream)",
        // Tall vertical breathing room — this is the "emotional pause".
        paddingBlock: "clamp(80px, 12vw, 160px)",
      }}
    >
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        {/* ── Eyebrow — centered, with hairline rules either side ───── */}
        <Reveal>
          <p
            className="sb-eyebrow"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--sb-gold-deep)",
              marginBottom: "clamp(28px, 4vw, 44px)",
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

        {/* ── Dominant editorial photograph ─────────────────────────── *
         *  Capped at 720 px wide on desktop so the layout still has    *
         *  margin-air either side; on mobile it fills the column edge- *
         *  to-edge inside the section padding (perfectly centered via  *
         *  marginInline: auto).                                         *
         * ──────────────────────────────────────────────────────────── */}
        <Reveal delay={1}>
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 720,
              marginInline: "auto",
              aspectRatio: "3 / 4",
              borderRadius: 8,
              overflow: "hidden",
              // Soft warm shadow + a near-invisible gold hairline for that
              // matted-print luxury feel. No harsh edges.
              boxShadow:
                "0 50px 110px rgba(44, 40, 38, 0.18), " +
                "0 16px 40px rgba(184, 153, 104, 0.16), " +
                "0 0 0 1px rgba(184, 153, 104, 0.18)",
            }}
          >
            <Image
              src="/sugarbear/hero.png"
              alt="طقس صباحي للجمال — نعومة ولمعان من أول نظرة"
              fill
              sizes="(max-width: 1024px) calc(100vw - 48px), 720px"
              style={{
                objectFit: "cover",
                // Different crop than the hero (which uses 30%) — pulls
                // slightly lower so the hands-in-hair gesture and silk
                // robe become the focal point. Reads as a *new* moment.
                objectPosition: "center 42%",
              }}
            />
            {/* Whisper-soft top + bottom vignettes so the image melts into
             *  the cream page instead of cutting it sharply. */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(250, 246, 238, 0.10) 0%, transparent 18%, transparent 82%, rgba(250, 246, 238, 0.16) 100%)",
                pointerEvents: "none",
              }}
            />
          </div>
        </Reveal>

        {/* ── Quiet typography block — centered, narrow, breathy ────── */}
        <Reveal delay={2}>
          <div
            style={{
              marginTop: "clamp(40px, 6vw, 72px)",
              maxWidth: 620,
              marginInline: "auto",
              textAlign: "center",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-sb-display), serif",
                fontWeight: 600,
                // Slightly smaller than the hero headline so this section
                // reads as a quieter chapter beat, not a second pitch.
                fontSize: "clamp(32px, 5.4vw, 60px)",
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
                color: "var(--sb-ink)",
                whiteSpace: "pre-line",
                margin: 0,
              }}
            >
              {transformationCopy.headline}
            </h2>
            <p
              style={{
                marginTop: "clamp(20px, 2.8vw, 30px)",
                fontSize: "clamp(15.5px, 1.4vw, 17.5px)",
                lineHeight: 1.95,
                color: "var(--sb-charcoal-soft)",
                fontWeight: 400,
              }}
            >
              {transformationCopy.body}
            </p>

            {/* Minimalist emotional tag-row — three words, gold middots.
             *  No pills, no boxes — just a quiet caps line that reads as
             *  a brand mantra rather than a feature list. */}
            <div
              style={{
                marginTop: "clamp(28px, 4vw, 40px)",
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
