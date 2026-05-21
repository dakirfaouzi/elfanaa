import type { ComponentType } from "react";
import { trustCopy } from "../copy";
import { Reveal } from "../components/Reveal";
import {
  IconCash,
  IconTruck,
  IconLeaf,
  IconShield,
} from "../components/Icons";

/**
 * SECTION 8 — Trust / Reassurance
 *
 * A quiet luxury reassurance block that lands between Reviews and
 * Offers — emotional proof first, calm reassurance, then the
 * pricing decision. Reads as an editorial brand-promise page,
 * never as a coloured ecommerce trust strip.
 *
 * Composition:
 *   1. Centered intro              eyebrow + headline + body
 *   2. Four minimal cream cards    icon disc + title + 1-line body
 *   3. Italic micro-line           closing reassurance
 *
 * Layout:
 *   • Desktop  →  4-up row, generous whitespace
 *   • Mobile   →  2 × 2 grid, equal heights, soft spacing
 *
 * Icons are reused from Icons.tsx (line, single-stroke, never filled).
 */

interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

const ICON_MAP: Record<
  "cash" | "truck" | "leaf" | "shield",
  ComponentType<IconProps>
> = {
  cash: IconCash,
  truck: IconTruck,
  leaf: IconLeaf,
  shield: IconShield,
};

export function Trust() {
  return (
    <section
      id="sb-trust"
      style={{
        position: "relative",
        // Continuation of Section 7's warmer cream → settles back to
        // base cream so Section 9 (Offers) opens on a fresh, clean
        // surface for the pricing decision.
        background:
          "linear-gradient(180deg, #f4ead4 0%, var(--sb-cream) 100%)",
        paddingTop: "clamp(64px, 9vw, 120px)",
        paddingBottom: "clamp(64px, 9vw, 120px)",
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
              <span style={{ margin: "0 14px" }}>{trustCopy.eyebrow}</span>
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
              {trustCopy.headline}
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
                whiteSpace: "pre-line",
              }}
            >
              {trustCopy.body}
            </p>
          </div>
        </Reveal>

        {/* ── 2) Trust cards grid ─────────────────────────────────── *
         *  Mobile  →  grid-cols-2     (2 × 2)                         *
         *  Tablet+ →  md:grid-cols-4  (single row)                    *
         * ─────────────────────────────────────────────────────────── */}
        <div
          className="grid grid-cols-2 md:grid-cols-4"
          style={{
            marginTop: "clamp(40px, 5vw, 64px)",
            gap: "clamp(14px, 1.8vw, 22px)",
          }}
        >
          {trustCopy.cards.map((c, i) => {
            const Icon = ICON_MAP[c.icon];
            return (
              <Reveal key={c.title} delay={((i % 4) + 1) as 1 | 2 | 3 | 4}>
                <TrustCard Icon={Icon} title={c.title} body={c.body} />
              </Reveal>
            );
          })}
        </div>

        {/* ── 3) Closing italic micro-line ────────────────────────── */}
        <Reveal delay={2}>
          <p
            style={{
              marginTop: "clamp(36px, 4.4vw, 56px)",
              fontFamily: "var(--font-sb-display), serif",
              fontStyle: "italic",
              fontSize: "clamp(14.5px, 1.3vw, 16px)",
              lineHeight: 1.7,
              color: "rgba(74, 70, 66, 0.66)",
              fontWeight: 400,
              letterSpacing: "0.02em",
              textAlign: "center",
              maxWidth: 560,
              marginInline: "auto",
            }}
          >
            {trustCopy.microline}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 *  Single trust card — icon disc + title + one-line body.
 *
 *  Style direction:
 *    • cream-on-cream gradient body, 1px gold inset ring (no hard
 *      border, no heavy shadow)
 *    • 56px circular icon disc with a soft warm halo behind the icon
 *      glyph — the same vocabulary used in Benefits, so the visual
 *      grammar of the page stays consistent
 *    • equal height across the row (`height: 100%`) so the 2 × 2
 *      mobile grid never feels uneven when bodies wrap differently
 * ──────────────────────────────────────────────────────────────────── */
function TrustCard({
  Icon,
  title,
  body,
}: {
  Icon: ComponentType<IconProps>;
  title: string;
  body: string;
}) {
  return (
    <article
      style={{
        position: "relative",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, transparent 70%), " +
          "rgba(255, 252, 244, 0.78)",
        borderRadius: 18,
        padding: "clamp(22px, 2.6vw, 30px) clamp(18px, 2vw, 26px)",
        boxShadow:
          "0 0 0 1px rgba(184, 153, 104, 0.18) inset, " +
          "0 14px 40px rgba(44, 40, 38, 0.05), " +
          "0 4px 14px rgba(184, 153, 104, 0.08)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 16,
        textAlign: "start",
      }}
    >
      {/* Top hairline gold ornament — quiet editorial cue */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          insetInlineStart: "clamp(18px, 2vw, 26px)",
          width: 24,
          height: 1,
          background: "var(--sb-gold)",
          opacity: 0.5,
        }}
      />

      {/* Icon disc — soft warm halo + gold hairline */}
      <span
        aria-hidden
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 52,
          height: 52,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(232, 204, 151, 0.32) 0%, transparent 70%), " +
            "linear-gradient(180deg, #fffbef 0%, #f6e7c6 100%)",
          boxShadow:
            "0 0 0 1px rgba(184, 153, 104, 0.32) inset, " +
            "0 6px 18px rgba(184, 153, 104, 0.18)",
          color: "var(--sb-gold-deep)",
          flexShrink: 0,
        }}
      >
        <Icon size={24} color="var(--sb-gold-deep)" />
      </span>

      <h3
        style={{
          fontFamily: "var(--font-sb-display), serif",
          fontSize: "clamp(17px, 1.6vw, 21px)",
          fontWeight: 600,
          lineHeight: 1.3,
          color: "var(--sb-ink)",
          letterSpacing: "-0.005em",
          margin: 0,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: "clamp(13.5px, 1.15vw, 14.5px)",
          lineHeight: 1.85,
          color: "var(--sb-charcoal)",
          fontWeight: 400,
          margin: 0,
          opacity: 0.85,
        }}
      >
        {body}
      </p>
    </article>
  );
}
