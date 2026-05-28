"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { pickLocalized } from "@/lib/format";
import { useLocale } from "@/hooks/useLocale";
import { Badge } from "@/components/ui/Badge";
import { getProductImageAt } from "@/lib/product-image";
import type { Product } from "@/lib/types";

type Props = { product: Product };

/**
 * Product gallery — thumbnail rail + hero image.
 *
 * Layout:
 *   • Desktop: a vertical 88px thumbnail rail to the left/right of the
 *     hero image.
 *   • Mobile: thumbnails collapse to a horizontal scroll strip below
 *     the hero so the first paint always shows the hero image full-bleed.
 *
 * The first product badge is rendered as a soft chip on the hero image
 * to surface the headline trust signal ("3-pack offer") without forcing
 * the customer to scroll.
 */
export function ProductGallery({ product }: Props) {
  const { locale } = useLocale();
  const [active, setActive] = useState(0);
  // Falls through `images[active]` → `images[0]` → placeholder so a
  // hybrid-catalog product with no curated photography still renders
  // a hero tile instead of crashing the PDP.
  const current = getProductImageAt(product, active);
  const headlineBadge = product.badges?.[0];

  return (
    <div className="grid gap-3 md:grid-cols-[88px_1fr]">
      {product.images.length > 1 ? (
        <div className="order-2 flex gap-2 overflow-x-auto scrollbar-none md:order-1 md:flex-col">
          {product.images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              aria-pressed={i === active}
              className={cn(
                "relative size-20 shrink-0 overflow-hidden rounded-sm border transition-colors",
                i === active ? "border-ink" : "border-transparent hover:border-line"
              )}
            >
              <Image
                src={img.src}
                alt={pickLocalized(img.alt, locale)}
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative order-1 aspect-[4/5] overflow-hidden rounded-md bg-brand-soft md:order-2">
        <Image
          src={current.src}
          alt={pickLocalized(current.alt, locale)}
          fill
          sizes="(min-width: 768px) 600px, 100vw"
          priority
          className="object-cover"
        />
        {headlineBadge ? (
          <div className="absolute start-4 top-4">
            <Badge tone="ink">{pickLocalized(headlineBadge, locale)}</Badge>
          </div>
        ) : null}
      </div>
    </div>
  );
}
