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
          className="relative flex h-full flex-col justify-end pb-14 md:pb-24 lg:pb-28"
        >
          <div className="max-w-[760px] space-y-6 text-bg md:space-y-8">
            {/* Brand flourish — the recurring signature mark */}
            <Flourish width={88} className="text-accent" />

            {/* 1 · Eyebrow — positioning line */}
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bg/85 md:text-xs">
              {t.home.heroEyebrow}
            </p>

            {/* 2 · Headline — Pain + Cause */}
            <h1 className="text-balance whitespace-pre-line font-display text-[44px] font-semibold leading-[0.98] tracking-[-0.02em] md:text-[72px] lg:text-[92px]">
              {t.home.heroTitle}
            </h1>

            {/* 3 · Subheadline — Solution + Result */}
            <p className="max-w-[580px] text-[15px] leading-relaxed text-bg/85 md:text-[19px]">
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
                className="group inline-flex h-13 items-center gap-2.5 rounded-md bg-bg px-9 text-sm font-semibold text-ink transition-all duration-200 ease-premium hover:bg-bg/95 hover:gap-3.5 md:h-14 md:px-11 md:text-base"
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
