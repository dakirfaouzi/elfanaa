import { faqCopy } from "../copy";
import { Reveal } from "../components/Reveal";
import { FAQItem } from "../components/FAQItem";

/**
 * SECTION 9 — FAQ (luxury feminine reassurance, NOT support page)
 *
 * Composition:
 *   1. Centered editorial intro       eyebrow + headline + body
 *   2. Single rounded cream container wrapping all 6 Q/A items
 *      with hairline gold separators between them — turns the
 *      accordion into one editorial "page" instead of six detached
 *      Shopify rows.
 *   3. Closing italic micro-line       quiet brand voice
 *
 *   Each FAQItem (client component) handles its own smooth open/close
 *   animation via the CSS grid 0fr→1fr trick — no JS height measurement.
 */
export function FAQ() {
  return (
    <section
      id="sb-faq"
      style={{
        position: "relative",
        // Continuation of Trust → Offers → FAQ — settles back into base
        // cream. Soft warm bloom in the upper-end corner echoes the
        // section openings on Ritual + Trust without competing.
        background:
          "radial-gradient(80% 55% at 0% 0%, rgba(232, 204, 151, 0.14) 0%, transparent 60%), " +
          "linear-gradient(180deg, var(--sb-cream) 0%, #f4ead4 100%)",
        paddingTop: "clamp(72px, 10vw, 130px)",
        paddingBottom: "clamp(72px, 10vw, 130px)",
        overflow: "hidden",
      }}
    >
      <div className="relative mx-auto max-w-[920px] px-6 md:px-10">
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
              <span style={{ margin: "0 14px" }}>{faqCopy.eyebrow}</span>
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
              {faqCopy.headline}
            </h2>
            <p
              style={{
                marginTop: "clamp(18px, 2.4vw, 26px)",
                fontSize: "clamp(15.5px, 1.4vw, 17.5px)",
                lineHeight: 2,
                color: "var(--sb-charcoal)",
                fontWeight: 400,
                maxWidth: 560,
                marginInline: "auto",
              }}
            >
              {faqCopy.body}
            </p>
          </div>
        </Reveal>

        {/* ── 2) Accordion card — single rounded cream container ──── *
         *  All Q/A items live inside one editorial "page". Hairline   *
         *  gold separators sit between rows, never around the edges.  *
         * ─────────────────────────────────────────────────────────── */}
        <Reveal delay={1}>
          <div
            style={{
              marginTop: "clamp(40px, 5vw, 60px)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, transparent 70%), " +
                "rgba(255, 252, 244, 0.78)",
              borderRadius: 22,
              boxShadow:
                "0 0 0 1px rgba(184, 153, 104, 0.20) inset, " +
                "0 18px 48px rgba(44, 40, 38, 0.06), " +
                "0 6px 18px rgba(184, 153, 104, 0.10)",
              overflow: "hidden",
            }}
          >
            {faqCopy.items.map((item, i) => (
              <FAQItem
                key={item.q}
                q={item.q}
                a={item.a}
                isLast={i === faqCopy.items.length - 1}
              />
            ))}
          </div>
        </Reveal>

        {/* ── 3) Closing italic micro-line ────────────────────────── */}
        <Reveal delay={2}>
          <p
            style={{
              marginTop: "clamp(36px, 4.4vw, 56px)",
              fontFamily: "var(--font-sb-display), serif",
              fontStyle: "italic",
              fontSize: "clamp(14.5px, 1.3vw, 16px)",
              lineHeight: 1.7,
              color: "rgba(74, 70, 66, 0.7)",
              fontWeight: 400,
              letterSpacing: "0.02em",
              textAlign: "center",
              maxWidth: 560,
              marginInline: "auto",
            }}
          >
            {faqCopy.microline}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
