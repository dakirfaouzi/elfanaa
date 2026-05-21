"use client";

import { ShieldCheck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  useCartItemCount,
  useCartSubtotal,
  useResolvedCartLines,
} from "@/hooks/useCart";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { useLocale } from "@/hooks/useLocale";
import { useUI } from "@/hooks/useUI";
import { trackCommerce } from "@/lib/analytics";

export function CartSummary() {
  const { t } = useLocale();
  const subtotal = useCartSubtotal();
  const itemCount = useCartItemCount();
  const lines = useResolvedCartLines();
  const goToCheckout = useUI((s) => s.goToCheckout);
  const format = useFormatPrice();

  const onCheckout = () => {
    trackCommerce("begin_checkout", {
      products: lines.map((l) => l.product),
      value: subtotal,
    });
    goToCheckout();
  };

  return (
    <div className="space-y-4">
      <dl className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted">{t.cart.subtotal}</dt>
          <dd className="font-medium tabular-nums">{format(subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">{t.cart.shipping}</dt>
          <dd className="text-muted">{t.cart.shippingAtCheckout}</dd>
        </div>
      </dl>

      <Button
        onClick={onCheckout}
        size="lg"
        fullWidth
        disabled={itemCount === 0}
      >
        {t.cart.checkoutCta} · {format(subtotal)}
      </Button>

      <ul className="flex items-center justify-center gap-5 text-[11px] text-muted">
        <li className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" />
          {t.cart.trustSecure}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <Undo2 className="size-3.5" />
          {t.cart.trustReturns}
        </li>
      </ul>
    </div>
  );
}
