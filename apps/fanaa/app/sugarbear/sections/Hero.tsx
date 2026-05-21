"use client";

import Image from "next/image";
import { Stars } from "../components/Stars";
import { IconCheck, IconBag } from "../components/Icons";
import { heroCopy, microcopy } from "../copy";
import { useSugarbear, type BundleId } from "../state";
import { useAddToCart } from "../useAddToCart";
import { Reveal } from "../components/Reveal";

/**
 * HERO — GCC luxury feminine beauty campaign.
 *
 * Reading flow:
 *   Mobile: [ image · top ] → [ headline · trust · offer · CTA ]
 *           Image leads as the visual anchor (Nama-Beauty pattern).
 *           The eye lands on the editorial photograph first, then sweeps
 *           down through emotional copy → offer → action.
 *   Desktop (RTL): [ image · right ] | [ headline → offer · left ]
 *           Image lives on the start-of-RTL side; eye lands on it first
 *           and sweeps left into the editorial column.
 *
 * Hierarchy (top → bottom of editorial column):
 *   eyebrow → HEADLINE → subheadline → TRUST PANEL → bundle → CTA
 *
 * The trust panel groups stars + review count + in-stock status + four
 * trust chips into a single visually cohesive surface so it never reads
 * as scattered text — colour-coded (gold accents, teal status) for clean
 * scanning.
 */
export function Hero() {
  const { bundle, setBundle, current, bundles } = useSugarbear();
  const addToCart = useAddToCart();

  return (
    <section
      id="sb-hero"
      className="relative overflow-hidden"
      style={{
        background:
          "radial-gradient(110% 60% at 80% 0%, rgba(212,184,148,0.20) 0%, transparent 65%), " +
          "radial-gradient(80% 80% at 0% 100%, rgba(111,175,165,0.10) 0%, transparent 60%), " +
          "linear-gradient(180deg, var(--sb-cream) 0%, #f4ecdb 100%)",
      }}
    >
      {/* Decorative top hairline */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          insetInline: 0,
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(184,153,104,0.45), transparent)",
        }}
      />

      <div className="mx-auto max-w-[1280px] px-6 md:px-10 pt-6 md:pt-12 lg:pt-16 pb-14 md:pb-20 lg:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-20 items-center">
          {/* ───────────────────────────────────────────────────────────
           * VISUAL · lifestyle photograph — FIRST on every breakpoint
           *   Mobile: order-1 → top of stack (image leads).
           *   Desktop (RTL): lg:order-1 → renders on the visual RIGHT
           *   (start of RTL flow), so the eye still lands here first.
           * ─────────────────────────────────────────────────────────── */}
          <Reveal as="div" className="lg:col-span-6 order-1 lg:order-1 relative">
            <div
              className="relative"
              style={{
                width: "100%",
                maxWidth: 540,
                // Logical-property auto-margins → perfectly centered on every
                // viewport, regardless of RTL/LTR direction. (94vw was wider
                // than the column's inner width on small phones, causing a
                // visual offset.)
                marginInline: "auto",
              }}
            >
              {/* Multi-layered ambient glow — candle-warm halo + cool kiss */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: "-14% -12%",
                  borderRadius: "40px",
                  background:
                    "radial-gradient(60% 55% at 50% 35%, rgba(232,204,151,0.48) 0%, rgba(232,204,151,0) 65%), " +
                    "radial-gradient(40% 50% at 85% 90%, rgba(111,175,165,0.20) 0%, rgba(111,175,165,0) 60%), " +
                    "radial-gradient(50% 60% at 15% 80%, rgba(184,153,104,0.18) 0%, rgba(184,153,104,0) 65%)",
                  filter: "blur(28px)",
                  pointerEvents: "none",
                }}
              />

              {/* Editorial photograph frame */}
              <div
                className="sb-float relative"
                style={{
                  position: "relative",
                  aspectRatio: "4 / 5",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow:
                    "0 50px 110px rgba(44,40,38,0.22), " +
                    "0 16px 40px rgba(184,153,104,0.20), " +
                    "0 0 0 1px rgba(184,153,104,0.30), " +
                    "0 0 0 1px rgba(255,252,244,0.55) inset",
                }}
              >
                <Image
                  src="/sugarbear/hero.png"
                  alt="طقس صباحي للجمال — Sugarbear على طاولة الزينة، كثافة ولمعان من أول نظرة"
                  fill
                  priority
                  sizes="(max-width: 1024px) calc(100vw - 48px), 540px"
                  style={{
                    objectFit: "cover",
                    objectPosition: "center 30%",
                  }}
                />
                {/* Whisper-soft edge vignette so the photo melts into the cream page */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg, rgba(250,246,238,0.06) 0%, transparent 22%, transparent 78%, rgba(250,246,238,0.20) 100%)",
                    pointerEvents: "none",
                  }}
                />
              </div>

              {/* Caption beneath the photograph — tight luxury image caption */}
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    height: 1,
                    width: 28,
                    background:
                      "linear-gradient(90deg, transparent, var(--sb-gold), transparent)",
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-sb-display), serif",
                    fontStyle: "italic",
                    fontSize: "clamp(13px, 1.3vw, 15px)",
                    color: "var(--sb-charcoal-soft)",
                    letterSpacing: "0.02em",
                    fontWeight: 500,
                  }}
                >
                  {heroCopy.imageCaption}
                </span>
                <span
                  aria-hidden
                  style={{
                    height: 1,
                    width: 28,
                    background:
                      "linear-gradient(90deg, transparent, var(--sb-gold), transparent)",
                  }}
                />
              </div>
            </div>
          </Reveal>

          {/* ───────────────────────────────────────────────────────────
           * EDITORIAL · headline → trust → offer → CTA
           *   Mobile: order-2 → renders BELOW the image.
           *   Desktop (RTL): lg:order-2 → renders on the visual LEFT.
           * ─────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-6 order-2 lg:order-2">
            <Reveal>
              <p className="sb-eyebrow">
                <span className="sb-rule" />
                <span style={{ margin: "0 12px" }}>{heroCopy.eyebrow}</span>
              </p>
            </Reveal>

            {/* HEADLINE — dominant but breathable */}
            <Reveal delay={1}>
              <h1
                style={{
                  fontFamily: "var(--font-sb-display), serif",
                  fontWeight: 700,
                  lineHeight: 1.1,
                  letterSpacing: "-0.01em",
                  fontSize: "clamp(32px, 4.2vw, 50px)",
                  color: "var(--sb-ink)",
                  marginTop: 16,
                  whiteSpace: "pre-line",
                  maxWidth: 580,
                }}
              >
                {heroCopy.headline}
              </h1>
            </Reveal>

            {/* SUBHEADLINE — readable, generous line-height, full charcoal */}
            <Reveal delay={2}>
              <p
                style={{
                  marginTop: 22,
                  maxWidth: 580,
                  fontSize: "clamp(16.5px, 1.35vw, 18.5px)",
                  lineHeight: 1.95,
                  color: "var(--sb-charcoal)",
                  fontWeight: 400,
                }}
              >
                {heroCopy.subheadline}
              </p>
            </Reveal>

            {/* ── TRUST PANEL — cohesive, colour-coded, easy scan ──── */}
            <Reveal delay={3}>
              <div
                style={{
                  marginTop: 30,
                  paddingTop: 24,
                  borderTop: "1px solid rgba(184,153,104,0.22)",
                }}
              >
                {/* Stars + rating + in-stock status */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 22,
                    flexWrap: "wrap",
                    marginBottom: 18,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        // Lustrous gold glow — gives the stars a polished,
                        // jewelry-like shine instead of reading as flat sand.
                        filter:
                          "drop-shadow(0 1px 1px rgba(212,165,55,0.45)) drop-shadow(0 0 6px rgba(232,184,87,0.30))",
                      }}
                    >
                      <Stars value={4.9} size={26} color="#d4a93c" />
                    </span>
                    <span
                      className="sb-num"
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: "var(--sb-ink)",
                        letterSpacing: "0.01em",
                        lineHeight: 1,
                      }}
                    >
                      4.9
                    </span>
                    <span
                      style={{
                        fontSize: 12.5,
                        color: "var(--sb-charcoal-soft)",
                        fontWeight: 500,
                        lineHeight: 1,
                      }}
                    >
                      ({heroCopy.rating.count.toLocaleString("ar-SA")} {microcopy.reviewLabel})
                    </span>
                  </span>

                  {/* Live in-stock pill — teal accent */}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 9,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--sb-teal-deep)",
                      padding: "7px 14px",
                      background: "rgba(111,175,165,0.10)",
                      border: "1px solid rgba(111,175,165,0.28)",
                      borderRadius: 999,
                      letterSpacing: "0.02em",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        background: "var(--sb-teal-deep)",
                        borderRadius: 999,
                        display: "inline-block",
                        boxShadow: "0 0 0 3px rgba(111,175,165,0.22)",
                      }}
                    />
                    {microcopy.inStock}
                  </span>
                </div>

                {/* Trust chips — warm cream pills, gold hairline + check */}
                <ul
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                  }}
                >
                  {heroCopy.trust.map((t) => (
                    <li
                      key={t}
                      className="sb-trust-pill"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--sb-charcoal)",
                        padding: "8px 14px",
                        background: "rgba(255,252,244,0.9)",
                        border: "1px solid rgba(184,153,104,0.28)",
                        borderRadius: 999,
                        letterSpacing: "0.01em",
                      }}
                    >
                      <IconCheck size={13} color="var(--sb-gold-deep)" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            {/* ── BUNDLE SELECTOR — clearer active/contrast ──────── */}
            <Reveal delay={4}>
              <div className="mt-10">
                {/* Section title + informational capsule clarifier ─────
                 *  We promote "اختاري المدة" from a tiny eyebrow to a real
                 *  section heading because the offer is the conversion
                 *  centrepiece. Below it, the capsule-count line gives the
                 *  buyer the unit clarity they need *before* they price-
                 *  shop the bundles. Editorial pairing — display serif on
                 *  top, soft body sans on bottom.
                 */}
                <div style={{ marginBottom: 18 }}>
                  <h2
                    style={{
                      fontFamily: "var(--font-sb-display), serif",
                      fontSize: "clamp(20px, 2.4vw, 26px)",
                      fontWeight: 600,
                      color: "var(--sb-ink)",
                      lineHeight: 1.2,
                      letterSpacing: "-0.005em",
                      margin: 0,
                    }}
                  >
                    اختاري المدة المناسبة لكِ
                  </h2>
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      color: "var(--sb-charcoal-soft)",
                      fontWeight: 400,
                      letterSpacing: "0.005em",
                      lineHeight: 1.5,
                    }}
                  >
                    تحتوي العبوة الواحدة على{" "}
                    <span
                      className="sb-num"
                      style={{ fontWeight: 600, color: "var(--sb-charcoal)" }}
                    >
                      ٣٠
                    </span>{" "}
                    كبسولة
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 md:gap-4">
                  {(Object.keys(bundles) as BundleId[]).map((id) => {
                    const b = bundles[id];
                    const checked = bundle === id;
                    return (
                      <label key={id} className="block relative">
                        <input
                          type="radio"
                          name="sb-bundle-hero"
                          value={id}
                          checked={checked}
                          onChange={() => setBundle(id)}
                          className="sb-bundle-input"
                        />
                        <div
                          className="sb-bundle-card relative"
                          style={{
                            border: checked
                              ? "1.5px solid var(--sb-gold)"
                              : "1px solid rgba(184,153,104,0.20)",
                            borderRadius: 16,
                            padding: "26px 12px 22px",
                            background: checked
                              ? "linear-gradient(180deg, #fffaef 0%, #f6e7c6 100%)"
                              : "rgba(255,252,244,0.55)",
                            textAlign: "center",
                            minHeight: 192,
                            boxShadow: checked
                              ? "0 22px 50px rgba(184,153,104,0.28), 0 0 0 4px rgba(184,153,104,0.10), 0 1px 0 rgba(255,255,255,0.6) inset"
                              : "0 1px 2px rgba(44,40,38,0.04)",
                            transform: checked ? "scale(1.04)" : "scale(1)",
                            transition:
                              "transform 320ms cubic-bezier(0.22,1,0.36,1), border-color 240ms ease, box-shadow 320ms ease, background 320ms ease",
                          }}
                        >
                          {b.highlight && (
                            <span
                              style={{
                                position: "absolute",
                                top: -16,
                                insetInline: 0,
                                margin: "0 auto",
                                width: "fit-content",
                                background: "var(--sb-charcoal)",
                                color: "var(--sb-gold-soft)",
                                fontSize: 10,
                                letterSpacing: "0.22em",
                                padding: "7px 16px",
                                borderRadius: 999,
                                fontWeight: 700,
                                boxShadow: "0 10px 22px rgba(44,40,38,0.22), 0 0 0 4px rgba(250,246,238,0.92)",
                              }}
                            >
                              {microcopy.bestValue.toUpperCase()}
                            </span>
                          )}
                          <div style={{ marginBottom: 14 }}>
                            <div
                              style={{
                                fontSize: 12,
                                color: checked
                                  ? "var(--sb-charcoal-soft)"
                                  : "var(--sb-stone)",
                                fontWeight: 600,
                                letterSpacing: "0.04em",
                                textTransform: "none",
                                lineHeight: 1.2,
                              }}
                            >
                              {b.pieces === 1
                                ? "علبة واحدة"
                                : b.pieces === 2
                                ? "علبتان"
                                : "ثلاث علب"}
                            </div>
                            {/* Duration subtitle — soft editorial clarity. */}
                            <div
                              style={{
                                marginTop: 3,
                                fontSize: 10.5,
                                color: "var(--sb-stone)",
                                fontWeight: 400,
                                letterSpacing: "0.02em",
                                lineHeight: 1.2,
                              }}
                            >
                              {b.pieces === 1
                                ? "لمدة شهر واحد"
                                : b.pieces === 2
                                ? "لمدة شهرين"
                                : "لمدة ٣ شهور"}
                            </div>
                          </div>
                          {/* Main price — visually dominant */}
                          <div
                            style={{
                              fontFamily: "var(--font-sb-display), serif",
                              fontSize: 36,
                              fontWeight: 700,
                              color: "var(--sb-ink)",
                              lineHeight: 1,
                              letterSpacing: "-0.01em",
                            }}
                          >
                            <span className="sb-num">{b.price}</span>
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
                          </div>
                          {/* Secondary per-bottle — softer, smaller */}
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--sb-stone)",
                              marginTop: 8,
                              fontWeight: 500,
                              letterSpacing: "0.01em",
                            }}
                          >
                            <span className="sb-num">{b.perBottle}</span> {microcopy.currency}{" "}
                            {microcopy.perBottle}
                          </div>
                          {/* Savings — subtle warm gold */}
                          {b.saving > 0 && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--sb-gold)",
                                marginTop: 12,
                                fontWeight: 600,
                                letterSpacing: "0.04em",
                              }}
                            >
                              {microcopy.save}{" "}
                              <span className="sb-num">{b.saving}</span> {microcopy.currency}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </Reveal>

            {/* ── CTA — single, prominent, full-width on mobile ───── */}
            <Reveal delay={4}>
              <div className="mt-8">
                <button
                  id="sb-hero-cta"
                  type="button"
                  onClick={() => addToCart()}
                  className="sb-cta flex items-center justify-center gap-3"
                  style={{
                    background: "var(--sb-charcoal)",
                    color: "var(--sb-cream)",
                    padding: "20px 32px",
                    borderRadius: 999,
                    fontSize: 15.5,
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    boxShadow:
                      "0 16px 40px rgba(44,40,38,0.22), 0 0 0 1px rgba(184,153,104,0.30)",
                    width: "100%",
                    maxWidth: 480,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <IconBag size={17} color="var(--sb-gold-soft)" />
                  {heroCopy.ctaPrimary}
                  <span
                    style={{
                      paddingInlineStart: 14,
                      borderInlineStart: "1px solid rgba(212,184,148,0.22)",
                      marginInlineStart: 6,
                      fontWeight: 500,
                    }}
                  >
                    <span className="sb-num">{current.price}</span> {microcopy.currency}
                  </span>
                </button>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
