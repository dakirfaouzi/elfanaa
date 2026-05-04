"use client";

import { useCart } from "@/hooks/useCart";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { useLocale } from "@/hooks/useLocale";
import { siteConfig } from "@/data/site";

export function FreeShippingBar() {
  const { t } = useLocale();
  const subtotal = useCart((s) => s.subtotal());
  const progress = useCart((s) => s.freeShippingProgress());
  const format = useFormatPrice();

  const remaining = Math.max(0, progress.threshold - subtotal.amount);
  const unlocked = remaining === 0;
  const remainingMoney = { amount: remaining, currency: subtotal.currency };

  return (
    <div className="px-5 py-4">
      <p className="text-center text-[13px] text-ink">
        {unlocked ? (
          <span className="font-medium text-success">
            ✓ {t.cart.freeShipUnlocked}
          </span>
        ) : (
          <>
            {t.cart.freeShipBefore}{" "}
            <span className="font-semibold tabular-nums">{format(remainingMoney)}</span>{" "}
            {t.cart.freeShipAfter}
          </>
        )}
      </p>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className="progress-fill h-full rounded-full bg-ink"
          style={{ inlineSize: `${Math.round(progress.ratio * 100)}%` }}
          aria-valuenow={Math.round(progress.ratio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>
    </div>
  );
}
