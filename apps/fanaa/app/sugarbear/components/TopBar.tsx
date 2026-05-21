import Link from "next/link";
import { brand, navCopy } from "../copy";
import { IconArrow } from "./Icons";

/**
 * Top navbar — pure navigation, *non-sticky by design*.
 *
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │  [← الرئيسية]                              Sugarbear · فيتامينات  │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * Behaviour:
 *   • Lives at the very top of the document, ABOVE the hero.
 *   • Scrolls away with the page — no `position: sticky`. This is a
 *     deliberate luxury-editorial choice (Aesop, Vogue, Glossier
 *     campaigns): the home link is always one gesture (scroll-to-top)
 *     away, and the editorial imagery beneath is NEVER crossed by a
 *     translucent overlay. Cinematic composition stays cinematic.
 *   • To return home: scroll up. The mental model matches a glossy
 *     magazine cover — no UI chrome floats over the campaign.
 *
 * Server-renderable — no client JS needed now that scroll-tracking is
 * gone. Keeps the route boundary clean.
 */
export function SugarbearTopBar() {
  return (
    <header
      style={{
        background: "var(--sb-cream)",
        borderBottom: "1px solid rgba(184, 153, 104, 0.14)",
        // Non-sticky — let it scroll out of view with the rest of the
        // document so editorial poster sections stay clean.
        position: "relative",
        zIndex: 1,
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
            border: "1px solid rgba(184, 153, 104, 0.22)",
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
