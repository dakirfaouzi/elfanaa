"use client";

import Image from "next/image";
import { Plus } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useLocale } from "@/hooks/useLocale";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { pickLocalized } from "@/lib/format";
import { track } from "@/lib/analytics";
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
  const image = product.images[0];

  const onAdd = () => {
    add(product.id, 1);
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
