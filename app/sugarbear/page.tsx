import Link from "next/link";
import { Hero } from "./sections/Hero";
import { Transformation } from "./sections/Transformation";
import { BeforeAfter } from "./sections/BeforeAfter";
import { Benefits } from "./sections/Benefits";
import { Ingredients } from "./sections/Ingredients";
import { Ritual } from "./sections/Ritual";
import { Reviews } from "./sections/Reviews";
import { Offers } from "./sections/Offers";
import { FAQ } from "./sections/FAQ";
import { FinalCTA } from "./sections/FinalCTA";
import { StickyCTA } from "./sections/StickyCTA";
import { brand, navCopy } from "./copy";
import { IconArrow } from "./components/Icons";

export default function SugarbearPage() {
  return (
    <>
      <SugarbearTopBar />
      <Hero />
      <Transformation />
      <BeforeAfter />
      <Benefits />
      <Ingredients />
      <Ritual />
      <Reviews />
      <Offers />
      <FAQ />
      <FinalCTA />
      <StickyCTA />
    </>
  );
}

/**
 * Sticky top navbar — pure navigation, no brand block.
 *
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │  [← الرئيسية]                              Sugarbear · فيتامينات  │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * The centered "فناء" wordmark has been removed. Brand identity lives in
 * the footer; here the bar is purely a way back home and a quiet product
 * identifier — nothing that reads as a brand card overlapping the hero
 * editorial flow.
 */
function SugarbearTopBar() {
  return (
    <header
      style={{
        background: "rgba(250, 246, 238, 0.78)",
        borderBottom: "1px solid rgba(184,153,104,0.14)",
        position: "sticky",
        top: 0,
        zIndex: 40,
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
      }}
    >
      <div
        className="mx-auto max-w-[1240px] px-5 md:px-10"
        style={{
          paddingBlock: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          minHeight: 48,
        }}
      >
        {/* ── Home pill ──────────────────────────────────────────────── */}
        <Link
          href="/"
          aria-label={navCopy.homeAria}
          className="sb-cta"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12.5,
            color: "var(--sb-charcoal-soft)",
            fontWeight: 500,
            letterSpacing: "0.04em",
            padding: "6px 13px",
            border: "1px solid rgba(184,153,104,0.22)",
            borderRadius: 999,
            background: "rgba(255, 252, 244, 0.6)",
            textDecoration: "none",
            transition: "all 240ms ease",
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              transform: "rotate(180deg)",
              color: "var(--sb-gold-deep)",
            }}
          >
            <IconArrow size={13} />
          </span>
          {navCopy.home}
        </Link>

        {/* ── Quiet product identifier (hidden on small screens) ────── */}
        <div
          className="hidden md:flex"
          style={{
            alignItems: "center",
            gap: 9,
            color: "var(--sb-stone)",
          }}
        >
          <span
            aria-hidden
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
              fontFamily: "var(--font-sb-latin), 'Cormorant Garamond', serif",
              fontStyle: "italic",
              fontSize: 12.5,
              letterSpacing: "0.04em",
              color: "var(--sb-charcoal-soft)",
            }}
          >
            Sugarbear · {brand.productLineAr}
          </span>
        </div>
      </div>
    </header>
  );
}
