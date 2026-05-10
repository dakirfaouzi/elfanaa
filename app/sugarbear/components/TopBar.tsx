"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { brand, navCopy } from "../copy";
import { IconArrow } from "./Icons";

/**
 * Sticky top navbar — pure navigation, *smart-hide on scroll*.
 *
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │  [← الرئيسية]                              Sugarbear · فيتامينات  │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * Behaviour:
 *   • Visible at the very top of the page (so the home link is in reach).
 *   • Slides up out of view as soon as the user starts scrolling down past
 *     the hero (≈ 120 px) — keeps editorial poster sections like the
 *     Transformation moment completely free of any translucent overlay.
 *   • Slides back in the moment the user scrolls *up* (Apple/Vogue
 *     pattern), so the home pill is always one gesture away when needed.
 *
 * Why client component:
 *   The bar needs `useEffect` to track scroll direction; promoting only
 *   this small surface (vs the whole `page.tsx`) keeps the rest of the
 *   landing page server-rendered and zero-JS by default.
 */
export function SugarbearTopBar() {
  // `hidden=true` slides the bar out of view; `pinned=true` is the
  // top-of-page case where we always show it regardless of scroll dir.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let lastY = window.scrollY;
    let raf = 0;

    const evaluate = () => {
      raf = 0;
      const y = window.scrollY;
      const dy = y - lastY;

      // Always show within the first 120 px so the home link is reachable
      // at the very top of the page (the editorial flow only really starts
      // once the hero is partially scrolled).
      if (y < 120) {
        setHidden(false);
      } else if (dy > 6) {
        // Scrolling down with intent → hide.
        setHidden(true);
      } else if (dy < -6) {
        // Scrolling up with intent → reveal.
        setHidden(false);
      }

      lastY = y;
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(evaluate);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header
      style={{
        background: "rgba(250, 246, 238, 0.78)",
        borderBottom: "1px solid rgba(184, 153, 104, 0.14)",
        position: "sticky",
        top: 0,
        zIndex: 40,
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        // Smart-hide animation — cubic ease-out feels expensive, never
        // bouncy. Translate uses logical-property friendly Y axis so RTL
        // is unaffected.
        transform: hidden ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 360ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "transform",
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
