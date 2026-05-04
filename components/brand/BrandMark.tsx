import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

type Props = Omit<SVGProps<SVGSVGElement>, "size"> & {
  /** Pixel size — defaults to 24, the canonical icon size. */
  size?: number;
  /**
   * Visual stroke weight in *display pixels* (not viewBox units).
   * 1.1 reads crisp at 18–24px and confident at 64px+. Override only if
   * you need a heavier mark on photographic backgrounds.
   */
  strokePx?: number;
  className?: string;
};

const VIEWBOX_SIZE = 32;

/**
 * The ELFANAA mark — a Najdi pointed arch with a courtyard plant inside.
 *
 * The visual idea: the inner courtyard of the Saudi home (الفناء) seen
 * through its threshold arch. The plant is the life within — a single
 * sprig in a small bowl, the way a quiet courtyard always seems to have
 * one. Two columns, one arch, four leaves: restraint is the whole point.
 *
 * Strokes use `currentColor`, so the mark inherits text colour and lives
 * on cream surfaces, deep-oud surfaces, and brass-tinted promotional
 * banners alike. The stroke is computed in display pixels so the visual
 * weight reads identically at 18px (header), 32px (lockup), and 64px+
 * (hero).
 *
 * Use cases:
 *   • Favicon — file at `app/icon.svg` (auto-detected by Next.js).
 *   • Logo lockup — composed by `<Logo />` next to the wordmark.
 *   • Loading state — `animate-pulse` on a coloured copy.
 */
export function BrandMark({
  size = 24,
  strokePx = 1.1,
  className,
  ...rest
}: Props) {
  // Convert display-pixel stroke into viewBox units so the stroke reads
  // the same regardless of render size. At size=24 this gives ~1.47;
  // at size=64 it gives ~0.55. Both render as 1.1px on screen.
  const strokeWidth = (VIEWBOX_SIZE / size) * strokePx;

  return (
    <svg
      role="img"
      aria-label="Elfanaa mark"
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
      {/* Column bases — the small "feet" the columns rest on */}
      <line x1="7" y1="28" x2="11" y2="28" />
      <line x1="21" y1="28" x2="25" y2="28" />

      {/* Outer outline of the arch + columns */}
      <path d="M8 28V11.5C8 8.5 12 6 16 4.5C20 6 24 8.5 24 11.5V28" />

      {/* Inner outline — the door opening */}
      <path d="M10 28V12C10 10 13 8 16 6.5C19 8 22 10 22 12V28" />

      {/* Bowl: rim line + shallow dish curve */}
      <line x1="13" y1="23.5" x2="19" y2="23.5" />
      <path d="M13.5 23.5C14 25.5 15 26.5 16 26.5C17 26.5 18 25.5 18.5 23.5" />

      {/* Plant stem rising from the bowl */}
      <line x1="16" y1="23.5" x2="16" y2="15.5" />

      {/* Four almond-shaped leaves — paired left/right, lower & upper */}
      <path d="M16 21C14.5 20.4 13.4 19.4 13 18C14.5 18.4 15.6 19.4 16 21" />
      <path d="M16 21C17.5 20.4 18.6 19.4 19 18C17.5 18.4 16.4 19.4 16 21" />
      <path d="M16 18C14.6 17.4 13.8 16.2 13.6 14.8C14.9 15.4 15.7 16.4 16 18" />
      <path d="M16 18C17.4 17.4 18.2 16.2 18.4 14.8C17.1 15.4 16.3 16.4 16 18" />
    </svg>
  );
}
