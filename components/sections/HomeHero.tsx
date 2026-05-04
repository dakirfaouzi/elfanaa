"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Logo } from "@/components/brand";
import { useLocale } from "@/hooks/useLocale";

/**
 * Premium full-bleed hero.
 *
 * Composition is intentionally tight — Pottery Barn / Article research and
 * NN/g hero studies both find that the highest-converting luxury heroes
 * carry exactly **three text moments**:
 *
 *   1. Brand lockup — wordmark + tagline (medium, low-opacity tagline).
 *   2. The headline — biggest, most dominant text on the page.
 *   3. One CTA — singular, never paired with a competing button.
 *
 * Tagline appears here (one of only three brand-tagline surfaces) because
 * the hero is the moment where the customer decides "this brand has a
 * point of view." The tagline carries that point of view.
 *
 * Image carries the rest of the brand feeling — late-afternoon warm light,
 * an architectural Saudi courtyard, no people facing the camera.
 */
export function HomeHero() {
  const { t } = useLocale();
  return (
    <section className="relative overflow-hidden bg-brand-soft">
      <div className="relative h-[78vh] min-h-[560px] w-full md:h-[88vh] md:min-h-[640px]">
        <Image
          src="https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=2400&q=85"
          alt="Premium health and beauty products on a clean surface with warm natural light"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />

        {/* Layered, brand-warm overlays — never harsh black.
            The first reaches the bottom for text legibility; the second
            shades the top corner so the brand lockup reads cleanly. */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/0 via-ink/15 to-ink/65" />
        <div className="absolute inset-0 bg-gradient-to-tr from-ink/45 via-transparent to-transparent" />

        <Container
          size="xl"
          className="relative flex h-full flex-col justify-end pb-12 md:pb-20 lg:pb-24"
        >
          <div className="max-w-[680px] space-y-7 text-bg md:space-y-9">
            {/* 1 · Brand lockup — full primary, stacked, on the photographic
                hero. `tone="light"` softens the mark + tagline so the
                wordmark is the dominant brand note. */}
            <Logo
              variant="primary"
              size="lg"
              tagline="stacked"
              tone="light"
              asStatic
            />

            {/* 2 · Dominant headline — the conversion line */}
            <h1 className="text-balance whitespace-pre-line font-display text-[44px] font-semibold leading-[1.04] tracking-tight md:text-[68px] lg:text-[78px]">
              {t.home.heroTitle}
            </h1>

            {/* 3 · Single primary CTA */}
            <div className="pt-1 md:pt-2">
              <Link
                href="/shop"
                className="group inline-flex h-12 items-center gap-2.5 rounded-md bg-bg px-7 text-sm font-medium text-ink transition-all duration-200 ease-premium hover:bg-bg/95 hover:gap-3.5 md:h-14 md:px-9 md:text-base"
              >
                {t.common.shopNow}
                <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5 ltr:rotate-180 rtl:group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
