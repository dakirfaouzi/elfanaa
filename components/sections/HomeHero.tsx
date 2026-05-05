"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

/**
 * Health & Beauty hero — full-bleed, Pain → Cause → Solution → Result.
 *
 * CRO structure (Hims / The Ordinary / Keeps direct-response pattern):
 *   1. Eyebrow         — single declarative positioning line
 *                        ("Made for your skin. Tested for our sun.")
 *   2. Headline        — Pain + Cause crystallized in one breath
 *                        ("Spots, breakage, dull skin... not your genes,
 *                          the product.")
 *   3. Subheadline     — Solution + Result + KSA climate proof
 *   4. COD trust badge — the #1 KSA conversion signal, BEFORE the CTA
 *   5. Primary CTA     — single action verb, no competing buttons
 *   6. Social-proof line — quantified credibility under the CTA
 *
 * The eyebrow + secondary-line wrapper around the CTA is what turns a
 * generic hero into a Saudi DR funnel. Every element pulls toward the
 * same micro-decision: tap the CTA.
 *
 * Image: skincare close-up — explicitly NOT furniture. Two overlays
 * (bottom gradient for text legibility, corner gradient for logo
 * contrast) preserve the warmth of the photo without dimming it
 * to the point that the beauty context is lost.
 */
export function HomeHero() {
  const { t, locale } = useLocale();
  const isAr = locale === "ar";

  return (
    <section className="relative overflow-hidden bg-brand-soft">
      <div className="relative h-[86vh] min-h-[600px] w-full md:h-[92vh] md:min-h-[680px]">
        <Image
          src="https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=2400&q=85"
          alt={
            isAr
              ? "منتجات عناية فناء — سيروم، زيت لحية، وقناع شعر"
              : "Fanaa skincare products — serum, beard oil and hair mask"
          }
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />

        {/* Layered overlays — preserve image warmth, lift text */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/0 via-ink/15 to-ink/75" />
        <div className="absolute inset-0 bg-gradient-to-tr from-ink/55 via-transparent to-transparent" />

        <Container
          size="xl"
          className="relative flex h-full flex-col justify-end pb-12 md:pb-20 lg:pb-24"
        >
          <div className="max-w-[720px] space-y-5 text-bg md:space-y-7">
            {/* 1 · Eyebrow — positioning line */}
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bg/85 md:text-xs">
              {t.home.heroEyebrow}
            </p>

            {/* 2 · Headline — Pain + Cause */}
            <h1 className="text-balance whitespace-pre-line font-display text-[38px] font-semibold leading-[1.05] tracking-tight md:text-[60px] lg:text-[72px]">
              {t.home.heroTitle}
            </h1>

            {/* 3 · Subheadline — Solution + Result */}
            <p className="max-w-[560px] text-[15px] leading-relaxed text-bg/85 md:text-[18px]">
              {t.home.heroSubtitle}
            </p>

            {/* 4 · COD trust badge — shown BEFORE the CTA (KSA #1 signal) */}
            <div className="inline-flex items-center gap-2 rounded-full bg-bg/15 px-4 py-2 text-[13px] font-medium text-bg backdrop-blur-sm md:text-sm">
              <ShieldCheck className="size-4 shrink-0 text-bg/90" strokeWidth={2} />
              {isAr
                ? "ادفع عند الاستلام — ما تدفع ريال قبل ما توصل"
                : "Cash on delivery — don't pay a riyal until it arrives"}
            </div>

            {/* 5 · Primary CTA + 6 · social proof */}
            <div className="flex flex-col items-start gap-4 pt-1 md:gap-5 md:pt-2">
              <Link
                href="/shop"
                className="group inline-flex h-13 items-center gap-2.5 rounded-md bg-bg px-8 text-sm font-semibold text-ink transition-all duration-200 ease-premium hover:bg-bg/95 hover:gap-3.5 md:h-14 md:px-10 md:text-base"
              >
                {t.home.heroCta}
                <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5 ltr:rotate-180 rtl:group-hover:translate-x-0.5" />
              </Link>

              <p className="inline-flex items-center gap-2 text-xs text-bg/75 md:text-[13px]">
                <span className="inline-block size-1.5 rounded-full bg-success" aria-hidden />
                {t.home.heroCtaSecondary}
              </p>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
