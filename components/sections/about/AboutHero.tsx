"use client";

import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { Logo } from "@/components/brand";
import { useLocale } from "@/hooks/useLocale";

/**
 * About hero — the "founding sentence".
 *
 * Quieter than the home hero (no CTA, no background photograph that
 * dominates). The logo is rendered with the tagline visible because
 * an About page is the right place to lean into the brand statement.
 */
export function AboutHero() {
  const { t } = useLocale();
  return (
    <section className="relative overflow-hidden bg-brand-soft">
      <div className="relative h-[64vh] min-h-[480px] w-full md:h-[72vh] md:min-h-[560px]">
        <Image
          src="https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=2400&q=85"
          alt={t.about.heroEyebrow}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/0 via-ink/15 to-ink/65" />
        <div className="absolute inset-0 bg-gradient-to-tr from-ink/45 via-transparent to-transparent" />

        <Container
          size="xl"
          className="relative flex h-full flex-col justify-end pb-12 md:pb-20"
        >
          <div className="max-w-[680px] space-y-6 text-bg md:space-y-8">
            <Logo variant="primary" size="lg" tagline="stacked" tone="light" asStatic />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-bg/80">
              {t.about.heroEyebrow}
            </p>
            <h1 className="text-balance whitespace-pre-line font-display text-[40px] font-semibold leading-[1.06] tracking-tight md:text-[60px] lg:text-[68px]">
              {t.about.heroTitle}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-bg/85 md:text-lg">
              {t.about.heroBody}
            </p>
          </div>
        </Container>
      </div>
    </section>
  );
}
