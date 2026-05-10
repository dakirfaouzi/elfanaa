"use client";

import Link from "next/link";
import { finalCtaCopy, microcopy, brand, footerCopy } from "../copy";
import { useSugarbear } from "../state";
import { Reveal } from "../components/Reveal";
import { IconBag, IconCheck } from "../components/Icons";

export function FinalCTA() {
  const { current } = useSugarbear();

  return (
    <section
      style={{
        background:
          "radial-gradient(80% 60% at 50% 0%, rgba(212,184,148,0.20) 0%, transparent 65%), " +
          "linear-gradient(180deg, var(--sb-cream) 0%, #f4ecdb 100%)",
        paddingBlock: "clamp(80px, 11vw, 160px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="mx-auto max-w-[840px] px-6 md:px-10 text-center">
        <Reveal>
          <p className="sb-eyebrow">
            <span className="sb-rule" />
            <span style={{ margin: "0 12px" }}>{finalCtaCopy.eyebrow}</span>
            <span className="sb-rule" />
          </p>
        </Reveal>

        <Reveal delay={1}>
          <h2
            style={{
              fontFamily: "var(--font-sb-display), serif",
              fontSize: "clamp(44px, 7vw, 96px)",
              fontWeight: 600,
              lineHeight: 1,
              color: "var(--sb-charcoal)",
              marginTop: 22,
              letterSpacing: "-0.02em",
              whiteSpace: "pre-line",
            }}
          >
            {finalCtaCopy.headline}
          </h2>
        </Reveal>

        <Reveal delay={2}>
          <p
            style={{
              marginTop: 28,
              fontSize: "clamp(15px, 1.4vw, 17.5px)",
              lineHeight: 1.95,
              color: "var(--sb-charcoal-soft)",
              maxWidth: 600,
              marginInline: "auto",
            }}
          >
            {finalCtaCopy.body}
          </p>
        </Reveal>

        <Reveal delay={3}>
          <a
            href="#sb-offers"
            className="sb-cta inline-flex items-center justify-center gap-3"
            style={{
              marginTop: 44,
              background: "var(--sb-charcoal)",
              color: "var(--sb-cream)",
              padding: "20px 38px",
              borderRadius: 999,
              fontSize: 15.5,
              fontWeight: 600,
              letterSpacing: "0.02em",
              boxShadow: "var(--sb-shadow-md)",
              minWidth: 260,
            }}
          >
            <IconBag size={18} color="var(--sb-gold-soft)" />
            {finalCtaCopy.ctaIdle}
            <span
              style={{
                paddingInlineStart: 14,
                borderInlineStart: "1px solid rgba(212,184,148,0.4)",
                marginInlineStart: 8,
                fontWeight: 500,
              }}
            >
              <span className="sb-num">{current.price}</span> {microcopy.currency}
            </span>
          </a>
        </Reveal>

        <Reveal delay={4}>
          <ul
            className="mt-7 flex flex-wrap items-center justify-center"
            style={{
              gap: "10px 24px",
              color: "var(--sb-charcoal-soft)",
            }}
          >
            {finalCtaCopy.reassurance.map((r) => (
              <li
                key={r}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 13,
                }}
              >
                <IconCheck size={13} color="var(--sb-gold)" />
                {r}
              </li>
            ))}
          </ul>
        </Reveal>

      </div>

      {/* ── House footer: فناء dominant, Sugarbear quietly credited ─── */}
      <FanaaFooter />
    </section>
  );
}

/**
 * Footer composed in three soft tiers, all centered:
 *   1.  House wordmark "فناء" in Amiri (the master logo face)
 *   2.  Manifesto + horizontal nav links
 *   3.  Hairline · product credit · legal
 *
 * No SUGARBEAR shimmer headline anymore — the page sits inside فناء's
 * world; Sugarbear is quietly credited as a product in that world.
 */
function FanaaFooter() {
  return (
    <footer
      style={{
        marginTop: "clamp(60px, 8vw, 100px)",
        borderTop: "1px solid rgba(184,153,104,0.22)",
        background:
          "radial-gradient(60% 60% at 50% 0%, rgba(212,184,148,0.10) 0%, transparent 70%), " +
          "linear-gradient(180deg, transparent 0%, rgba(244, 236, 219, 0.6) 100%)",
        paddingBlock: "clamp(56px, 7vw, 88px) clamp(28px, 3vw, 36px)",
      }}
    >
      <div className="mx-auto max-w-[920px] px-6 md:px-10 text-center">
        <Reveal>
          {/* Tier 1 — house wordmark */}
          <Link
            href="/"
            aria-label={`${brand.house} — الرئيسية`}
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
              color: "var(--sb-charcoal)",
              transition: "opacity 240ms ease",
            }}
            className="hover:opacity-80"
          >
            <span
              aria-hidden
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 14,
                color: "var(--sb-gold)",
              }}
            >
              <span
                style={{
                  width: 38,
                  height: 1,
                  background:
                    "linear-gradient(90deg, transparent, var(--sb-gold), transparent)",
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: "var(--sb-gold)",
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  width: 38,
                  height: 1,
                  background:
                    "linear-gradient(90deg, transparent, var(--sb-gold), transparent)",
                  display: "inline-block",
                }}
              />
            </span>
            <span
              style={{
                fontFamily: "var(--font-arabic-display), 'El Messiri', serif",
                fontSize: "clamp(56px, 7vw, 96px)",
                fontWeight: 700,
                color: "var(--sb-charcoal)",
                lineHeight: 1,
                letterSpacing: "0.02em",
              }}
            >
              {brand.house}
            </span>
            <span
              style={{
                fontFamily: "var(--font-sb-latin), 'Cormorant Garamond', serif",
                fontStyle: "italic",
                fontSize: 12,
                letterSpacing: "0.36em",
                color: "var(--sb-gold-deep)",
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              {brand.houseLatin}
            </span>
          </Link>
        </Reveal>

        {/* Tier 2 — manifesto */}
        <Reveal delay={1}>
          <p
            style={{
              marginTop: 28,
              fontSize: 15,
              lineHeight: 1.95,
              color: "var(--sb-charcoal-soft)",
              maxWidth: 540,
              marginInline: "auto",
            }}
          >
            {footerCopy.manifesto}
          </p>
        </Reveal>

        {/* Tier 2b — quiet horizontal nav */}
        <Reveal delay={2}>
          <ul
            style={{
              marginTop: 32,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "10px 28px",
              fontSize: 13.5,
              fontWeight: 500,
              listStyle: "none",
              padding: 0,
            }}
          >
            {footerCopy.links.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  style={{
                    color: "var(--sb-charcoal)",
                    textDecoration: "none",
                    transition: "color 240ms ease",
                    paddingBlock: 4,
                    borderBottom: "1px solid transparent",
                    letterSpacing: "0.02em",
                  }}
                  className="hover:!text-[var(--sb-gold-deep)]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* Tier 3 — hairline · product credit · legal */}
        <Reveal delay={3}>
          <div
            style={{
              marginTop: 48,
              paddingTop: 22,
              borderTop: "1px solid rgba(184,153,104,0.18)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-sb-latin), serif",
                fontStyle: "italic",
                fontSize: 12.5,
                color: "var(--sb-stone)",
                letterSpacing: "0.04em",
              }}
            >
              {footerCopy.productCredit}
            </p>
            <p
              style={{
                fontSize: 11.5,
                color: "var(--sb-stone)",
                letterSpacing: "0.06em",
              }}
            >
              {footerCopy.legal}
            </p>
          </div>
        </Reveal>
      </div>
    </footer>
  );
}
