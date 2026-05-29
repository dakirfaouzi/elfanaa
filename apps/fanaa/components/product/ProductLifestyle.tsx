"use client";

import { Container } from "@/components/layout/Container";
import { Flourish } from "@/components/brand/Flourish";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import { getLifestyleImage } from "@/lib/product-image";
import { SafeProductImage } from "@/components/product/SafeProductImage";
import type { Product } from "@/lib/types";

type Props = { product: Product };

/**
 * Editorial "in your home" band — alternating image / text.
 *
 * Pattern from Article + Crate&Barrel: a single hero photograph the
 * customer can imagine themselves living in, paired with the brand-
 * voice paragraph (the same headline + subheadline already shown
 * in the PDP details). The repetition is intentional — by the time
 * the customer has scrolled this far they are evaluating *vibe*, not
 * specs, and the headline reinforces what they already half-decided.
 */
export function ProductLifestyle({ product }: Props) {
  const { locale, t } = useLocale();
  // Falls through `lifestyleImage` → `images[0]` → placeholder so the
  // editorial band still renders for AI-generated products that have
  // neither a curated lifestyle photo nor a hero gallery shot yet.
  const image = getLifestyleImage(product);
  const headline = product.headline ?? product.title;
  const subhead = product.subheadline;

  return (
    <section className="fn-section-y">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Image — leads on desktop, follows on mobile. Wrapped in
              .fn-photo-frame so the editorial framing matches HomeHero
              and the /sugarbear hero. */}
          <div className="fn-photo-frame relative order-1 aspect-[4/5] overflow-hidden md:aspect-[5/6] lg:order-2">
            <SafeProductImage
              src={image.src}
              alt={pickLocalized(image.alt, locale)}
              fill
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-cover"
            />
          </div>

          <div className="order-2 max-w-lg lg:order-1">
            <p className="fn-eyebrow">
              <span className="fn-rule" />
              <span>{t.product.lifestyleEyebrow}</span>
            </p>
            <h2 className="fn-section-title mt-4 md:mt-5">
              {pickLocalized(headline, locale)}
            </h2>
            <Flourish className="mt-5 text-accent" width={120} />
            {subhead ? (
              <p className="mt-5 text-[15px] leading-[1.8] text-muted md:text-[17px]">
                {pickLocalized(subhead, locale)}
              </p>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
