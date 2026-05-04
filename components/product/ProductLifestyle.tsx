"use client";

import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { Flourish } from "@/components/brand/Flourish";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
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
  const image = product.lifestyleImage ?? product.images[0];
  const headline = product.headline ?? product.title;
  const subhead = product.subheadline;

  return (
    <section className="py-16 md:py-24">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Image — leads on desktop, follows on mobile (object-cover keeps it
              cinematic at any aspect ratio). */}
          <div className="relative order-1 aspect-[4/5] overflow-hidden rounded-md bg-brand-soft md:aspect-[5/6] lg:order-2">
            <Image
              src={image.src}
              alt={pickLocalized(image.alt, locale)}
              fill
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-cover"
            />
          </div>

          <div className="order-2 max-w-lg lg:order-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {t.product.lifestyleEyebrow}
            </p>
            <h2 className="mt-2 whitespace-pre-line font-display text-3xl font-semibold leading-[1.15] tracking-tight md:text-4xl lg:text-5xl">
              {pickLocalized(headline, locale)}
            </h2>
            <Flourish className="mt-5 text-accent" width={120} />
            {subhead ? (
              <p className="mt-5 text-base leading-relaxed text-muted md:text-[17px]">
                {pickLocalized(subhead, locale)}
              </p>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
