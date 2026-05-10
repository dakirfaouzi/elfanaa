"use client";

import { offersCopy, microcopy } from "../copy";
import { useSugarbear, type BundleId } from "../state";
import { Reveal } from "../components/Reveal";
import { Bottle } from "../components/Bottle";
import { IconCrown, IconCheck, IconTruck, IconCash, IconShield } from "../components/Icons";

export function Offers() {
  const { bundle, setBundle } = useSugarbear();

  return (
    <section
      id="sb-offers"
      style={{
        background:
          "radial-gradient(80% 60% at 50% 0%, rgba(212,184,148,0.16) 0%, transparent 70%), " +
          "linear-gradient(180deg, #f4ecdb 0%, var(--sb-cream) 100%)",
        paddingBlock: "clamp(80px, 10vw, 140px)",
      }}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Reveal>
          <div className="text-center max-w-[680px] mx-auto">
            <p className="sb-eyebrow">
              <span className="sb-rule" />
              <span style={{ margin: "0 12px" }}>{offersCopy.eyebrow}</span>
              <span className="sb-rule" />
            </p>
            <h2
              style={{
                fontFamily: "var(--font-sb-display), serif",
                fontSize: "clamp(36px, 5.4vw, 70px)",
                lineHeight: 1.05,
                fontWeight: 600,
                color: "var(--sb-charcoal)",
                marginTop: 18,
                letterSpacing: "-0.01em",
                whiteSpace: "pre-line",
              }}
            >
              {offersCopy.headline}
            </h2>
            <p
              style={{
                marginTop: 22,
                fontSize: 16,
                lineHeight: 1.95,
                color: "var(--sb-charcoal-soft)",
              }}
            >
              {offersCopy.body}
            </p>
          </div>
        </Reveal>

        {/* Bundle cards */}
        <div className="mt-16 lg:mt-20 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-7 max-w-[1080px] mx-auto items-stretch">
          {offersCopy.bundles.map((b, i) => (
            <Reveal key={b.id} delay={((i % 3) + 1) as 1 | 2 | 3}>
              <BundleCard
                bundle={b}
                selected={bundle === b.id}
                onSelect={() => setBundle(b.id)}
              />
            </Reveal>
          ))}
        </div>

        {/* Reassurance row beneath bundles */}
        <Reveal delay={3}>
          <div
            className="mt-14 flex flex-wrap items-center justify-center"
            style={{ gap: "20px 40px", color: "var(--sb-charcoal-soft)" }}
          >
            <Reassurance
              icon={<IconTruck size={16} color="var(--sb-gold)" />}
              text="توصيل ٢٤ ساعة لدول الخليج"
            />
            <Reassurance
              icon={<IconCash size={16} color="var(--sb-gold)" />}
              text="الدفع عند الاستلام"
            />
            <Reassurance
              icon={<IconShield size={16} color="var(--sb-gold)" />}
              text="إرجاع مجاني خلال ١٤ يوم"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Reassurance({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13.5,
        fontWeight: 500,
      }}
    >
      {icon}
      {text}
    </span>
  );
}

function BundleCard({
  bundle,
  selected,
  onSelect,
}: {
  bundle: (typeof offersCopy.bundles)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const isHighlight = bundle.highlight;

  return (
    <label
      style={{
        position: "relative",
        cursor: "pointer",
        display: "block",
      }}
    >
      <input
        type="radio"
        name="sb-bundle-offers"
        checked={selected}
        onChange={onSelect}
        className="sb-bundle-input"
      />

      <div
        className="sb-bundle-card"
        style={{
          position: "relative",
          background: isHighlight
            ? "linear-gradient(180deg, #fff8e7 0%, #fbeed1 100%)"
            : "rgba(255,252,244,0.92)",
          border: selected
            ? "1.5px solid var(--sb-gold)"
            : isHighlight
            ? "1.5px solid rgba(184,153,104,0.35)"
            : "1px solid rgba(184,153,104,0.18)",
          borderRadius: 8,
          padding: "44px 26px 30px",
          minHeight: isHighlight ? 480 : 440,
          boxShadow: isHighlight
            ? "var(--sb-shadow-gold)"
            : "var(--sb-shadow-sm)",
          textAlign: "center",
          height: "100%",
          transform: isHighlight ? "scale(1.02)" : "none",
        }}
      >
        {/* Best Value crown badge */}
        {isHighlight && (
          <div
            style={{
              position: "absolute",
              top: -16,
              insetInline: 0,
              margin: "0 auto",
              width: "fit-content",
              background: "var(--sb-charcoal)",
              color: "var(--sb-gold-soft)",
              fontSize: 10.5,
              letterSpacing: "0.22em",
              padding: "9px 18px",
              borderRadius: 999,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 8px 22px rgba(184,153,104,0.30)",
            }}
          >
            <IconCrown size={14} color="var(--sb-gold)" />
            {microcopy.bestValue.toUpperCase()}
          </div>
        )}

        {/* Bottle visualization */}
        <div
          style={{
            width: "100%",
            height: 180,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Bottle
            size={isHighlight ? 200 : 160}
            count={bundle.pieces as 1 | 2 | 3}
            shadow
          />
        </div>

        {/* Headline */}
        <h3
          style={{
            fontFamily: "var(--font-sb-display), serif",
            fontSize: 24,
            fontWeight: 600,
            color: "var(--sb-charcoal)",
            lineHeight: 1.2,
          }}
        >
          {bundle.headline}
        </h3>
        <p
          style={{
            marginTop: 4,
            fontFamily: "var(--font-sb-latin), serif",
            fontStyle: "italic",
            fontSize: 14,
            color: "var(--sb-stone)",
          }}
        >
          {bundle.sub}
        </p>

        {/* Price */}
        <div style={{ marginTop: 22 }}>
          <div
            style={{
              fontFamily: "var(--font-sb-display), serif",
              fontSize: 48,
              fontWeight: 600,
              color: "var(--sb-charcoal)",
              lineHeight: 1,
            }}
          >
            <span className="sb-num">{bundle.price}</span>
            <span
              style={{
                fontSize: 16,
                color: "var(--sb-stone)",
                marginInlineStart: 8,
                fontFamily: "var(--font-sb-body)",
                fontWeight: 500,
              }}
            >
              {microcopy.currency}
            </span>
          </div>
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              color: "var(--sb-charcoal-soft)",
              fontWeight: 500,
            }}
          >
            {bundle.perBottleNote}
          </p>
          {bundle.tag && (
            <div
              style={{
                marginTop: 12,
                display: "inline-flex",
                background: isHighlight
                  ? "var(--sb-charcoal)"
                  : "rgba(184,153,104,0.12)",
                color: isHighlight ? "var(--sb-gold-soft)" : "var(--sb-gold-deep)",
                padding: "6px 14px",
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "0.12em",
                borderRadius: 999,
                textTransform: "uppercase",
              }}
            >
              {bundle.tag}
            </div>
          )}
        </div>

        {/* Bullet feature list */}
        <ul
          style={{
            marginTop: 22,
            paddingTop: 22,
            borderTop: "1px solid rgba(184,153,104,0.20)",
            textAlign: "start",
            display: "flex",
            flexDirection: "column",
            gap: 9,
            color: "var(--sb-charcoal-soft)",
            fontSize: 13.5,
          }}
        >
          <Feature>توصيل خلال ٢٤ ساعة</Feature>
          <Feature>الدفع عند الاستلام</Feature>
          {bundle.pieces >= 2 && <Feature>شحن مجاني</Feature>}
          {bundle.pieces >= 3 && <Feature>أسبقية في الشحن</Feature>}
        </ul>

        {/* CTA pill */}
        <div
          aria-hidden
          style={{
            marginTop: 22,
            background: selected
              ? "var(--sb-charcoal)"
              : "transparent",
            color: selected ? "var(--sb-cream)" : "var(--sb-charcoal)",
            border: selected
              ? "1.5px solid var(--sb-charcoal)"
              : "1.5px solid var(--sb-charcoal)",
            padding: "13px 22px",
            borderRadius: 999,
            fontSize: 13.5,
            fontWeight: 600,
            letterSpacing: "0.04em",
            transition: "all 240ms ease",
          }}
        >
          {selected ? microcopy.selected : microcopy.selectThis}
        </div>
      </div>
    </label>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <IconCheck size={14} color="var(--sb-gold)" />
      <span>{children}</span>
    </li>
  );
}
