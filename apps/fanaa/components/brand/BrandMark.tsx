import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

type Props = Omit<SVGProps<SVGSVGElement>, "size"> & {
  /** Pixel size — defaults to 24, the canonical icon size. */
  size?: number;
  /**
   * Visual stroke weight in *display pixels* (not viewBox units).
   * 1.3 reads crisp at 18–24px and confident at 64px+. Override only if
   * you need a heavier mark on photographic backgrounds.
   */
  strokePx?: number;
  className?: string;
};

const VIEWBOX_SIZE = 32;

/**
 * The FANAA mark — minimal serum dewdrop inside a soft circle.
 *
 * The visual idea: a single drop of formulated care held inside a
 * containment ring. The dewdrop is the universal skincare archetype
 * (serum, hydration, essence); the circle reads as care, vessel,
 * ritual. Two shapes, no decoration — restraint is the whole point.
 *
 * Strokes use `currentColor`, so the mark inherits text colour and
 * lives on alabaster surfaces, deep-charcoal surfaces, and rose-copper
 * promotional banners alike. The stroke is computed in display pixels
 * so the visual weight reads identically at 18px (header), 32px
 * (lockup), and 64px+ (hero).
 *
 * Use cases:
 *   • Favicon — file at `app/icon.svg` (auto-detected by Next.js).
 *   • Logo lockup — composed by `<Logo />` next to the wordmark.
 *   • Loading state — `animate-pulse` on a coloured copy.
 */
export function BrandMark({
  size = 24,
  strokePx = 1.3,
  className,
  ...rest
}: Props) {
  // Convert display-pixel stroke into viewBox units so the stroke reads
  // the same regardless of render size. At size=24 this gives ~1.73;
  // at size=64 it gives ~0.65. Both render as 1.3px on screen.
  const strokeWidth = (VIEWBOX_SIZE / size) * strokePx;

  return (
    <svg
      role="img"
      aria-label="Fanaa mark"
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("inline-block shrink-0", className)}
      {...rest}
    >
      {/* Containment ring — the vessel of formulated care */}
      <circle cx="16" cy="16" r="12.5" />

      {/* Serum dewdrop — tapered top, rounded bottom; reads as skincare in 1ms */}
      <path d="M16 7.5C13.5 11 11.8 13.6 11.8 16.4C11.8 18.7 13.7 20.6 16 20.6C18.3 20.6 20.2 18.7 20.2 16.4C20.2 13.6 18.5 11 16 7.5Z" />
    </svg>
  );
}
