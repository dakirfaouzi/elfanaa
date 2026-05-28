"use client";

import Image from "next/image";
import { Plus } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useLocale } from "@/hooks/useLocale";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { pickLocalized } from "@/lib/format";
import { track } from "@/lib/analytics";
import { getPrimaryImage } from "@/lib/product-image";
import type { Product } from "@/lib/types";

/**
 * Compact in-cart cross-sell card.
 *   • One tap to add (no variant pickers).
 *   • Stays visually secondary so the checkout CTA owns the bottom of the drawer.
 */
export function CrossSellCard({ product }: { product: Product }) {
  const { locale, t } = useLocale();
  const add = useCart((s) => s.add);
  const format = useFormatPrice();
  const image = getPrimaryImage(product);

  const onAdd = () => {
    // Tag this line as a cart-drawer cross-sell so the order webhook
    // can place it in the cross-sell slot of the Google Sheets
    // "Product name" / "Total quantity" / "SKU" columns. Without
    // this tag, the line is indistinguishable from a primary product
    // and lands in the base slot — collapsing the 3-slot model the
    // ops team relies on (`base / upsell / cross_sell`).
    add(product.id, 1, { source: "cross_sell" });
    track("accept_upsell", { item_id: product.id, surface: "cart_drawer" });
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-bg p-3">
      <div className="relative size-14 shrink-0 overflow-hidden rounded-sm bg-brand-soft">
        <Image
          src={image.src}
          alt={pickLocalized(image.alt, locale)}
          fill
          sizes="56px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          {pickLocalized(product.title, locale)}
        </p>
        <p className="text-xs text-muted tabular-nums">{format(product.price)}</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        aria-label={`${t.cart.addUpsell} ${pickLocalized(product.title, locale)}`}
        className="inline-flex h-9 items-center gap-1 rounded-full border border-line px-3 text-xs font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-bg"
      >
        <Plus className="size-3.5" />
        {t.cart.addUpsell}
      </button>
    </div>
  );
}
