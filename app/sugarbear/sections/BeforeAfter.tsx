import { beforeAfterCopy } from "../copy";
import { Reveal } from "../components/Reveal";
import { IconSparkle } from "../components/Icons";

export function BeforeAfter() {
  return (
    <section
      style={{
        background: "linear-gradient(180deg, var(--sb-cream) 0%, #f3ead8 100%)",
        paddingBlock: "clamp(72px, 9vw, 130px)",
      }}
    >
      <div className="mx-auto max-w-[1240px] px-6 md:px-10">
        <Reveal>
          <div className="text-center max-w-[640px] mx-auto">
            <p className="sb-eyebrow">
              <span className="sb-rule" />
              <span style={{ margin: "0 12px" }}>{beforeAfterCopy.eyebrow}</span>
              <span className="sb-rule" />
            </p>
            <h2
              style={{
                fontFamily: "var(--font-sb-display), serif",
                fontSize: "clamp(34px, 5vw, 64px)",
                lineHeight: 1.1,
                fontWeight: 600,
                color: "var(--sb-charcoal)",
                marginTop: 18,
                letterSpacing: "-0.01em",
                whiteSpace: "pre-line",
              }}
            >
              {beforeAfterCopy.headline}
            </h2>
            <p
              style={{
                marginTop: 22,
                fontSize: 16,
                lineHeight: 1.95,
                color: "var(--sb-charcoal-soft)",
              }}
            >
              {beforeAfterCopy.body}
            </p>
          </div>
        </Reveal>

        {/* Diptych */}
        <div className="mt-14 lg:mt-20 grid grid-cols-2 gap-3 md:gap-6 max-w-[1100px] mx-auto">
          <Reveal delay={1}>
            <DiptychPanel
              variant="before"
              label={beforeAfterCopy.beforeLabel}
              note={beforeAfterCopy.beforeNote}
            />
          </Reveal>
          <Reveal delay={3}>
            <DiptychPanel
              variant="after"
              label={beforeAfterCopy.afterLabel}
              note={beforeAfterCopy.afterNote}
            />
          </Reveal>
        </div>

        <Reveal delay={4}>
          <div className="mt-10 sb-dot-divider" style={{ color: "var(--sb-stone)" }}>
            <span />
            <span style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              {beforeAfterCopy.monthsLabel}
            </span>
            <span />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function DiptychPanel({
  variant,
  label,
  note,
}: {
  variant: "before" | "after";
  label: string;
  note: string;
}) {
  const isAfter = variant === "after";
  return (
    <figure
      style={{
        position: "relative",
        aspectRatio: "4 / 5",
        borderRadius: 4,
        overflow: "hidden",
        boxShadow: isAfter ? "var(--sb-shadow-lg)" : "var(--sb-shadow-md)",
      }}
    >
      {/* Photographic stand-in: rich gradient + abstract hair-strand SVG */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: isAfter
            ? "radial-gradient(120% 80% at 70% 30%, rgba(255,236,200,0.55) 0%, transparent 65%), linear-gradient(160deg, #f4e3c8 0%, #ddc196 100%)"
            : "radial-gradient(120% 80% at 70% 30%, rgba(220,210,196,0.5) 0%, transparent 65%), linear-gradient(160deg, #e9e3d5 0%, #b9b1a0 100%)",
        }}
      />
      <HairStrands variant={variant} />
      {/* Top label band */}
      <div
        style={{
          position: "absolute",
          top: 18,
          insetInline: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: isAfter ? "var(--sb-charcoal)" : "rgba(44,40,38,0.7)",
        }}
      >
        <span
          className="sb-eyebrow"
          style={{ background: "rgba(255,252,244,0.78)", padding: "6px 10px", borderRadius: 4 }}
        >
          {label}
        </span>
        {isAfter && <IconSparkle size={18} color="var(--sb-gold-deep)" />}
      </div>
      {/* Bottom note */}
      <figcaption
        style={{
          position: "absolute",
          bottom: 0,
          insetInline: 0,
          padding: "20px 22px",
          background: "linear-gradient(0deg, rgba(44,40,38,0.55) 0%, transparent 100%)",
          color: "#fbf5e8",
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: "0.02em",
        }}
      >
        {note}
      </figcaption>
    </figure>
  );
}

function HairStrands({ variant }: { variant: "before" | "after" }) {
  const isAfter = variant === "after";
  // Abstract flowing strands — denser & glossier on "after"
  const strandCount = isAfter ? 18 : 9;
  const baseColor = isAfter ? "#5c4d34" : "#6b6354";
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 250"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.92 }}
    >
      <defs>
        <linearGradient id={`strand-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={baseColor} stopOpacity={isAfter ? 0.95 : 0.7} />
          <stop offset="100%" stopColor={baseColor} stopOpacity={0.25} />
        </linearGradient>
        {isAfter && (
          <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="20%" stopColor="white" stopOpacity="0" />
            <stop offset="50%" stopColor="white" stopOpacity="0.55" />
            <stop offset="80%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        )}
      </defs>
      {Array.from({ length: strandCount }).map((_, i) => {
        const x = (i / (strandCount - 1)) * 200;
        const wave = isAfter ? 8 : 14;
        const variance = ((i % 3) - 1) * 8;
        return (
          <path
            key={i}
            d={`M ${x} 0 C ${x + wave + variance} 60, ${x - wave} 130, ${x + variance} 250`}
            stroke={`url(#strand-${variant})`}
            strokeWidth={isAfter ? 1.4 : 1.1}
            fill="none"
            strokeLinecap="round"
            opacity={isAfter ? 0.95 : 0.65}
          />
        );
      })}
      {isAfter && (
        <rect x="80" y="0" width="40" height="250" fill="url(#shine)" opacity="0.4" />
      )}
    </svg>
  );
}
