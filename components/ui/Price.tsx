"use client";

import { cn } from "@/lib/cn";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import type { Money } from "@/lib/types";

type PriceProps = {
  price: Money;
  compareAtPrice?: Money;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: { base: "text-sm", compare: "text-xs" },
  md: { base: "text-base", compare: "text-sm" },
  lg: { base: "text-xl", compare: "text-base" },
} as const;

export function Price({ price, compareAtPrice, size = "md", className }: PriceProps) {
  const format = useFormatPrice();
  const onSale = compareAtPrice && compareAtPrice.amount > price.amount;
  const s = SIZES[size];

  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className={cn("font-semibold tabular-nums", s.base, onSale && "text-danger")}>
        {format(price)}
      </span>
      {onSale ? (
        <span
          className={cn(
            "tabular-nums text-muted line-through decoration-1 underline-offset-2",
            s.compare
          )}
        >
          {format(compareAtPrice)}
        </span>
      ) : null}
    </span>
  );
}
