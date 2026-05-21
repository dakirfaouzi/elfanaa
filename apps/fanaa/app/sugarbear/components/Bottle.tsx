/**
 * Sugarbear product bottle — pure SVG, scales beautifully.
 * Cream body · turquoise label band · soft gold cap · gold wordmark.
 * No external assets, no network deps.
 */

import { useId } from "react";

interface BottleProps {
  /** Pixel max-width (when number) or any CSS size string. */
  size?: number | string;
  className?: string;
  ariaLabel?: string;
  shadow?: boolean;
  /** Show 1, 2 or 3 bottles arranged in a luxury still-life. */
  count?: 1 | 2 | 3;
}

export function Bottle({
  size = 320,
  className,
  ariaLabel = "علبة Sugarbear",
  shadow = true,
  count = 1,
}: BottleProps) {
  if (count === 1) {
    return <SingleBottle size={size} className={className} ariaLabel={ariaLabel} shadow={shadow} />;
  }
  return (
    <div
      className={className}
      style={{
        display: "block",
        position: "relative",
        width: "100%",
        maxWidth: size,
        margin: "0 auto",
        aspectRatio: "1 / 1.15",
      }}
    >
      <BottleGroup count={count} ariaLabel={ariaLabel} shadow={shadow} />
    </div>
  );
}

function BottleGroup({
  count,
  ariaLabel,
  shadow,
}: Required<Pick<BottleProps, "ariaLabel" | "shadow">> & { count: 2 | 3 }) {
  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      aria-label={ariaLabel}
    >
      {Array.from({ length: count }).map((_, i) => {
        const center = (count - 1) / 2;
        // Offsets in % of container so it scales with container width
        const dxPct = (i - center) * 18;
        const dyPct = Math.abs(i - center) * 3;
        const z = count - Math.abs(i - center);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              transform: `translateX(calc(-50% + ${dxPct}%)) translateY(${dyPct}%)`,
              width: "78%",
              zIndex: z,
            }}
          >
            <SingleBottle size="100%" ariaLabel={ariaLabel} shadow={shadow} />
          </div>
        );
      })}
    </div>
  );
}

function SingleBottle({
  size,
  className,
  ariaLabel,
  shadow,
}: { size: number | string; className?: string; ariaLabel: string; shadow: boolean }) {
  // useId() is stable across server/client and unique per instance — needed
  // because each rendered <defs> block defines gradients of the same shape,
  // and shared ids would collide in the DOM (and silently merge).
  const reactId = useId();
  const filterId = `sb-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const widthAttr = typeof size === "number" ? size : "100%";
  const heightAttr = typeof size === "number" ? size * 1.2 : undefined;
  const wrapStyle: React.CSSProperties = {
    width: typeof size === "number" ? size : "100%",
    maxWidth: typeof size === "number" ? size : undefined,
    aspectRatio: "200 / 240",
    display: "block",
    margin: "0 auto",
    filter: shadow
      ? "drop-shadow(0 18px 28px rgba(44,40,38,0.18)) drop-shadow(0 4px 8px rgba(44,40,38,0.10))"
      : undefined,
  };
  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox="0 0 200 240"
      preserveAspectRatio="xMidYMid meet"
      width={widthAttr}
      height={heightAttr}
      className={className}
      style={wrapStyle}
    >
      <defs>
        {/* Bottle body — cream with subtle warm gradient */}
        <linearGradient id={`${filterId}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fdf9f1" />
          <stop offset="55%" stopColor="#f6ecd9" />
          <stop offset="100%" stopColor="#ead7b6" />
        </linearGradient>
        {/* Cap — soft gold gradient */}
        <linearGradient id={`${filterId}-cap`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8cc97" />
          <stop offset="50%" stopColor="#c2a06b" />
          <stop offset="100%" stopColor="#8e7548" />
        </linearGradient>
        {/* Label band — subtle turquoise gradient */}
        <linearGradient id={`${filterId}-label`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#82bcb2" />
          <stop offset="100%" stopColor="#5a9d92" />
        </linearGradient>
        {/* Light streak on body */}
        <linearGradient id={`${filterId}-streak`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Cap shadow plate */}
      <ellipse cx="100" cy="58" rx="44" ry="5" fill="rgba(44,40,38,0.10)" />

      {/* Cap */}
      <rect x="60" y="14" width="80" height="46" rx="6" fill={`url(#${filterId}-cap)`} />
      {/* Cap top highlight */}
      <rect x="64" y="18" width="72" height="6" rx="3" fill="rgba(255,255,255,0.55)" />
      {/* Cap ridge lines */}
      {[26, 32, 38, 44, 50].map((y) => (
        <line
          key={y}
          x1="64"
          x2="136"
          y1={y}
          y2={y}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="0.6"
        />
      ))}

      {/* Body */}
      <path
        d="M58 60
           L142 60
           Q150 60 150 70
           L150 210
           Q150 224 136 224
           L64 224
           Q50 224 50 210
           L50 70
           Q50 60 58 60 Z"
        fill={`url(#${filterId}-body)`}
        stroke="rgba(184,153,104,0.30)"
        strokeWidth="0.8"
      />

      {/* Vertical light streak left */}
      <rect x="58" y="78" width="6" height="120" rx="3" fill={`url(#${filterId}-streak)`} opacity="0.55" />
      {/* Vertical light streak right */}
      <rect x="138" y="78" width="3" height="120" rx="2" fill={`url(#${filterId}-streak)`} opacity="0.35" />

      {/* Inner bear gummies — silhouettes — adds depth */}
      <g opacity="0.16">
        <BearMini cx={78} cy={150} r={9} fill="#b89968" />
        <BearMini cx={108} cy={170} r={9} fill="#b89968" />
        <BearMini cx={92} cy={188} r={8} fill="#b89968" />
      </g>

      {/* Label band */}
      <rect x="50" y="88" width="100" height="74" fill={`url(#${filterId}-label)`} opacity="0.96" />
      {/* Label top hairline */}
      <line x1="50" y1="88" x2="150" y2="88" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
      {/* Label bottom hairline */}
      <line x1="50" y1="162" x2="150" y2="162" stroke="rgba(255,255,255,0.20)" strokeWidth="0.6" />

      {/* Wordmark — gold sans on label */}
      <text
        x="100"
        y="116"
        textAnchor="middle"
        fontFamily="'Cormorant Garamond', serif"
        fontSize="14"
        fontWeight="700"
        fill="#fbf5e8"
        letterSpacing="2.4"
      >
        SUGARBEAR
      </text>
      {/* Sub-label */}
      <text
        x="100"
        y="130"
        textAnchor="middle"
        fontFamily="'Cormorant Garamond', serif"
        fontStyle="italic"
        fontSize="6.5"
        fill="rgba(251,245,232,0.85)"
        letterSpacing="1.8"
      >
        HAIR · DAILY RITUAL
      </text>

      {/* Tiny gold bear emblem on label */}
      <g transform="translate(100,148)">
        <BearMini cx={0} cy={0} r={9} fill="#e8cc97" />
      </g>

      {/* Bottom shadow plate */}
      <ellipse cx="100" cy="226" rx="46" ry="3.5" fill="rgba(44,40,38,0.08)" />
    </svg>
  );
}

function BearMini({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  // Stylised gummy bear silhouette
  return (
    <g transform={`translate(${cx},${cy})`}>
      {/* ears */}
      <circle cx={-r * 0.6} cy={-r * 0.7} r={r * 0.32} fill={fill} />
      <circle cx={r * 0.6} cy={-r * 0.7} r={r * 0.32} fill={fill} />
      {/* head */}
      <circle cx={0} cy={-r * 0.1} r={r * 0.55} fill={fill} />
      {/* body */}
      <ellipse cx={0} cy={r * 0.55} rx={r * 0.78} ry={r * 0.55} fill={fill} />
    </g>
  );
}
