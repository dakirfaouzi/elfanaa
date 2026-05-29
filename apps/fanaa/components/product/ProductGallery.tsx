"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { pickLocalized } from "@/lib/format";
import { useLocale } from "@/hooks/useLocale";
import { Badge } from "@/components/ui/Badge";
import { getProductImageAt } from "@/lib/product-image";
import { SafeProductImage } from "@/components/product/SafeProductImage";
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

  /*
   * Thumbnail rail only renders when there's more than one real
   * image — synthesised AI-generated products always have exactly
   * one (the placeholder), so the rail never shows for them. The
   * optional chain on `length` is defensive against the same
   * `images: undefined` shape `getPrimaryImage` already guards.
   * Filtering out undefined entries from the map iteration covers
   * the rarer `[realImage, undefined]` case (legacy persisted carts
   * or malformed DB rows) without crashing the gallery.
   */
  const thumbnails = (product.images ?? []).filter(
    (img): img is NonNullable<typeof img> => Boolean(img),
  );

  /*
   * Only reserve the desktop two-track layout (`88px` rail + `1fr`
   * hero) WHEN the thumbnail rail will actually render. With a single
   * image (every AI-generated product — its only image is the
   * placeholder), the rail `<div>` is omitted, so a static
   * `md:grid-cols-[88px_1fr]` left the lone hero `<div>` as the only
   * grid child. CSS grid auto-places a lone item into the FIRST track
   * (the 88px rail track) — `md:order-2` reorders visually but does
   * not move it to the `1fr` track — collapsing the hero to an 88px
   * tile on desktop. That was the "blank PDP gallery" for AI-gen
   * products: a correct placeholder image rendered at 88×110 in the
   * corner of a 600px column. Curated products (2+ images) were
   * unaffected because the rail filled track 1 and the hero took
   * the `1fr` track. Dropping the explicit columns when there's no
   * rail lets the hero use the full single-column width.
   */
  const hasThumbnailRail = thumbnails.length > 1;

  return (
    <div className={cn("grid gap-3", hasThumbnailRail && "md:grid-cols-[88px_1fr]")}>
      {hasThumbnailRail ? (
        <div className="order-2 flex gap-2 overflow-x-auto scrollbar-none md:order-1 md:flex-col">
          {thumbnails.map((img, i) => (
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
              <SafeProductImage
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
        <SafeProductImage
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
