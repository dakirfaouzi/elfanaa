"use client";

import Link from "next/link";
import Image from "next/image";
import { finalCtaCopy, microcopy, brand, footerCopy, offersCopy } from "../copy";
import { useSugarbear } from "../state";
import { Reveal } from "../components/Reveal";
import { IconBag, IconCheck } from "../components/Icons";
import { useAddToCart } from "../useAddToCart";

/**
 * SECTION 10 — Final CTA / Closing Section
 *
 * The final emotional invitation. Three calm beats:
 *
 *   1. Editorial intro            eyebrow + headline + body + bridge line
 *   2. Premium invitation card    bottle thumb + offer summary + CTA
 *                                 button + reassurance line + trust pills
 *   3. Closing italic micro-line  quiet feminine sign-off
 *
 * Then the page-wide FanaaFooter renders below — that's the global
 * brand chrome, not part of this CTA refactor.
 */
export function FinalCTA() {
  const { current } = useSugarbear();
  const offerMeta = offersCopy.bundles.find((b) => b.id === current.id);

  return (
    <section
      id="sb-final-cta"
      style={{
        position: "relative",
        // Continuation of the FAQ → FinalCTA → footer story. A soft warm
        // bloom from the top centre lifts the section into the cream
        // base without competing with the invitation card itself.
        background:
          "radial-gradient(80% 60% at 50% 0%, rgba(212, 184, 148, 0.20) 0%, transparent 65%), " +
          "linear-gradient(180deg, #f4ead4 0%, var(--sb-cream) 100%)",
        paddingTop: "clamp(80px, 11vw, 150px)",
        paddingBottom: "clamp(56px, 7vw, 88px)",
        overflow: "hidden",
      }}
    >
      <div className="relative mx-auto max-w-[920px] px-6 md:px-10">
        {/* ── 1) Editorial intro ──────────────────────────────────── */}
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
              <span style={{ margin: "0 14px" }}>{finalCtaCopy.eyebrow}</span>
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
                fontSize: "clamp(32px, 5vw, 60px)",
                lineHeight: 1.18,
                fontWeight: 600,
                color: "var(--sb-ink)",
                letterSpacing: "-0.015em",
                whiteSpace: "pre-line",
                margin: 0,
              }}
            >
              {finalCtaCopy.headline}
            </h2>
            <p
              style={{
                marginTop: "clamp(20px, 2.6vw, 28px)",
                fontSize: "clamp(15.5px, 1.4vw, 17.5px)",
                lineHeight: 2,
                color: "var(--sb-charcoal)",
                fontWeight: 400,
                maxWidth: 580,
                marginInline: "auto",
                whiteSpace: "pre-line",
              }}
            >
              {finalCtaCopy.body}
            </p>

            {/* Soft bridge micro-copy linking the body to the card */}
            <p
              style={{
                marginTop: "clamp(20px, 2.4vw, 26px)",
                fontFamily: "var(--font-sb-display), serif",
                fontStyle: "italic",
                fontSize: "clamp(14.5px, 1.3vw, 16px)",
                color: "rgba(74, 70, 66, 0.7)",
                fontWeight: 400,
                letterSpacing: "0.02em",
              }}
            >
              {finalCtaCopy.microCopy}
            </p>
          </div>
        </Reveal>

        {/* ── 2) Premium invitation card ──────────────────────────── */}
        <Reveal delay={1}>
          <InvitationCard
            offerHeadline={offerMeta?.headline ?? "ثلاثة أشهر"}
            offerSub={offerMeta?.sub ?? "للتحوّل الحقيقي"}
            price={current.price}
            saving={current.saving}
            ctaIdle={finalCtaCopy.ctaIdle}
            reassuranceLine={finalCtaCopy.reassuranceLine}
            trustChips={finalCtaCopy.trustChips}
            currency={microcopy.currency}
          />
        </Reveal>

        {/* ── 3) Closing italic micro-line ────────────────────────── */}
        <Reveal delay={2}>
          <p
            style={{
              marginTop: "clamp(36px, 4.6vw, 56px)",
              fontFamily: "var(--font-sb-display), serif",
              fontStyle: "italic",
              fontSize: "clamp(15px, 1.35vw, 17px)",
              lineHeight: 1.7,
              color: "rgba(74, 70, 66, 0.72)",
              fontWeight: 400,
              letterSpacing: "0.02em",
              textAlign: "center",
              maxWidth: 580,
              marginInline: "auto",
            }}
          >
            {finalCtaCopy.microline}
          </p>
        </Reveal>
      </div>

      {/* ── House footer: فناء dominant, Sugarbear quietly credited ─── */}
      <FanaaFooter />
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 *  Premium invitation card — the centerpiece of the final CTA.
 *
 *  Composition (centred, single column on mobile, three calm rows
 *  on desktop):
 *
 *      ┌────────────────────────────────────────────────────┐
 *      │  [bottle thumb]   ثلاثة أشهر · للتحوّل الحقيقي    │
 *      │                                                    │
 *      │            ٣٤٩ ريال       وفّري ١٤٨ ريال          │
 *      │                                                    │
 *      │     ┌────────────────────────────────────┐         │
 *      │     │  ابدئي طقس جمالكِ اليوم   ٣٤٩ ريال │         │
 *      │     └────────────────────────────────────┘         │
 *      │                                                    │
 *      │     دفع عند الاستلام · شحن سريع داخل المملكة      │
 *      │                                                    │
 *      │  [✓ ٢٤ ساعة]   [✓ COD]   [✓ ١٤ يوم]              │
 *      └────────────────────────────────────────────────────┘
 *
 *  Visual direction:
 *    • cream-on-cream gradient body, 1px gold inset ring
 *    • soft warm bloom in the upper-end corner — felt, not seen
 *    • subtle rounded bottle thumbnail beside the offer summary
 *    • prominent display-serif price + small gold savings line
 *    • dark luxury CTA button (charcoal) with bag icon + price slot
 *    • single editorial reassurance line below the CTA
 *    • three quiet trust pills underneath
 * ──────────────────────────────────────────────────────────────────── */
function InvitationCard({
  offerHeadline,
  offerSub,
  price,
  saving,
  ctaIdle,
  reassuranceLine,
  trustChips,
  currency,
}: {
  offerHeadline: string;
  offerSub: string;
  price: number;
  saving: number;
  ctaIdle: string;
  reassuranceLine: string;
  trustChips: string[];
  currency: string;
}) {
  const addToCart = useAddToCart();
  return (
    <div
      style={{
        position: "relative",
        marginTop: "clamp(40px, 5vw, 64px)",
        marginInline: "auto",
        maxWidth: 720,
        background: "linear-gradient(180deg, #fffaef 0%, #fbf2dd 100%)",
        borderRadius: 26,
        padding: "clamp(36px, 4.6vw, 56px) clamp(26px, 4vw, 56px)",
        boxShadow:
          "0 0 0 1px rgba(184, 153, 104, 0.32) inset, " +
          "0 30px 70px rgba(44, 40, 38, 0.10), " +
          "0 10px 30px rgba(184, 153, 104, 0.16)",
        textAlign: "center",
        overflow: "hidden",
      }}
    >
      {/* Soft warm bloom in the upper-end corner — felt, not seen */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: -80,
          insetInlineEnd: -80,
          width: 260,
          height: 260,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(232, 204, 151, 0.32) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Top hairline gold ornament — quiet editorial cue */}
      <span
        aria-hidden
        style={{
          display: "block",
          width: 40,
          height: 1,
          margin: "0 auto",
          background: "var(--sb-gold)",
          opacity: 0.65,
        }}
      />

      {/* Offer summary — bottle thumb + name + sub-label */}
      <div
        style={{
          marginTop: "clamp(20px, 2.4vw, 28px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            position: "relative",
            width: 72,
            height: 60,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            // Soft warm halo beneath the bottle thumbnail.
            filter:
              "drop-shadow(0 6px 14px rgba(44, 40, 38, 0.12)) " +
              "drop-shadow(0 2px 4px rgba(184, 153, 104, 0.18))",
          }}
        >
          <Image
            src="/sugarbear/bottle-trio.png"
            alt=""
            width={72}
            height={60}
            sizes="72px"
            style={{
              width: "auto",
              height: "100%",
              objectFit: "contain",
            }}
          />
          {/* Tiny ground halo */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              bottom: -4,
              left: "50%",
              transform: "translateX(-50%)",
              width: 56,
              height: 8,
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse, rgba(184, 153, 104, 0.30) 0%, transparent 70%)",
            }}
          />
        </div>

        <p
          style={{
            fontFamily: "var(--font-sb-display), serif",
            fontSize: "clamp(20px, 2vw, 24px)",
            fontWeight: 600,
            color: "var(--sb-ink)",
            margin: 0,
            letterSpacing: "-0.005em",
          }}
        >
          {offerHeadline}
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
              fontSize: "clamp(15px, 1.4vw, 17px)",
            }}
          >
            {offerSub}
          </span>
        </p>
      </div>

      {/* Price line + savings */}
      <div
        style={{
          marginTop: "clamp(18px, 2vw, 24px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <span
            className="sb-num"
            style={{
              fontFamily: "var(--font-sb-display), serif",
              fontSize: "clamp(38px, 4.6vw, 52px)",
              fontWeight: 600,
              color: "var(--sb-ink)",
              letterSpacing: "-0.015em",
              lineHeight: 1,
            }}
          >
            {price}
          </span>
          <span
            style={{
              fontSize: "clamp(15px, 1.4vw, 18px)",
              color: "var(--sb-charcoal-soft)",
              fontWeight: 500,
              letterSpacing: "0.02em",
            }}
          >
            {currency}
          </span>
        </div>
        {saving > 0 && (
          <p
            style={{
              fontSize: "clamp(13px, 1.15vw, 14px)",
              color: "var(--sb-gold-deep)",
              fontWeight: 600,
              letterSpacing: "0.04em",
              margin: 0,
            }}
          >
            وفّري <span className="sb-num">{saving}</span> {currency}
          </p>
        )}
      </div>

      {/* Hair-thin gold divider before the CTA */}
      <span
        aria-hidden
        style={{
          display: "block",
          width: 36,
          height: 1,
          margin: "clamp(22px, 2.6vw, 28px) auto 0",
          background: "var(--sb-gold)",
          opacity: 0.5,
        }}
      />

      {/* CTA button — dark luxury, mirrors the hero CTA tone */}
      <button
        type="button"
        onClick={() => addToCart()}
        className="sb-cta inline-flex items-center justify-center"
        style={{
          marginTop: "clamp(22px, 2.6vw, 28px)",
          background: "var(--sb-charcoal)",
          color: "var(--sb-cream)",
          padding: "20px 38px",
          borderRadius: 999,
          fontSize: "clamp(15px, 1.4vw, 16.5px)",
          fontWeight: 600,
          letterSpacing: "0.02em",
          gap: 14,
          boxShadow:
            "0 18px 38px rgba(44, 40, 38, 0.22), " +
            "0 8px 18px rgba(44, 40, 38, 0.18), " +
            "0 0 0 1px rgba(212, 184, 148, 0.22) inset",
          minWidth: 280,
          border: "none",
          cursor: "pointer",
        }}
      >
        <IconBag size={18} color="var(--sb-gold-soft)" />
        <span>{ctaIdle}</span>
        <span
          style={{
            paddingInlineStart: 14,
            borderInlineStart: "1px solid rgba(212, 184, 148, 0.30)",
            marginInlineStart: 4,
            fontWeight: 500,
          }}
        >
          <span className="sb-num">{price}</span> {currency}
        </span>
      </button>

      {/* Reassurance line — single editorial sentence */}
      <p
        style={{
          marginTop: "clamp(18px, 2vw, 22px)",
          fontSize: "clamp(13px, 1.15vw, 14px)",
          color: "var(--sb-charcoal-soft)",
          fontWeight: 500,
          letterSpacing: "0.02em",
          margin: "clamp(18px, 2vw, 22px) 0 0",
        }}
      >
        {reassuranceLine}
      </p>

      {/* Trust pills — three quiet reassurance tokens */}
      <ul
        style={{
          marginTop: "clamp(18px, 2vw, 22px)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "10px 12px",
          listStyle: "none",
          padding: 0,
        }}
      >
        {trustChips.map((chip) => (
          <li
            key={chip}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 14px",
              fontSize: 12.5,
              fontWeight: 500,
              letterSpacing: "0.02em",
              color: "var(--sb-charcoal)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 100%), " +
                "rgba(255, 252, 244, 0.6)",
              borderRadius: 999,
              boxShadow: "0 0 0 1px rgba(184, 153, 104, 0.22) inset",
            }}
          >
            <IconCheck size={12} color="var(--sb-gold)" />
            {chip}
          </li>
        ))}
      </ul>
    </div>
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
