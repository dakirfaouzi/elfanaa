"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

/**
 * Health & Beauty hero — full-bleed with problem → solution structure.
 *
 * CRO structure (NN/g + Hims / The Ordinary pattern):
 *   1. Problem hook    — headline surfaces the pain ("دهنت من الشمس؟")
 *   2. Solution bridge — subheadline bridges to product category
 *   3. COD trust badge — the #1 KSA conversion signal, shown BEFORE the CTA
 *   4. Primary CTA     — single action, urgent, not competing with anything
 *
 * Image: skincare routine / beauty products — definitively NOT furniture.
 * We use two overlays (bottom gradient for text, corner gradient for logo)
 * to maintain legibility at every viewport width without darkening the image
 * to the point where the beauty context is lost.
 */
export function HomeHero() {
  const { t, locale } = useLocale();
  const isAr = locale === "ar";

  return (
    <section className="relative overflow-hidden bg-brand-soft">
      <div className="relative h-[82vh] min-h-[580px] w-full md:h-[90vh] md:min-h-[660px]">
        {/* Beauty/skincare hero — warm-lit products on skin texture */}
        <Image
          src="https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=2400&q=85"
          alt={
            isAr
              ? "منتجات عناية فناء — سيروم، زيت، وقناع شعر"
              : "Elfanaa skincare products — serum, oil and hair mask"
          }
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />

        {/* Layered overlays — preserve image warmth, lift text */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/0 via-ink/10 to-ink/70" />
        <div className="absolute inset-0 bg-gradient-to-tr from-ink/50 via-transparent to-transparent" />

        <Container
          size="xl"
          className="relative flex h-full flex-col justify-end pb-12 md:pb-20 lg:pb-28"
        >
          <div className="max-w-[700px] space-y-6 text-bg md:space-y-8">

            {/* 1 · Problem headline — the conversion line */}
            <h1 className="text-balance whitespace-pre-line font-display text-[40px] font-semibold leading-[1.06] tracking-tight md:text-[64px] lg:text-[76px]">
              {t.home.heroTitle}
            </h1>

            {/* 2 · Solution bridge — problem → product category */}
            <p className="max-w-[540px] text-[15px] leading-relaxed text-bg/85 md:text-[18px]">
              {t.home.heroSubtitle}
            </p>

            {/* 3 · COD trust badge — shown BEFORE the CTA (KSA #1 signal) */}
            <div className="inline-flex items-center gap-2 rounded-full bg-bg/15 px-4 py-2 text-[13px] font-medium text-bg backdrop-blur-sm md:text-sm">
              <ShieldCheck className="size-4 shrink-0 text-bg/90" strokeWidth={2} />
              {isAr ? "ادفع عند الاستلام — ما تدفع ريال قبل ما توصلك" : "Cash on delivery — you pay nothing until it arrives"}
            </div>

            {/* 4 · Primary CTA */}
            <div className="pt-1 md:pt-2">
              <Link
                href="/shop"
                className="group inline-flex h-13 items-center gap-2.5 rounded-md bg-bg px-8 text-sm font-semibold text-ink transition-all duration-200 ease-premium hover:bg-bg/95 hover:gap-3.5 md:h-14 md:px-10 md:text-base"
              >
                {isAr ? "اكتشف المنتجات" : "Explore products"}
                <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5 ltr:rotate-180 rtl:group-hover:translate-x-0.5" />
              </Link>
            </div>

          </div>
        </Container>
      </div>
    </section>
  );
}
