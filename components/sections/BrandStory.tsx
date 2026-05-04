"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

/**
 * Editorial brand story panel — split image + text.
 *
 * Premium pattern: heavy whitespace, single sentence "hook" set in the
 * display face, quiet body copy below. The image is intentionally large
 * to signal confidence. No badges, no testimonials here — those live elsewhere.
 */
export function BrandStory() {
  const { t } = useLocale();
  return (
    <section className="bg-bg py-20 md:py-32">
      <Container>
        <div className="grid items-center gap-10 md:grid-cols-12 md:gap-16">
          <figure className="relative order-2 aspect-[4/5] overflow-hidden rounded-md bg-brand-soft shadow-card md:order-1 md:col-span-5">
            <Image
              src="https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=1400&q=85"
              alt={t.home.storyEyebrow}
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
            />
          </figure>

          <div className="order-1 space-y-6 md:order-2 md:col-span-7 md:ps-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {t.home.storyEyebrow}
            </p>
            <p className="text-base text-muted md:text-lg">{t.home.storyTitle}</p>
            <h2 className="text-balance font-display text-3xl font-semibold leading-[1.12] tracking-tight md:text-5xl">
              {t.home.storyHook}
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-muted md:text-[17px]">
              {t.home.storyBody}
            </p>
            <Link
              href="/about"
              className="group inline-flex items-center gap-2 pt-2 text-sm font-medium text-ink"
            >
              <span className="border-b border-ink/40 pb-0.5 transition-colors group-hover:border-ink">
                {t.home.storyCta}
              </span>
              <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 rtl:group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
