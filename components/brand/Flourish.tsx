import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

type Props = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  /** Display width in pixels — height auto-derives from the 12:1 ratio. */
  width?: number;
  className?: string;
};

/**
 * The decorative bar separating the wordmark from the tagline in the
 * full lockup. A minimal hairline divider with a single rose-copper
 * centre dot — the same ornament that sits between "فناء" and the
 * tagline "أصلك يطلع من جوّاك" on the master logo.
 *
 * Lives independently from `<Logo />` so it can be reused inside section
 * eyebrows, certificate copy, and email signatures without dragging the
 * wordmark along.
 */
export function Flourish({ width = 120, className, ...rest }: Props) {
  return (
    <svg
      role="presentation"
      aria-hidden
      viewBox="0 0 120 10"
      width={width}
      height={width / 12}
      preserveAspectRatio="xMidYMid meet"
      className={cn("inline-block text-accent", className)}
      {...rest}
    >
      <g stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" fill="currentColor">
        <line x1="6" y1="5" x2="56" y2="5" stroke="currentColor" />
        <line x1="64" y1="5" x2="114" y2="5" stroke="currentColor" />
        <circle cx="60" cy="5" r="1.4" stroke="none" />
      </g>
    </svg>
  );
}
