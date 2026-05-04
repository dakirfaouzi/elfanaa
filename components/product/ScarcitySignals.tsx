"use client";

import { Activity, Flame } from "lucide-react";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/types";

type Props = {
  product: Product;
  className?: string;
};

/**
 * Scarcity + social-activity row.
 *
 * Two compact signals only — never more (Cialdini + Aftersell research:
 * three+ urgency signals on the same surface read as desperation).
 *
 *   • `stockLeft`     → "آخر ١٢ قطعة" / "Only 12 left"
 *   • `recentBuyers`  → "٢٧ عميل طلبوا اليوم" / "27 customers ordered today"
 *
 * Both signals are display-only — they don't gate inventory. They become
 * powerful when the numbers are real, so wire them to the live count
 * from `/api/orders` as soon as the volume justifies it.
 *
 * Renders nothing if the product has neither field set.
 */
export function ScarcitySignals({ product, className }: Props) {
  const { t } = useLocale();
  const stock = product.stockLeft;
  const buyers = product.recentBuyers;
  if (!stock && !buyers) return null;

  // "Last X" tone when stock is low — switches the visual urgency.
  const lowStock = typeof stock === "number" && stock <= 10;
  const stockTpl = lowStock ? t.product.stockHintLow : t.product.stockHint;

  return (
    <ul className={cn("flex flex-wrap gap-2 text-[12px]", className)}>
      {typeof stock === "number" ? (
        <li
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium",
            lowStock
              ? "bg-danger/10 text-danger"
              : "bg-accent/10 text-accent"
          )}
        >
          <Flame className="size-3.5" aria-hidden />
          <span>{stockTpl.replace("{count}", String(stock))}</span>
        </li>
      ) : null}

      {typeof buyers === "number" ? (
        <li className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 font-medium text-success">
          <Activity className="size-3.5" aria-hidden />
          <span>{t.product.activityHint.replace("{count}", String(buyers))}</span>
        </li>
      ) : null}
    </ul>
  );
}
