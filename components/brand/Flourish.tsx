import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

type Props = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  /** Display width in pixels — height auto-derives from the 12:1 ratio. */
  width?: number;
  className?: string;
};

/**
 * The decorative bar separating the wordmark from the tagline in the
 * full lockup. Two rules, two dots, one diamond — the same ornament that
 * sits between "الفناء" and "تفاصيل تصنع الفخامة" on the master logo.
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
        <line x1="6" y1="5" x2="50" y2="5" stroke="currentColor" />
        <line x1="70" y1="5" x2="114" y2="5" stroke="currentColor" />
        <circle cx="53.5" cy="5" r="0.85" stroke="none" />
        <circle cx="66.5" cy="5" r="0.85" stroke="none" />
        <path d="M56.5 5 L60 1.5 L63.5 5 L60 8.5 Z" stroke="none" />
      </g>
    </svg>
  );
}
