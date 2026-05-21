"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  /** Score 0..5 (decimals allowed; rounded to nearest half for display). */
  value: number;
  count?: number;
  size?: "sm" | "md" | "lg";
  /** Optional label suffix — e.g. "(268 تقييم)" */
  label?: string;
  className?: string;
};

/**
 * Reusable star-rating display.
 *
 * Implementation note: we render five stroke-stars and overlay a
 * `clip-path`-clipped fill-star to express partial ratings without
 * shipping SVG paths for half-stars.
 */
export function RatingStars({ value, count, size = "md", label, className }: Props) {
  const safe = Math.max(0, Math.min(5, value));
  const pct = (safe / 5) * 100;
  const px = size === "sm" ? "size-3" : size === "lg" ? "size-4" : "size-3.5";

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative inline-flex items-center text-accent" aria-hidden>
        {/* Empty backdrop */}
        <span className="inline-flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={cn(px, "text-muted/30")} stroke="currentColor" />
          ))}
        </span>
        {/* Filled overlay clipped to percentage */}
        <span
          className="absolute inset-0 inline-flex overflow-hidden"
          style={{ width: `${pct}%` }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(px, "text-accent")}
              fill="currentColor"
              stroke="currentColor"
            />
          ))}
        </span>
      </span>

      <span className="text-xs tabular-nums text-muted">
        {safe.toFixed(1)}
        {typeof count === "number" ? ` · ${count}` : null}
        {label ? ` ${label}` : null}
      </span>
    </div>
  );
}
