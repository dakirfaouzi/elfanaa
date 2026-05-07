"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Flourish } from "@/components/brand";
import { useLocale } from "@/hooks/useLocale";

/**
 * Health & Beauty hero — full-bleed, Pain → Cause → Solution → Result.
 *
 * CRO structure (Hims / The Ordinary / Keeps direct-response pattern):
 *   1. Eyebrow         — single declarative positioning line
 *                        ("Made for your skin. Tested for our sun.")
 *   2. Headline        — Pain + Cause crystallized in one breath
 *   3. Subheadline     — Solution + Result + KSA climate proof
 *   4. COD trust badge — the #1 KSA conversion signal, BEFORE the CTA
 *   5. Primary CTA     — single action verb, no competing buttons
 *   6. Social-proof line — quantified credibility under the CTA
 *
 * The eyebrow + Flourish + secondary-line wrapper around the CTA is
 * what turns a generic hero into a Saudi DR funnel. Every element
 * pulls toward the same micro-decision: tap the CTA.
 *
 * Image: a golden-rose serum droplet macro — the imagery deliberately
 * does NOT show a face. Faces tie the brand to one demographic; an
 * abstract texture lets every Saudi customer (men, women, all skin
 * tones) project themselves into the picture.  The warm rose-gold
 * lighting matches the brand palette directly so the photo reads as
 * an extension of the brand, not stock photography.
 */
export function HomeHero() {
  const { t, locale } = useLocale();
  const isAr = locale === "ar";

  return (
    <section className="relative overflow-hidden bg-ink">
      <div className="relative h-[88vh] min-h-[620px] w-full md:h-[94vh] md:min-h-[720px]">
        <Image
          src="https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=2400&q=90"
          alt={
            isAr
              ? "قطرة سيروم ذهبية تنزل في ضوء دافئ — رمز عناية فناء"
              : "A golden serum droplet falling in warm light — Fanaa care, abstracted"
          }
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />

        {/* Layered overlays — preserve image warmth, lift text */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/35 to-ink/85" />
        <div className="absolute inset-0 bg-gradient-to-tr from-ink/60 via-ink/10 to-transparent" />

        <Container
          size="xl"
          className="relative flex h-full flex-col justify-end pb-12 md:pb-24 lg:pb-28"
        >
          {/* Staggered entrance — each element rises in sequence */}
          <div className="w-full max-w-[720px] text-bg">
            {/* Brand flourish */}
            <Flourish
              width={64}
              className="animate-rise text-accent [animation-delay:0ms] md:w-[72px]"
            />

            {/* 1 · Eyebrow */}
            <p className="animate-rise mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-bg/70 [animation-delay:150ms] md:mt-5 md:text-[11px]">
              {t.home.heroEyebrow}
            </p>

            {/* 2 · Headline */}
            <h1 className="animate-rise mt-3 text-balance whitespace-pre-line font-display text-[28px] font-semibold leading-[1.06] tracking-[-0.02em] [animation-delay:300ms] sm:text-[36px] md:mt-5 md:text-[60px] lg:text-[76px]">
              {t.home.heroTitle}
            </h1>

            {/* 3 · Subheadline — constrained line-width for mobile readability */}
            <p className="animate-rise mt-4 text-[13px] leading-relaxed text-bg/75 [animation-delay:480ms] sm:max-w-[460px] md:text-[17px]">
              {t.home.heroSubtitle}
            </p>

            {/*
             * 4 · COD trust badge
             * Long Arabic text at 13px overflows a 375px viewport with px-4.
             * Fix: split into mobile-short / desktop-full variants so the pill
             * never stretches beyond the container.
             */}
            <div className="animate-rise mt-4 inline-flex max-w-full items-center gap-2 rounded-full bg-bg/15 px-3.5 py-1.5 text-[12px] font-medium text-bg [animation-delay:580ms] backdrop-blur-sm md:mt-5 md:px-4 md:py-2 md:text-[13px]">
              <ShieldCheck className="size-3.5 shrink-0 text-bg/90 md:size-4" strokeWidth={2} />
              <span className="md:hidden">
                {isAr ? "ادفع عند الاستلام" : "Cash on delivery"}
              </span>
              <span className="hidden md:inline">
                {isAr
                  ? "ادفع عند الاستلام — ما تدفع ريال قبل ما توصل"
                  : "Cash on delivery — don't pay a riyal until it arrives"}
              </span>
            </div>

            {/* 5 · Primary CTA + 6 · social proof */}
            <div className="animate-rise mt-6 flex flex-col items-start gap-3 [animation-delay:680ms] md:gap-5">
              {/*
               * Full-width on mobile for thumb-tap ease; auto-width on sm+.
               * `justify-center` keeps content centred when block-level.
               */}
              <Link
                href="/shop"
                className="btn-press group flex w-full items-center justify-center gap-2.5 rounded-md bg-bg px-6 py-3.5 text-sm font-semibold text-ink transition-all duration-300 ease-premium hover:bg-bg/95 hover:gap-3.5 sm:inline-flex sm:w-auto sm:px-9 sm:py-0 md:h-14 md:px-11 md:text-base"
              >
                {t.home.heroCta}
                <ArrowLeft className="size-4 shrink-0 transition-transform duration-300 ease-premium group-hover:-translate-x-0.5 ltr:rotate-180 rtl:group-hover:translate-x-0.5" />
              </Link>

              <p className="inline-flex items-center gap-2 text-[11px] text-bg/70 md:text-[13px]">
                <span className="inline-block size-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                {t.home.heroCtaSecondary}
              </p>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
