"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { CartLineItem } from "./CartLineItem";
import { CartSummary } from "./CartSummary";
import { FreeShippingBar } from "./FreeShippingBar";
import { CrossSellSlot } from "./CrossSellSlot";
import { useUI } from "@/hooks/useUI";
import { useResolvedCartLines } from "@/hooks/useCart";
import { useLocale } from "@/hooks/useLocale";

export function CartDrawer() {
  const { t } = useLocale();
  const open = useUI((s) => s.cartOpen);
  const close = useUI((s) => s.closeCart);
  const lines = useResolvedCartLines();

  const isEmpty = lines.length === 0;

  return (
    <Drawer
      open={open}
      onClose={close}
      title={t.cart.title}
      side="end"
      footer={!isEmpty ? <CartSummary /> : null}
    >
      {isEmpty ? (
        <EmptyCart onClose={close} />
      ) : (
        <>
          <FreeShippingBar />
          <ul className="divide-y divide-line">
            {lines.map((line) => (
              <CartLineItem key={`${line.productId}-${line.variantId ?? ""}`} line={line} />
            ))}
          </ul>
          <CrossSellSlot max={2} />
        </>
      )}
    </Drawer>
  );
}

function EmptyCart({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-brand-soft text-ink/60">
        <ShoppingBag className="size-7" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium">{t.common.empty}</p>
        <p className="text-sm text-muted">{t.common.emptyHint}</p>
      </div>
      <Link
        href="/shop"
        onClick={onClose}
        className="inline-flex h-11 items-center justify-center rounded-md bg-ink px-6 text-sm font-medium text-bg transition-colors hover:bg-ink/90"
      >
        {t.common.continueShopping}
      </Link>
    </div>
  );
}
