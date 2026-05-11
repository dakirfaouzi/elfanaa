"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useSugarbear } from "../state";
import { microcopy, heroCopy, offersCopy, stickyCtaCopy } from "../copy";
import { IconBag } from "../components/Icons";
import { useAddToCart } from "../useAddToCart";

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

  const addToCart = useAddToCart();

  if (!visible) return null;

  // Resolve the rich subtitle ("للتحوّل الحقيقي" etc) for the active bundle.
  const offerMeta = offersCopy.bundles.find((b) => b.id === current.id);

  return (
    <>
      <MobileSticky current={current} onAddToCart={addToCart} />
      <DesktopSticky current={current} offerMeta={offerMeta} onAddToCart={addToCart} />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 *  Mobile — floating glassmorphism pill (mirrors desktop premium feel)   *
 *                                                                        *
 *  Three zones (RTL):                                                    *
 *    RIGHT (start) → bottle thumb + bundle title + savings caption       *
 *    CENTER         → live bundle price                                  *
 *    LEFT  (end)   → premium CTA pill                                    *
 *                                                                        *
 *  Why a floating pill, not edge-to-edge bar:                            *
 *    The previous bar read as a generic ecommerce strip. A floating      *
 *    pill with cream-gradient glass + warm gold hairline reads as a      *
 *    luxury beauty *purchase ribbon* — same DNA as the desktop sticky.   *
 * ────────────────────────────────────────────────────────────────────── */
function MobileSticky({
  current,
  onAddToCart,
}: {
  current: ReturnType<typeof useSugarbear>["current"];
  onAddToCart: () => void;
}) {
  // Pull the rich subtitle ("للتحوّل الحقيقي" etc) from the offers section so
  // the mobile sticky stays in lock-step with the active bundle.
  const offerMeta = offersCopy.bundles.find((b) => b.id === current.id);

  return (
    <div
      className="sb-sticky lg:hidden"
      role="region"
      aria-label="إضافة إلى الحقيبة"
      style={{
        position: "fixed",
        // Floating distance — sits a hair off the bottom edge so it reads
        // as a deliberate ribbon, never glued to the device chrome.
        bottom: "max(10px, env(safe-area-inset-bottom))",
        insetInline: 12,
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          marginInline: "auto",
          // Two stacked layers — the warm glass body and the inset cream
          // highlight on top, identical recipe to the desktop sticky.
          background:
            "linear-gradient(180deg, rgba(255, 252, 244, 0.94) 0%, rgba(244, 236, 219, 0.92) 100%)",
          backdropFilter: "blur(18px) saturate(160%)",
          WebkitBackdropFilter: "blur(18px) saturate(160%)",
          border: "1px solid rgba(184, 153, 104, 0.32)",
          borderRadius: 22,
          padding: "10px 12px",
          // Lift + warm gold halo + crisp inset highlight.
          boxShadow:
            "0 24px 56px rgba(44, 40, 38, 0.20), " +
            "0 6px 16px rgba(184, 153, 104, 0.14), " +
            "inset 0 1px 0 rgba(255, 255, 255, 0.65)",
          pointerEvents: "auto",
          // 3-zone grid: thumb+text | price | CTA. The CTA gets a
          // generous min so the brand voice still reads on small screens.
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* ── RIGHT (RTL start) — thumb + title + savings ───────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          {/* Bottle thumbnail — cream halo + gentle drop-shadow so the
              product pops out of the glass body like a small still-life. */}
          <div
            style={{
              position: "relative",
              width: 52,
              height: 44,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: -2,
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: -6,
                background:
                  "radial-gradient(60% 55% at 50% 55%, rgba(232, 204, 151, 0.45) 0%, rgba(232, 204, 151, 0) 70%)",
                pointerEvents: "none",
              }}
            />
            <Image
              src="/sugarbear/bottle-trio.png"
              alt=""
              width={104}
              height={88}
              sizes="52px"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                filter: "drop-shadow(0 6px 10px rgba(44, 40, 38, 0.18))",
                position: "relative",
              }}
            />
          </div>

          {/* Bundle title + savings (stacked, both small, editorial). */}
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontFamily: "var(--font-sb-display), serif",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--sb-charcoal)",
                lineHeight: 1.15,
                letterSpacing: "-0.005em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {offerMeta?.headline ?? heroCopy.unitsLabel[current.pieces]}
            </p>
            {current.saving > 0 && (
              <p
                style={{
                  marginTop: 2,
                  fontSize: 10.5,
                  color: "var(--sb-gold-deep)",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  lineHeight: 1.15,
                }}
              >
                {stickyCtaCopy.savingPrefix}{" "}
                <span className="sb-num">{current.saving}</span>{" "}
                {microcopy.currency}
              </p>
            )}
          </div>
        </div>

        {/* ── CENTER — live bundle price ────────────────────────── */}
        <div style={{ textAlign: "center", minWidth: 0 }}>
          <p
            style={{
              fontFamily: "var(--font-sb-display), serif",
              fontSize: 22,
              fontWeight: 700,
              color: "var(--sb-ink)",
              lineHeight: 1,
              letterSpacing: "-0.01em",
            }}
          >
            <span className="sb-num">{current.price}</span>
          </p>
          <p
            style={{
              marginTop: 3,
              fontSize: 10,
              color: "var(--sb-stone)",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {microcopy.currency}
          </p>
        </div>

        {/* ── LEFT (RTL end) — premium CTA pill ─────────────────── */}
        <button
          type="button"
          onClick={onAddToCart}
          className="sb-cta"
          style={{
            background: "var(--sb-charcoal)",
            color: "var(--sb-cream)",
            padding: "12px 16px",
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 600,
            letterSpacing: "0.005em",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            whiteSpace: "nowrap",
            boxShadow:
              "0 14px 32px rgba(44, 40, 38, 0.22), 0 0 0 1px rgba(184, 153, 104, 0.18) inset",
            border: "none",
            cursor: "pointer",
          }}
        >
          <IconBag size={14} color="var(--sb-gold-soft)" />
          {stickyCtaCopy.ctaMobile}
        </button>
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
  onAddToCart,
}: {
  current: ReturnType<typeof useSugarbear>["current"];
  offerMeta: (typeof offersCopy.bundles)[number] | undefined;
  onAddToCart: () => void;
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
          <button
            type="button"
            onClick={onAddToCart}
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
              border: "none",
              cursor: "pointer",
            }}
          >
            <IconBag size={16} color="var(--sb-gold-soft)" />
            {stickyCtaCopy.ctaDesktop}
          </button>
        </div>
      </div>
    </div>
  );
}
