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
    <article className={cn("card-luxury group relative", className)}>
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-brand-soft transition-shadow duration-500 ease-premium group-hover:shadow-elevated">
          <Image
            src={primary.src}
            alt={pickLocalized(primary.alt, locale)}
            fill
            sizes="(min-width: 1280px) 320px, (min-width: 768px) 33vw, 50vw"
            priority={priority}
            className="object-cover transition-transform duration-[800ms] ease-premium group-hover:scale-[1.035]"
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
                  "btn-press inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-[13px] font-semibold",
                  "bg-surface/95 text-ink shadow-card backdrop-blur-sm",
                  "transition-colors duration-250 ease-premium hover:bg-ink hover:text-bg"
                )}
              >
                {justAdded ? (
                  <>
                    <Check className="size-4" />
                    {locale === "ar" ? "✓ تمت الإضافة" : "✓ Added"}
                  </>
                ) : (
                  <>
                    <ShoppingBag className="size-4" />
                    {locale === "ar" ? "اطلب الحين" : "Order now"}
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold leading-snug text-ink">{title}</h3>
              {/* Emotional hook — first line of headline, shown in accent colour */}
              {product.headline && (
                <p className="mt-0.5 line-clamp-1 text-[12px] font-medium text-accent">
                  {pickLocalized(product.headline, locale).split("\n")[0]}
                </p>
              )}
              {product.rating ? (
                <p className="mt-0.5 text-[11px] text-muted tabular-nums">
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
        </div>
      </Link>
    </article>
  );
}
