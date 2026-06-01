"use client";

import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import { SafeProductImage } from "@/components/product/SafeProductImage";
import type { ProductImage } from "@/lib/types";

type Props = {
  image: ProductImage;
  /** Tailwind aspect class. Defaults to a mobile-first portrait 4:5. */
  aspectClassName?: string;
  className?: string;
};

/**
 * SectionFigure — the single, consistent visual block used by every image-led
 * CRO section (Step 4 Phase 4.6.2).
 *
 * # Why one component
 *
 * The SugarBear benchmark is image-LED: most sections are a premium photograph
 * + a short copy block, repeated in a rhythm. Funnelling every section image
 * through one framed component keeps that rhythm visually consistent (same
 * frame, radius, shadow, cream backdrop) instead of each section inventing its
 * own treatment. The cream backdrop + `SafeProductImage` mean a slow/broken
 * decode degrades to the brand placeholder, never a black void (Phase 4.5).
 *
 * Mobile-first: portrait 4:5 by default (the dominant social-traffic viewport),
 * full-bleed within the section column, image ABOVE the copy on mobile.
 */
export function SectionFigure({ image, aspectClassName = "aspect-[4/5]", className }: Props) {
  const { locale } = useLocale();
  return (
    <div
      className={`fn-photo-frame relative overflow-hidden rounded-2xl bg-brand-soft ${aspectClassName} ${className ?? ""}`}
    >
      <SafeProductImage
        src={image.src}
        alt={pickLocalized(image.alt, locale)}
        fill
        sizes="(min-width: 1024px) 640px, 100vw"
        className="object-cover"
      />
    </div>
  );
}
