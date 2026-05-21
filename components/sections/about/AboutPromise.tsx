"use client";

import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

/**
 * Promise — what the customer actually receives.
 *
 * Image LEFT this time — alternating image/text rhythm pays off in
 * typographic music: hero (full-bleed), manifesto (image right),
 * pillars (no image), promise (image left), CTA (no image).
 */
export function AboutPromise() {
  const { t } = useLocale();
  return (
    <section className="bg-bg py-20 md:py-32">
      <Container>
        <div className="grid items-center gap-10 md:grid-cols-12 md:gap-16">
          <figure className="relative order-2 aspect-[4/5] overflow-hidden rounded-md bg-brand-soft shadow-card md:order-1 md:col-span-5">
            <Image
              src="https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1800&q=88&auto=format&fit=crop&crop=center"
              alt={t.about.promiseEyebrow}
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
            />
          </figure>

          <div className="order-1 space-y-6 md:order-2 md:col-span-7 md:ps-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {t.about.promiseEyebrow}
            </p>
            <h2 className="text-balance font-display text-3xl font-semibold leading-[1.12] tracking-tight md:text-5xl">
              {t.about.promiseTitle}
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-muted md:text-[17px]">
              {t.about.promiseBody}
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
