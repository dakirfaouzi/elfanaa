"use client";

import { ShoppingBag } from "lucide-react";
import { useCart, useCartHydrated } from "@/hooks/useCart";
import { useUI } from "@/hooks/useUI";
import { useLocale } from "@/hooks/useLocale";

export function CartTrigger() {
  const openCart = useUI((s) => s.openCart);
  const itemCount = useCart((s) => s.itemCount());
  const hydrated = useCartHydrated();
  const { t } = useLocale();

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={t.common.cart}
      className="relative grid size-10 place-items-center rounded-full transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
    >
      <ShoppingBag className="size-5" />
      {hydrated && itemCount > 0 ? (
        <span
          aria-hidden
          className="absolute -end-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] font-semibold leading-none text-bg"
          style={{ height: 20 }}
        >
          {itemCount}
        </span>
      ) : null}
    </button>
  );
}
