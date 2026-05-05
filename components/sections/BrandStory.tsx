"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Flourish } from "@/components/brand";
import { useLocale } from "@/hooks/useLocale";
import { siteConfig } from "@/data/site";
import { pickLocalized } from "@/lib/format";

/**
 * Editorial brand story — split image + text, with a wordmark watermark.
 *
 * The wordmark "فناء" is rendered in massive low-opacity Naskh behind
 * the image column. It bleeds slightly off the edge of the section so
 * the brand name appears at scale mid-scroll — a recurring identity
 * moment, not a logo print. This is the move every premium DTC brand
 * uses on their about-the-product page (Aesop, Tata Harper, Glossier).
 *
 * The numbered eyebrow ("05 — حكايتنا") plus the Flourish above the
 * H2 anchors this section into the page's editorial rhythm.
 */
export function BrandStory() {
  const { t, locale } = useLocale();
  const wordmark = pickLocalized(siteConfig.name, locale);
  const isAr = locale === "ar";

  return (
    <section className="relative overflow-hidden bg-bg py-24 md:py-36">
      {/* ─────────── Wordmark watermark — recurring brand identity ─────────── */}
      <span
        aria-hidden
        className={`pointer-events-none absolute top-1/2 select-none whitespace-nowrap text-[180px] font-bold leading-none tracking-tight text-accent/[0.045] md:text-[280px] lg:text-[360px] ${
          isAr
            ? "-translate-y-1/2 right-[-6%] font-arabic-display"
            : "-translate-y-1/2 left-[-4%] font-display"
        }`}
      >
        {wordmark}
      </span>

      <Container>
        <div className="relative grid items-center gap-12 md:grid-cols-12 md:gap-16">
          <figure className="relative order-2 aspect-[4/5] overflow-hidden rounded-md bg-brand-soft shadow-card md:order-1 md:col-span-5">
            <Image
              src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1400&q=85"
              alt={t.home.storyEyebrow}
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover object-center"
            />
          </figure>

          <div className="order-1 space-y-6 md:order-2 md:col-span-7 md:ps-8">
            <Flourish width={88} className="text-accent" />

            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em]">
              <span className="text-accent/60">05</span>
              <span className="h-px w-6 bg-line" aria-hidden />
              <span className="text-accent">{t.home.storyEyebrow}</span>
            </div>

            <p className="text-base text-muted md:text-lg">{t.home.storyTitle}</p>

            <h2 className="text-balance font-display text-4xl font-semibold leading-[1.05] tracking-[-0.01em] md:text-5xl lg:text-[58px]">
              {t.home.storyHook}
            </h2>

            <p className="max-w-xl text-base leading-relaxed text-muted md:text-[17px]">
              {t.home.storyBody}
            </p>

            <Link
              href="/about"
              className="group inline-flex items-center gap-2 pt-2 text-sm font-medium text-ink"
            >
              <span className="border-b border-ink/40 pb-0.5 transition-colors group-hover:border-accent group-hover:text-accent">
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
