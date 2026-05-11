import Image from "next/image";
import { ritualCopy } from "../copy";
import { Reveal } from "../components/Reveal";

/**
 * SECTION 6 — Ritual (luxury feminine daily routine)
 *
 * Editorial split layout that turns the product into a small calm
 * self-care ritual. Reads as a luxury beauty campaign moment, never
 * as a "how to use the supplement" instruction block.
 *
 * Layout:
 *   • Desktop  →  text LEFT (col-span-6), image RIGHT (col-span-6),
 *                 vertically centred, large breathing space.
 *   • Mobile   →  image first, text stack below (image leads the eye).
 *
 * Direction (per brief):
 *   • warm cream background (NOT the dark charcoal of the previous
 *     version — that read as a different brand voice)
 *   • soft layered shadows only — no hard borders or feature blocks
 *   • three ritual moments: "مساءً / صباحاً / مع الوقت" + value lines
 *   • subtle gold hairline rules at the very top + bottom of the
 *     section so it sits inside the page like a framed campaign page
 *   • closing italic micro-line ("الجمال يبدأ من اللحظات الصغيرة.")
 */
export function Ritual() {
  return (
    <section
      id="sb-ritual"
      style={{
        position: "relative",
        // Settles back into base cream after Section 5's warmer cream.
        // A subtle radial bloom in the upper-end corner gives the
        // section a barely-there candle-warm atmosphere.
        background:
          "radial-gradient(80% 55% at 100% 0%, rgba(232, 204, 151, 0.18) 0%, transparent 60%), " +
          "linear-gradient(180deg, #f4ead4 0%, var(--sb-cream) 100%)",
        paddingTop: "clamp(64px, 9vw, 120px)",
        paddingBottom: "clamp(64px, 9vw, 120px)",
        overflow: "hidden",
      }}
    >
      {/* ── Top hairline gold rule — section opens like a magazine page */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          insetInline: "10%",
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(184, 153, 104, 0.42), transparent)",
        }}
      />

      <div className="relative mx-auto max-w-[1240px] px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* ── Editorial text column (LEFT on desktop) ──────────────── */}
          <Reveal as="div" className="lg:col-span-6 order-2 lg:order-1">
            <div
              style={{
                maxWidth: 580,
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
                <span style={{ margin: "0 14px" }}>{ritualCopy.eyebrow}</span>
              </p>
              <h2
                style={{
                  fontFamily: "var(--font-sb-display), serif",
                  fontSize: "clamp(30px, 4.4vw, 52px)",
                  lineHeight: 1.22,
                  fontWeight: 600,
                  color: "var(--sb-ink)",
                  letterSpacing: "-0.01em",
                  whiteSpace: "pre-line",
                  margin: 0,
                  maxWidth: 480,
                }}
              >
                {ritualCopy.headline}
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
                {ritualCopy.body}
              </p>

              {/* ── Three ritual moments — quiet horizontal row ──────── *
               *  Mobile  →  3 columns of small stacked entries          *
               *  Desktop →  3 columns inside the text column            *
               *  Each entry: gold caps time-of-day + Arabic display     *
               *  serif value line. Soft gold middot dividers between    *
               *  on desktop — invisible on mobile so each line breathes.*
               * ──────────────────────────────────────────────────────── */}
              <div
                style={{
                  marginTop: "clamp(32px, 4vw, 44px)",
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "clamp(14px, 1.8vw, 22px)",
                }}
              >
                {ritualCopy.steps.map((step, i) => (
                  <Reveal
                    key={step.time}
                    delay={((i % 3) + 1) as 1 | 2 | 3}
                  >
                    <RitualMoment time={step.time} value={step.value} />
                  </Reveal>
                ))}
              </div>

              {/* ── Closing italic micro-line — brand whisper ─────── */}
              <p
                style={{
                  marginTop: "clamp(28px, 3.6vw, 38px)",
                  fontFamily: "var(--font-sb-display), serif",
                  fontStyle: "italic",
                  fontSize: "clamp(14.5px, 1.3vw, 16px)",
                  lineHeight: 1.7,
                  color: "rgba(74, 70, 66, 0.78)",
                  fontWeight: 400,
                  letterSpacing: "0.02em",
                }}
              >
                {ritualCopy.microline}
              </p>
            </div>
          </Reveal>

          {/* ── Image column (RIGHT on desktop, FIRST on mobile) ────── */}
          <Reveal
            as="div"
            delay={1}
            className="lg:col-span-6 order-1 lg:order-2"
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                // Slightly narrower than the Ingredients section image
                // so the two consecutive editorial spreads have a
                // gentle visual cadence rather than identical size.
                maxWidth: 500,
                marginInline: "auto",
                aspectRatio: "576 / 1024",
                borderRadius: 32,
                overflow: "hidden",
                // Soft cinematic warm shadow only — preserves the
                // photograph's atmosphere without a hard frame.
                boxShadow:
                  "0 50px 110px rgba(44, 40, 38, 0.20), " +
                  "0 16px 40px rgba(184, 153, 104, 0.18), " +
                  "0 0 0 1px rgba(184, 153, 104, 0.20)",
              }}
            >
              <Image
                src="/sugarbear/ritual.png"
                alt="طقس صباحي للجمال — لحظة هادئة بينكِ وبين نفسكِ، شعر أكثر نعومة ولمعاناً مع كل نظرة"
                fill
                sizes="(max-width: 1024px) calc(100vw - 48px), 500px"
                style={{
                  objectFit: "cover",
                  objectPosition: "center",
                }}
              />
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── Bottom hairline gold rule — section closes like a magazine page */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          bottom: 0,
          insetInline: "10%",
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(184, 153, 104, 0.42), transparent)",
        }}
      />
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 *  Single ritual moment — soft gold caps time-of-day above an editorial
 *  display-serif value line. No body copy, no badge, no icon.
 *
 *      مساءً
 *      قطعتان يومياً
 * ──────────────────────────────────────────────────────────────────── */
function RitualMoment({ time, value }: { time: string; value: string }) {
  return (
    <div style={{ paddingBlockStart: 22, position: "relative" }}>
      {/* Hair-thin gold rule across the top of every moment — quiet
       *  editorial ornament, never a card border. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          insetInlineStart: 0,
          width: 22,
          height: 1,
          background: "var(--sb-gold)",
          opacity: 0.7,
        }}
      />
      <p
        className="sb-num"
        style={{
          fontFamily: "var(--font-sb-body)",
          fontSize: 11.5,
          color: "var(--sb-gold-deep)",
          letterSpacing: "0.32em",
          fontWeight: 600,
          textTransform: "none",
          margin: 0,
        }}
      >
        {time}
      </p>
      <p
        style={{
          marginTop: 8,
          fontFamily: "var(--font-sb-display), serif",
          fontSize: "clamp(16px, 1.5vw, 19px)",
          fontWeight: 600,
          lineHeight: 1.35,
          color: "var(--sb-ink)",
          letterSpacing: "-0.005em",
        }}
      >
        {value}
      </p>
    </div>
  );
}
