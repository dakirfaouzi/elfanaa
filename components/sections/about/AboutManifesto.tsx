"use client";

import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { Flourish } from "@/components/brand";
import { useLocale } from "@/hooks/useLocale";

/**
 * Manifesto — the belief panel.
 *
 * Layout: image right, text left. Inverted from `BrandStory` on the
 * home page so the reader's eye gets a fresh rhythm rather than
 * repeating the home composition.
 */
export function AboutManifesto() {
  const { t } = useLocale();
  return (
    <section className="bg-bg py-20 md:py-32">
      <Container>
        <div className="grid items-center gap-10 md:grid-cols-12 md:gap-16">
          <div className="order-2 space-y-6 md:order-1 md:col-span-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {t.about.manifestoEyebrow}
            </p>
            <h2 className="text-balance font-display text-3xl font-semibold leading-[1.12] tracking-tight md:text-5xl">
              {t.about.manifestoTitle}
            </h2>
            <Flourish width={120} className="text-accent" />
            <p className="max-w-xl text-base leading-relaxed text-muted md:text-[17px]">
              {t.about.manifestoBody}
            </p>
          </div>

          <figure className="relative order-1 aspect-[4/5] overflow-hidden rounded-md bg-brand-soft shadow-card md:order-2 md:col-span-5">
            <Image
              src="https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1800&q=88&auto=format&fit=crop&crop=center"
              alt={t.about.manifestoEyebrow}
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
            />
          </figure>
        </div>
      </Container>
    </section>
  );
}
