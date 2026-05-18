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
    <section className="relative overflow-hidden bg-bg">
      <div className="relative h-[64vh] min-h-[480px] w-full md:h-[72vh] md:min-h-[560px]">
        <Image
          src="https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=2400&q=85"
          alt={t.about.heroEyebrow}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/*
         * Cream-warm overlay system — matches the /sugarbear editorial
         * register. Photographs sit beneath a cream wash instead of an
         * ink overlay so the brand feels luxe-pharmacy, not magazine-cover.
         *   • Bottom wash: cream fade so deep-espresso copy is legible
         *     against the photo.
         *   • Top-corner tint: a soft champagne wash brings the photo
         *     into the cream palette of the rest of the site.
         */}
        <div className="absolute inset-0 bg-gradient-to-b from-bg/15 via-bg/40 to-bg/85" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(80% 60% at 80% 0%, rgba(199,162,124,0.22) 0%, transparent 60%)",
          }}
        />

        <Container
          size="xl"
          className="relative flex h-full flex-col justify-end pb-12 md:pb-20"
        >
          <div className="max-w-[680px] space-y-6 text-ink md:space-y-8">
            <Logo variant="primary" size="lg" tagline="stacked" tone="auto" asStatic />
            <p className="fn-eyebrow">
              <span className="fn-rule" />
              <span>{t.about.heroEyebrow}</span>
            </p>
            <h1 className="text-balance whitespace-pre-line font-display text-[40px] font-semibold leading-[1.06] tracking-tight md:text-[60px] lg:text-[68px]">
              {t.about.heroTitle}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted md:text-lg">
              {t.about.heroBody}
            </p>
          </div>
        </Container>
      </div>
    </section>
  );
}
