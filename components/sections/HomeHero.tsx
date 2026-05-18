"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Flourish } from "@/components/brand";
import { useLocale } from "@/hooks/useLocale";

/**
 * Home hero — GCC luxury editorial.
 *
 * Composition (mirrors the /sugarbear reference identity):
 *   • Mobile: image FIRST (top), then editorial column.
 *   • Desktop: editorial column LEFT, framed photograph RIGHT.
 *
 * Reading flow inside the editorial column:
 *   1. Eyebrow + gold rule    — quiet positioning ("Made for your skin…")
 *   2. Headline               — Pain + Cause in one breath
 *   3. Subheadline            — Solution + KSA climate proof
 *   4. COD trust pill         — gold-hairline pill on cream
 *   5. Primary CTA            — deep espresso with whisper-gold glow
 *   6. Social-proof line      — quantified credibility under the CTA
 *
 * Logic surface — everything functional from the prior hero is preserved:
 *   • i18n keys (`t.home.heroEyebrow / heroTitle / heroSubtitle / heroCta /
 *     heroCtaSecondary`)
 *   • Single CTA → /shop
 *   • Hero image asset (unchanged)
 *   • <Flourish/> brand mark
 *   • COD trust pill on mobile + desktop variants
 *
 * Only the *visual treatment* changed — from a dark-overlay full-bleed photo
 * to a warm cream editorial split that aligns the storefront with the
 * /sugarbear reference identity.
 */
export function HomeHero() {
  const { t, locale } = useLocale();
  const isAr = locale === "ar";

  return (
    <section
      aria-labelledby="home-hero-title"
      className="relative overflow-hidden fn-bg-editorial"
    >
      {/* Decorative gold hairline at the top edge — the editorial handshake. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(199,162,124,0.45), transparent)",
        }}
      />

      <Container size="xl" className="relative">
        <div className="grid items-center gap-10 py-12 md:gap-16 md:py-20 lg:grid-cols-12 lg:gap-20 lg:py-28">

          {/* ─── EDITORIAL COLUMN ──────────────────────────────────────
            *   Mobile: order-2 → below the image (image leads visually).
            *   Desktop: order-1 lg:col-span-6 → editorial sits left.
            * ─────────────────────────────────────────────────────────── */}
          <div className="order-2 lg:order-1 lg:col-span-6">
            <Flourish
              width={64}
              className="animate-rise text-accent [animation-delay:0ms] md:w-[72px]"
            />

            {/* 1 · Eyebrow — gold rule + small-caps tracking */}
            <p className="fn-eyebrow animate-rise mt-5 [animation-delay:150ms]">
              <span className="fn-rule" />
              <span>{t.home.heroEyebrow}</span>
            </p>

            {/* 2 · Headline — editorial serif on deep espresso */}
            <h1
              id="home-hero-title"
              className="animate-rise mt-5 text-balance whitespace-pre-line font-display text-[34px] font-semibold leading-[1.06] tracking-[-0.01em] text-ink [animation-delay:300ms] sm:text-[44px] md:mt-6 md:text-[60px] lg:text-[72px]"
            >
              {t.home.heroTitle}
            </h1>

            {/* 3 · Subheadline — full-weight muted, generous leading */}
            <p className="animate-rise mt-5 max-w-[520px] text-[14px] leading-[1.85] text-muted [animation-delay:480ms] md:mt-6 md:text-[17px]">
              {t.home.heroSubtitle}
            </p>

            {/*
             * 4 · COD trust pill — warm cream pill with a gold hairline.
             * Long Arabic copy is split into mobile-short / desktop-full
             * variants so the pill never stretches beyond the column.
             */}
            <div
              className="animate-rise mt-6 inline-flex max-w-full items-center gap-2 rounded-full bg-bg/85 px-3.5 py-1.5 text-[12px] font-medium text-ink shadow-[0_6px_14px_rgba(199,162,124,0.10)] [animation-delay:580ms] backdrop-blur-sm md:mt-7 md:px-4 md:py-2 md:text-[13px]"
              style={{
                border: "1px solid rgba(199,162,124,0.28)",
              }}
            >
              <ShieldCheck
                className="size-3.5 shrink-0 text-accent md:size-4"
                strokeWidth={2}
              />
              <span className="md:hidden">
                {isAr ? "ادفع عند الاستلام" : "Cash on delivery"}
              </span>
              <span className="hidden md:inline">
                {isAr
                  ? "ادفع عند الاستلام — ما تدفع ريال قبل ما توصل"
                  : "Cash on delivery — don't pay a riyal until it arrives"}
              </span>
            </div>

            {/* 5 · Primary CTA + 6 · social proof line */}
            <div className="animate-rise mt-7 flex flex-col items-start gap-3 [animation-delay:680ms] md:mt-8 md:gap-5">
              <Link
                href="/shop"
                className="btn-press fn-cta-glow group flex w-full items-center justify-center gap-2.5 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-bg transition-all duration-300 ease-premium hover:gap-3.5 sm:inline-flex sm:w-auto sm:px-9 sm:py-0 md:h-14 md:px-11 md:text-base"
                style={{
                  boxShadow:
                    "0 16px 40px rgba(31,24,21,0.18), 0 0 0 1px rgba(199,162,124,0.30)",
                }}
              >
                {t.home.heroCta}
                <ArrowLeft className="size-4 shrink-0 transition-transform duration-300 ease-premium group-hover:-translate-x-0.5 ltr:rotate-180 rtl:group-hover:translate-x-0.5" />
              </Link>

              <p className="inline-flex items-center gap-2 text-[11px] text-muted md:text-[13px]">
                <span
                  className="inline-block size-1.5 shrink-0 rounded-full bg-success"
                  aria-hidden
                />
                {t.home.heroCtaSecondary}
              </p>
            </div>
          </div>

          {/* ─── EDITORIAL PHOTO ─────────────────────────────────────── */}
          <div className="order-1 lg:order-2 lg:col-span-6">
            <div className="relative mx-auto w-full max-w-[540px]">
              {/* Soft champagne halo behind the frame */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-[12%] rounded-[40px] blur-[28px]"
                style={{
                  background:
                    "radial-gradient(60% 55% at 50% 35%, rgba(224,198,165,0.55) 0%, rgba(224,198,165,0) 65%), " +
                    "radial-gradient(50% 60% at 15% 80%, rgba(199,162,124,0.22) 0%, rgba(199,162,124,0) 65%)",
                }}
              />

              {/* Editorial photograph frame */}
              <div className="fn-photo-frame relative aspect-[4/5] overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1600&q=90"
                  alt={
                    isAr
                      ? "قطرة سيروم ذهبية تنزل في ضوء دافئ — رمز عناية فناء"
                      : "A golden serum droplet falling in warm light — Fanaa care, abstracted"
                  }
                  fill
                  priority
                  sizes="(min-width: 1024px) 540px, (min-width: 640px) 80vw, 100vw"
                  className="object-cover"
                  style={{ objectPosition: "center 30%" }}
                />
                {/* Whisper vignette — top + bottom edges melt into the cream */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(244,239,230,0.05) 0%, transparent 22%, transparent 78%, rgba(244,239,230,0.20) 100%)",
                  }}
                />
              </div>

              {/* Caption beneath the photograph — italic editorial line */}
              <div className="mt-3 flex items-center justify-center gap-3 text-muted">
                <span
                  aria-hidden
                  className="h-px w-7"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(199,162,124,1), transparent)",
                  }}
                />
                <span className="font-display italic text-[13px] tracking-[0.02em] md:text-[15px]">
                  {isAr ? "طقس جمالي يومي" : "Your daily ritual"}
                </span>
                <span
                  aria-hidden
                  className="h-px w-7"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(199,162,124,1), transparent)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
