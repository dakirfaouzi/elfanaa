"use client";

import { Container } from "@/components/layout/Container";
import { Flourish } from "@/components/brand/Flourish";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import { getLifestyleImage, isPlaceholderImage } from "@/lib/product-image";
import { SafeProductImage } from "@/components/product/SafeProductImage";
import type { Product, ProductImage } from "@/lib/types";

type Props = { product: Product; image?: ProductImage };

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
export function ProductLifestyle({ product, image: assigned }: Props) {
  const { locale, t } = useLocale();
  // Phase 4.6.2: the distributor assigns this marquee band a dedicated scene.
  // Falls back through `lifestyleImage` → `images[0]` → placeholder so the
  // editorial band still renders for products with a generated scene pool.
  const image = assigned ?? getLifestyleImage(product);
  const headline = product.headline ?? product.title;
  const subhead = product.subheadline;

  /*
   * Sprint A #5 — self-guard. This is the one narrative band with no content
   * gate, so a sparse AI product (no real scene, no AI headline) rendered a
   * placeholder "image pending" marquee titled with its raw slug. The band is
   * fundamentally an IMAGE band, so we only show it when there is genuine
   * photography to carry it: a real (non-placeholder) image AND a real
   * headline (a grounded `headline`, or a `title` that isn't the slug
   * fallback `synthesiseProductFromRow` seeds). Otherwise omit — matching the
   * self-guarding contract every other section already honours.
   */
  const hasRealImage = !isPlaceholderImage(image.src);
  const hasRealHeadline =
    Boolean(product.headline) ||
    (product.title.ar !== product.slug && product.title.en !== product.slug);
  if (!hasRealImage || !hasRealHeadline) return null;

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
