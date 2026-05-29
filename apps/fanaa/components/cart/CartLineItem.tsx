"use client";

import { Minus, Plus, X } from "lucide-react";
import { Price } from "@/components/ui/Price";
import { useCart, type ResolvedLine } from "@/hooks/useCart";
import { useLocale } from "@/hooks/useLocale";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { pickLocalized } from "@/lib/format";
import { lineTotal, nextTier, tierSavings } from "@/lib/pricing";
import { getPrimaryImage } from "@/lib/product-image";
import { SafeProductImage } from "@/components/product/SafeProductImage";

export function CartLineItem({ line }: { line: ResolvedLine }) {
  const { locale, t } = useLocale();
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const format = useFormatPrice();

  const product = line.product;
  const total = lineTotal(product, line.quantity);
  const saved = tierSavings(product, line.quantity);
  const upcoming = nextTier(product, line.quantity);
  const image = getPrimaryImage(product);

  return (
    <li className="flex gap-4 px-5 py-5">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-sm bg-brand-soft">
        <SafeProductImage
          src={image.src}
          alt={pickLocalized(image.alt, locale)}
          fill
          sizes="80px"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium">
              {pickLocalized(product.title, locale)}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {t.common.qty}: <span className="tabular-nums">{line.quantity}</span>
            </p>
          </div>
          <Price price={total} size="sm" />
        </div>

        {saved ? (
          <p className="text-[11px] font-medium text-success">
            {t.cart.tierSavedPiece.replace("{amount}", format(saved))}
          </p>
        ) : null}

        {upcoming ? (
          <button
            type="button"
            onClick={() => setQuantity(product.id, upcoming.quantity, line.variantId)}
            className="self-start text-[11px] font-medium text-ink/70 underline-offset-2 transition-colors hover:text-ink hover:underline"
          >
            {t.cart.nextTierUnlock.replace(
              "{amount}",
              format(savingsAtTier(product, upcoming.quantity))
            )}
          </button>
        ) : null}

        <div className="mt-auto flex items-center justify-between">
          <div className="inline-flex items-center rounded-full border border-line">
            <QtyButton
              onClick={() => setQuantity(product.id, line.quantity - 1, line.variantId)}
              aria-label="Decrease quantity"
            >
              <Minus className="size-3.5" />
            </QtyButton>
            <span className="w-8 text-center text-sm tabular-nums">{line.quantity}</span>
            <QtyButton
              onClick={() => setQuantity(product.id, line.quantity + 1, line.variantId)}
              aria-label="Increase quantity"
            >
              <Plus className="size-3.5" />
            </QtyButton>
          </div>

          <button
            type="button"
            onClick={() => remove(product.id, line.variantId)}
            className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-danger"
          >
            <X className="size-3.5" />
            {t.common.remove}
          </button>
        </div>
      </div>
    </li>
  );
}

/** Helper for the next-tier nudge — shows what the customer would save by jumping. */
function savingsAtTier(product: ResolvedLine["product"], qty: number) {
  return tierSavings(product, qty) ?? { amount: 0, currency: product.price.currency };
}

function QtyButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="grid size-8 place-items-center rounded-full text-ink transition-colors hover:bg-brand-soft"
      {...rest}
    >
      {children}
    </button>
  );
}
