"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useSugarbear } from "../state";
import { microcopy, heroCopy, offersCopy, stickyCtaCopy } from "../copy";
import { IconBag } from "../components/Icons";

/**
 * Floating add-to-cart — coordinated mobile + desktop conversion system.
 *
 *   • Mobile (`lg:hidden`):    edge-to-edge frosted bar at the bottom.
 *   • Desktop (`hidden lg:`):  centered floating glass pill with bottle
 *                              thumb, live pricing, bundle subtitle, CTA.
 *
 * Visibility logic — scroll-based for resilience:
 *   - Read the in-flow hero CTA's bounding rect on every scroll/resize.
 *   - Show the sticky whenever the in-flow CTA is outside the viewport
 *     (above OR below). Hide whenever the in-flow CTA is visible — we never
 *     want two CTAs competing in the same frame.
 *   - Defer the very first reveal until the user has scrolled at least one
 *     viewport of meaningful distance, so there is no flash on initial load.
 *
 * Why not IntersectionObserver alone:
 *   IO can be quirky on some Android browsers (especially when combined with
 *   `position: fixed` in the same document and tall mobile heroes). A plain
 *   scroll listener using getBoundingClientRect is universally reliable on
 *   iOS, Android, small mobile screens, and desktop, and is cheap (passive
 *   scroll listener + no per-frame layout reads beyond a single rect).
 */
export function StickyCTA() {
  const { current } = useSugarbear();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let raf = 0;

    const evaluate = () => {
      raf = 0;
      const target =
        document.getElementById("sb-hero-cta") ??
        document.getElementById("sb-hero");

      // Fallback: no anchor yet → reveal once user has scrolled meaningfully.
      if (!target) {
        setVisible(window.scrollY > 240);
        return;
      }

      const rect = target.getBoundingClientRect();
      const viewportH =
        window.innerHeight || document.documentElement.clientHeight;

      // The in-flow CTA is visible if any part of it sits inside the viewport.
      const ctaInView = rect.top < viewportH && rect.bottom > 0;

      if (ctaInView) {
        setVisible(false);
        return;
      }

      // CTA is above viewport (scrolled past) → always reveal.
      if (rect.bottom <= 0) {
        setVisible(true);
        return;
      }

      // CTA is below viewport (not yet reached). On mobile the in-flow CTA
      // sits well below the fold, so we still want the sticky visible — but
      // only after the user has scrolled at least a portion of the page so
      // there is no "flash on load".
      setVisible(window.scrollY > 240);
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(evaluate);
    };

    evaluate();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  if (!visible) return null;

  // Resolve the rich subtitle ("للتحوّل الحقيقي" etc) for the active bundle.
  const offerMeta = offersCopy.bundles.find((b) => b.id === current.id);

  return (
    <>
      <MobileSticky current={current} />
      <DesktopSticky current={current} offerMeta={offerMeta} />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 *  Mobile — edge-to-edge frosted bar                                     *
 * ────────────────────────────────────────────────────────────────────── */
function MobileSticky({
  current,
}: {
  current: ReturnType<typeof useSugarbear>["current"];
}) {
  return (
    <div
      className="sb-sticky lg:hidden"
      role="region"
      aria-label="إضافة إلى الحقيبة"
      style={{
        position: "fixed",
        bottom: 0,
        insetInline: 0,
        zIndex: 60,
        background: "rgba(250, 246, 238, 0.92)",
        backdropFilter: "blur(18px) saturate(160%)",
        WebkitBackdropFilter: "blur(18px) saturate(160%)",
        borderTop: "1px solid rgba(184,153,104,0.28)",
        boxShadow: "0 -8px 32px rgba(44,40,38,0.10)",
        paddingTop: 12,
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        paddingInline: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          maxWidth: 600,
          marginInline: "auto",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 11,
              color: "var(--sb-stone)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {heroCopy.unitsLabel[current.pieces]}
          </p>
          <p
            style={{
              fontFamily: "var(--font-sb-display), serif",
              fontSize: 24,
              fontWeight: 600,
              color: "var(--sb-charcoal)",
              lineHeight: 1.1,
              marginTop: 2,
            }}
          >
            <span className="sb-num">{current.price}</span>
            <span
              style={{
                fontSize: 13,
                color: "var(--sb-stone)",
                marginInlineStart: 6,
                fontFamily: "var(--font-sb-body)",
                fontWeight: 500,
              }}
            >
              {microcopy.currency}
            </span>
          </p>
        </div>
        <a
          href="#sb-offers"
          className="sb-cta"
          style={{
            background: "var(--sb-charcoal)",
            color: "var(--sb-cream)",
            padding: "14px 22px",
            borderRadius: 999,
            fontSize: 13.5,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            whiteSpace: "nowrap",
            boxShadow: "var(--sb-shadow-md)",
          }}
        >
          <IconBag size={16} color="var(--sb-gold-soft)" />
          {stickyCtaCopy.ctaMobile}
        </a>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 *  Desktop — centered floating pill, glassmorphism + soft gold border     *
 * ────────────────────────────────────────────────────────────────────── */
function DesktopSticky({
  current,
  offerMeta,
}: {
  current: ReturnType<typeof useSugarbear>["current"];
  offerMeta: typeof offersCopy.bundles[number] | undefined;
}) {
  return (
    <div
      className="sb-sticky hidden lg:block"
      role="region"
      aria-label="ابدئي طقس جمالكِ"
      style={{
        position: "fixed",
        bottom: 24,
        insetInline: 0,
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 780,
          marginInline: "auto",
          paddingInline: 24,
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: 18,
            background:
              "linear-gradient(180deg, rgba(255, 252, 244, 0.88) 0%, rgba(244, 236, 219, 0.86) 100%)",
            backdropFilter: "blur(28px) saturate(160%)",
            WebkitBackdropFilter: "blur(28px) saturate(160%)",
            border: "1px solid rgba(184,153,104,0.36)",
            borderRadius: 999,
            padding: "10px 12px 10px 22px",
            boxShadow:
              "0 24px 64px rgba(44,40,38,0.16), " +
              "0 4px 14px rgba(184,153,104,0.10), " +
              "inset 0 1px 0 rgba(255,255,255,0.55)",
          }}
        >
          {/* ── Product photo in a soft halo ─────────────────────────
           * The cleaned-out PNG (background flood-filled to alpha=0)
           * sits inside a warm radial halo. We let the bottles "pop"
           * a little above the pill rim by giving the visual column
           * extra height than its container — luxury editorial touch
           * without breaking the pill geometry. */}
          <div
            style={{
              width: 78,
              height: 64,
              borderRadius: 14,
              background:
                "radial-gradient(closest-side, rgba(212,184,148,0.40) 0%, rgba(212,184,148,0) 70%)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              flexShrink: 0,
              position: "relative",
              overflow: "visible",
            }}
          >
            <Image
              src="/sugarbear/bottle-trio.png"
              alt=""
              width={156}
              height={213}
              priority={false}
              sizes="78px"
              style={{
                width: 78,
                height: "auto",
                marginBottom: -4,
                filter: "drop-shadow(0 6px 12px rgba(44,40,38,0.20))",
                pointerEvents: "none",
                userSelect: "none",
              }}
            />
          </div>

          {/* ── Live bundle label + price + savings ─────────────────── */}
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: 10.5,
                color: "var(--sb-gold-deep)",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              {stickyCtaCopy.eyebrowDesktop}
            </p>
            <p
              style={{
                marginTop: 2,
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                flexWrap: "wrap",
                lineHeight: 1.2,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-sb-display), serif",
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--sb-charcoal)",
                }}
              >
                {heroCopy.unitsLabel[current.pieces]}
              </span>
              {offerMeta?.sub && (
                <span
                  style={{
                    fontFamily: "var(--font-sb-latin), serif",
                    fontStyle: "italic",
                    fontSize: 13,
                    color: "var(--sb-stone)",
                  }}
                >
                  · {offerMeta.sub}
                </span>
              )}
              <span style={{ flex: 1 }} />
              <span
                style={{
                  fontFamily: "var(--font-sb-display), serif",
                  fontSize: 22,
                  fontWeight: 600,
                  color: "var(--sb-charcoal)",
                  whiteSpace: "nowrap",
                }}
              >
                <span className="sb-num">{current.price}</span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--sb-stone)",
                    marginInlineStart: 6,
                    fontFamily: "var(--font-sb-body)",
                    fontWeight: 500,
                  }}
                >
                  {microcopy.currency}
                </span>
              </span>
            </p>
            {current.saving > 0 && (
              <p
                style={{
                  fontSize: 11.5,
                  color: "var(--sb-gold-deep)",
                  fontWeight: 600,
                  marginTop: 3,
                  letterSpacing: "0.04em",
                }}
              >
                {stickyCtaCopy.savingPrefix}{" "}
                <span className="sb-num">{current.saving}</span>{" "}
                {microcopy.currency}
              </p>
            )}
          </div>

          {/* ── CTA pill ────────────────────────────────────────────── */}
          <a
            href="#sb-offers"
            className="sb-cta"
            style={{
              background: "var(--sb-charcoal)",
              color: "var(--sb-cream)",
              padding: "16px 26px",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              whiteSpace: "nowrap",
              boxShadow:
                "0 12px 28px rgba(44,40,38,0.22), 0 0 0 1px rgba(184,153,104,0.30)",
              flexShrink: 0,
            }}
          >
            <IconBag size={16} color="var(--sb-gold-soft)" />
            {stickyCtaCopy.ctaDesktop}
          </a>
        </div>
      </div>
    </div>
  );
}
