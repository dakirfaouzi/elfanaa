"use client";

import { Container } from "@/components/layout/Container";
import { Flourish } from "@/components/brand";
import { useLocale } from "@/hooks/useLocale";

/**
 * Contact hero — typographic, no photograph.
 *
 * Reasoning: a hero photograph on /contact pushes the channels below
 * the fold, which is the opposite of what someone visiting this page
 * wants. We keep the hero short, set in the display face, and let the
 * action grid breathe right under it.
 */
export function ContactHero() {
  const { t } = useLocale();
  return (
    <section className="bg-brand-soft/60 py-20 md:py-28">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            {t.contact.heroEyebrow}
          </p>
          <h1 className="mt-4 text-balance font-display text-4xl font-semibold leading-[1.06] tracking-tight md:text-6xl">
            {t.contact.heroTitle}
          </h1>
          <div className="mt-6 flex justify-center">
            <Flourish width={140} className="text-accent" />
          </div>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted md:text-[17px]">
            {t.contact.heroBody}
          </p>
        </div>
      </Container>
    </section>
  );
}
