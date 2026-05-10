import { useId } from "react";

interface StarsProps {
  /** Rating value from 0 to 5. */
  value: number;
  /** Size in pixels for one star. */
  size?: number;
  /** Color override (defaults to soft gold). */
  color?: string;
  /** Show numeric value next to stars. */
  showValue?: boolean;
  /** Optional label (e.g. count) shown after the value. */
  label?: string;
  className?: string;
}

export function Stars({
  value,
  size = 16,
  color = "var(--sb-gold)",
  showValue = false,
  label,
  className,
}: StarsProps) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className={`sb-stars ${className ?? ""}`} aria-label={`تقييم ${value} من ٥`}>
      <span style={{ display: "inline-flex", direction: "ltr", gap: 2 }}>
        {Array.from({ length: full }).map((_, i) => (
          <Star key={`f-${i}`} size={size} color={color} fill="full" />
        ))}
        {half && <Star size={size} color={color} fill="half" />}
        {Array.from({ length: empty }).map((_, i) => (
          <Star key={`e-${i}`} size={size} color={color} fill="empty" />
        ))}
      </span>
      {showValue && (
        <span
          className="sb-num"
          style={{
            color: "var(--sb-charcoal)",
            fontWeight: 600,
            fontSize: size * 0.85,
          }}
        >
          {value.toString()}
        </span>
      )}
      {label && (
        <span style={{ color: "var(--sb-stone)", fontSize: size * 0.8, fontWeight: 500 }}>
          {label}
        </span>
      )}
    </span>
  );
}

function Star({ size, color, fill }: { size: number; color: string; fill: "full" | "half" | "empty" }) {
  // useId() is stable across server and client — never use Math.random() for SVG ids.
  const reactId = useId();
  const id = `sb-star-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const path =
    "M12 2.5l2.95 6.13 6.55.96-4.74 4.78 1.12 6.79L12 17.92l-5.88 3.24 1.12-6.79L2.5 9.59l6.55-.96L12 2.5z";
  if (fill === "full") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d={path} fill={color} />
      </svg>
    );
  }
  if (fill === "empty") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d={path} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={1.4} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="1" y1="0" x2="0" y2="0">
          <stop offset="50%" stopColor={color} />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d={path} fill={`url(#${id})`} stroke={color} strokeOpacity={0.6} strokeWidth={1} />
    </svg>
  );
}
