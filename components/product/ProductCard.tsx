"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ShoppingBag, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { pickLocalized } from "@/lib/format";
import { useLocale } from "@/hooks/useLocale";
import { useCart } from "@/hooks/useCart";
import { useUI } from "@/hooks/useUI";
import { Badge } from "@/components/ui/Badge";
import { Price } from "@/components/ui/Price";
import type { Product } from "@/lib/types";

type ProductCardProps = {
  product: Product;
  className?: string;
  /** When true, the card surfaces a quick-add CTA on hover. */
  quickAdd?: boolean;
  priority?: boolean;
};

export function ProductCard({
  product,
  className,
  quickAdd = true,
  priority = false,
}: ProductCardProps) {
  const { locale } = useLocale();
  const add = useCart((s) => s.add);
  const openCart = useUI((s) => s.openCart);
  const [justAdded, setJustAdded] = useState(false);

  const title = pickLocalized(product.title, locale);
  const primary = product.images[0];
  const secondary = product.images[1] ?? primary;
  const onSale =
    product.compareAtPrice && product.compareAtPrice.amount > product.price.amount;

  const onQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    add(product.id, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
    setTimeout(openCart, 250);
  };

  return (
    <article className={cn("group relative", className)}>
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-brand-soft">
          <Image
            src={primary.src}
            alt={pickLocalized(primary.alt, locale)}
            fill
            sizes="(min-width: 1280px) 320px, (min-width: 768px) 33vw, 50vw"
            priority={priority}
            className="object-cover transition-transform duration-700 ease-premium group-hover:scale-[1.04]"
          />
          {secondary !== primary ? (
            <Image
              src={secondary.src}
              alt={pickLocalized(secondary.alt, locale)}
              fill
              sizes="(min-width: 1280px) 320px, (min-width: 768px) 33vw, 50vw"
              className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
          ) : null}

          {product.badges?.length ? (
            <div className="absolute start-3 top-3 flex flex-col gap-1.5">
              {product.badges.map((b, i) => (
                <Badge key={i} tone={onSale ? "ink" : "neutral"}>
                  {pickLocalized(b, locale)}
                </Badge>
              ))}
            </div>
          ) : null}

          {quickAdd ? (
            <div
              className={cn(
                "absolute inset-x-3 bottom-3 translate-y-1 opacity-0 transition-all duration-300 ease-premium",
                "group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100"
              )}
            >
              <button
                type="button"
                onClick={onQuickAdd}
                aria-label={`Add ${title} to cart`}
                className={cn(
                  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-medium",
                  "bg-surface/95 text-ink shadow-card backdrop-blur-sm transition-colors",
                  "hover:bg-ink hover:text-bg active:scale-[0.99]"
                )}
              >
                {justAdded ? (
                  <>
                    <Check className="size-4" />
                    {locale === "ar" ? "تمت الإضافة" : "Added"}
                  </>
                ) : (
                  <>
                    <ShoppingBag className="size-4" />
                    {locale === "ar" ? "إضافة سريعة" : "Quick add"}
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium text-ink">{title}</h3>
            {product.rating ? (
              <p className="mt-0.5 text-xs text-muted tabular-nums">
                ★ {product.rating.value.toFixed(1)} · {product.rating.count}
              </p>
            ) : null}
          </div>
          <Price
            price={product.price}
            compareAtPrice={product.compareAtPrice}
            size="sm"
            className="shrink-0"
          />
        </div>
      </Link>
    </article>
  );
}
