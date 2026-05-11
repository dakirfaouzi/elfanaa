import { reviewsCopy } from "../copy";
import { Reveal } from "../components/Reveal";
import { Stars } from "../components/Stars";
import { IconQuote } from "../components/Icons";

/**
 * SECTION 7 — Testimonials / Reviews
 *
 * Luxury editorial testimonial composition. The brief explicitly forbids
 * an ecommerce reviews block, so this section reads as a feminine
 * beauty campaign page:
 *
 *   1. Centered editorial intro     → eyebrow + headline + body
 *   2. One featured testimonial      → large cream card, gold-glow
 *                                      border, oversized pull-quote mark,
 *                                      attribution + small muted stars
 *   3. Three minimal grid cards      → quote + name only, no avatars,
 *                                      no verified badges, no per-card
 *                                      stars (per brief)
 *   4. Refined rating display        → "4.9 / متوسط التقييم /
 *                                      من آلاف المراجعات" with small
 *                                      muted-gold stars
 *
 *  All animation = soft fade-up reveals only (no carousels, no autoplay).
 */
export function Reviews() {
  return (
    <section
      id="sb-reviews"
      style={{
        position: "relative",
        // Continuation of the warm cream story — fades from Section 6's
        // base cream into a slightly warmer cream at the bottom so
        // Section 8 (Offers) lands on a soft transition rather than a
        // hard cut.
        background:
          "linear-gradient(180deg, var(--sb-cream) 0%, #f4ead4 100%)",
        paddingTop: "clamp(72px, 10vw, 130px)",
        paddingBottom: "clamp(72px, 10vw, 130px)",
        overflow: "hidden",
      }}
    >
      <div className="relative mx-auto max-w-[1180px] px-6 md:px-10">
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
              <span style={{ margin: "0 14px" }}>{reviewsCopy.eyebrow}</span>
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
                fontSize: "clamp(30px, 4.4vw, 52px)",
                lineHeight: 1.22,
                fontWeight: 600,
                color: "var(--sb-ink)",
                letterSpacing: "-0.01em",
                whiteSpace: "pre-line",
                margin: 0,
              }}
            >
              {reviewsCopy.headline}
            </h2>
            <p
              style={{
                marginTop: "clamp(18px, 2.4vw, 26px)",
                fontSize: "clamp(15.5px, 1.4vw, 17.5px)",
                lineHeight: 2,
                color: "var(--sb-charcoal)",
                fontWeight: 400,
                maxWidth: 580,
                marginInline: "auto",
                whiteSpace: "pre-line",
              }}
            >
              {reviewsCopy.body}
            </p>
          </div>
        </Reveal>

        {/* ── 2) Featured testimonial — editorial pull-quote card ── */}
        <Reveal delay={1}>
          <FeaturedQuote />
        </Reveal>

        {/* ── 3) Three minimal cards ──────────────────────────────── */}
        <div
          className="grid grid-cols-1 md:grid-cols-3"
          style={{
            marginTop: "clamp(36px, 4.5vw, 56px)",
            gap: "clamp(16px, 1.8vw, 22px)",
          }}
        >
          {reviewsCopy.cards.map((c, i) => (
            <Reveal key={c.name} delay={((i % 3) + 1) as 1 | 2 | 3}>
              <MiniQuoteCard quote={c.quote} name={c.name} />
            </Reveal>
          ))}
        </div>

        {/* ── 4) Refined rating display — typography, not a widget ─ */}
        <Reveal delay={2}>
          <RefinedRating />
        </Reveal>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 *  Featured testimonial — single large editorial card.
 *
 *  Reads as a magazine pull-quote: oversized soft-gold quotation mark
 *  in the upper corner, large display-serif Arabic quote, hairline
 *  gold rule, attribution (name + city) and small muted gold stars.
 *
 *  Subtle gold "glow" instead of a hard border — a 1 px gold inset
 *  + warm cream gradient background + diffused warm shadow, so the
 *  card feels lit from within rather than framed.
 * ──────────────────────────────────────────────────────────────────── */
function FeaturedQuote() {
  return (
    <article
      style={{
        position: "relative",
        marginTop: "clamp(40px, 5vw, 64px)",
        marginInline: "auto",
        maxWidth: 820,
        // Warm cream-on-cream gradient lifts the card off the section
        // background without a hard border.
        background:
          "linear-gradient(180deg, #fffaef 0%, #fbf2dd 100%)",
        borderRadius: 22,
        padding: "clamp(40px, 5vw, 68px) clamp(28px, 4.6vw, 64px)",
        // Subtle gold "glow": 1 px inset gold ring + diffused warm shadow.
        boxShadow:
          "0 0 0 1px rgba(184, 153, 104, 0.32) inset, " +
          "0 30px 70px rgba(44, 40, 38, 0.08), " +
          "0 8px 28px rgba(184, 153, 104, 0.14)",
        textAlign: "center",
        overflow: "hidden",
      }}
    >
      {/* Soft warm bloom in the upper-end corner — felt, not seen */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: -60,
          insetInlineEnd: -60,
          width: 220,
          height: 220,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(232, 204, 151, 0.32) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Oversized soft-gold quotation ornament */}
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          color: "var(--sb-gold-soft)",
          opacity: 0.85,
        }}
      >
        <IconQuote size={42} />
      </span>

      <blockquote
        style={{
          margin: "clamp(14px, 1.8vw, 22px) auto 0",
          fontFamily: "var(--font-sb-display), serif",
          fontSize: "clamp(22px, 2.6vw, 32px)",
          lineHeight: 1.55,
          fontWeight: 500,
          color: "var(--sb-ink)",
          letterSpacing: "-0.005em",
          whiteSpace: "pre-line",
          maxWidth: 640,
        }}
      >
        {reviewsCopy.featured.quote}
      </blockquote>

      {/* Hair-thin gold divider before the attribution */}
      <span
        aria-hidden
        style={{
          display: "block",
          width: 36,
          height: 1,
          margin: "clamp(22px, 2.6vw, 30px) auto 0",
          background: "var(--sb-gold)",
          opacity: 0.6,
        }}
      />

      <div
        style={{
          marginTop: "clamp(16px, 1.8vw, 22px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <p
          style={{
            fontSize: "clamp(14px, 1.2vw, 15.5px)",
            color: "var(--sb-charcoal)",
            fontWeight: 600,
            letterSpacing: "0.02em",
            margin: 0,
          }}
        >
          — {reviewsCopy.featured.name}
          <span
            style={{
              color: "var(--sb-charcoal-soft)",
              fontWeight: 400,
              margin: "0 8px",
            }}
          >
            ·
          </span>
          <span
            style={{
              color: "var(--sb-charcoal-soft)",
              fontWeight: 400,
            }}
          >
            {reviewsCopy.featured.city}
          </span>
        </p>
        <Stars value={4.9} size={13} color="var(--sb-gold-soft)" />
      </div>
    </article>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 *  Minimal cream card — quote + name only.
 *
 *  No avatars, no per-card star ratings, no verified badges, no body
 *  paragraph. Reads as a feminine handwritten note in a magazine.
 * ──────────────────────────────────────────────────────────────────── */
function MiniQuoteCard({ quote, name }: { quote: string; name: string }) {
  return (
    <article
      style={{
        position: "relative",
        background: "rgba(255, 252, 244, 0.78)",
        borderRadius: 18,
        padding: "clamp(26px, 3vw, 34px) clamp(22px, 2.6vw, 30px)",
        boxShadow:
          "0 0 0 1px rgba(184, 153, 104, 0.16) inset, " +
          "0 14px 40px rgba(44, 40, 38, 0.05), " +
          "0 4px 14px rgba(184, 153, 104, 0.08)",
        // White inner highlight that fades downward — cream-on-cream
        // depth without a hard border.
        backgroundImage:
          "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, transparent 70%), " +
          "linear-gradient(180deg, rgba(255,252,244,0.78), rgba(255,252,244,0.78))",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "clamp(20px, 2.4vw, 26px)",
      }}
    >
      {/* Tiny gold quotation glyph — quiet ornament, not a label */}
      <span
        aria-hidden
        style={{
          color: "var(--sb-gold-soft)",
          opacity: 0.7,
          display: "inline-flex",
        }}
      >
        <IconQuote size={20} />
      </span>

      <p
        style={{
          fontFamily: "var(--font-sb-display), serif",
          fontSize: "clamp(16px, 1.5vw, 19px)",
          lineHeight: 1.65,
          color: "var(--sb-ink)",
          fontWeight: 500,
          letterSpacing: "-0.005em",
          whiteSpace: "pre-line",
          margin: 0,
          flex: 1,
        }}
      >
        {quote}
      </p>

      <div
        style={{
          paddingTop: 16,
          borderTop: "1px solid rgba(184, 153, 104, 0.18)",
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--sb-charcoal)",
            letterSpacing: "0.04em",
            margin: 0,
          }}
        >
          — {name}
        </p>
      </div>
    </article>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 *  Refined rating block — typography first, stars second.
 *
 *      4.9          ★ ★ ★ ★ ★
 *      متوسط التقييم
 *      من آلاف المراجعات
 *
 *  Sits at the bottom of the section as a quiet luxury sign-off,
 *  never as an ecommerce reviews summary widget.
 * ──────────────────────────────────────────────────────────────────── */
function RefinedRating() {
  return (
    <div
      style={{
        marginTop: "clamp(48px, 6vw, 84px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        textAlign: "center",
      }}
    >
      {/* Hair-thin gold rule above the rating — elegant separator */}
      <span
        aria-hidden
        style={{
          display: "block",
          width: 60,
          height: 1,
          background:
            "linear-gradient(90deg, transparent, var(--sb-gold), transparent)",
          opacity: 0.6,
          marginBottom: 8,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sb-display), serif",
            fontSize: "clamp(36px, 4.4vw, 52px)",
            fontWeight: 600,
            color: "var(--sb-ink)",
            letterSpacing: "-0.01em",
            lineHeight: 1,
          }}
        >
          4.9
        </span>
        <Stars value={4.9} size={16} color="var(--sb-gold-soft)" />
      </div>

      <p
        style={{
          marginTop: 4,
          fontFamily: "var(--font-sb-display), serif",
          fontSize: "clamp(15.5px, 1.4vw, 18px)",
          color: "var(--sb-ink)",
          fontWeight: 500,
          letterSpacing: "0.005em",
          margin: 0,
        }}
      >
        {reviewsCopy.rating.title}
      </p>
      <p
        style={{
          fontSize: "clamp(13px, 1.1vw, 14.5px)",
          color: "rgba(74, 70, 66, 0.66)",
          fontWeight: 400,
          letterSpacing: "0.04em",
          margin: 0,
        }}
      >
        {reviewsCopy.rating.subtitle}
      </p>
    </div>
  );
}
