"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Wordmark, Flourish } from "@/components/brand";
import { useLocale } from "@/hooks/useLocale";
import { useInView } from "@/hooks/useInView";
import { cn } from "@/lib/cn";
import { feelings } from "@/data/feelings";
import { pickLocalized } from "@/lib/format";
import { track } from "@/lib/analytics";

/**
 * "هذا أنا" — problem-identification tiles.
 *
 * Each tile is a self-recognition moment in the customer's own
 * words. The label is the PROBLEM, the caption is the SOLUTION,
 * the click routes to the product. This is the canonical Saudi
 * DR moment — "this is me" — and it's what converts cold traffic
 * into a click far better than a generic "Shop by category" tray.
 *
 * The 4th tile is **branded** rather than imaged: it renders the
 * wordmark + offer in rose-copper instead of stock photography.
 * That gives the page a recurring brand-identity moment (the
 * wordmark literally appears mid-scroll) and turns the highest-
 * AOV tile into a self-contained offer card — no chair-shaped
 * stock photo can sneak in.
 */
export function ShopByFeeling() {
  const { t, locale } = useLocale();
  const { ref: headerRef, inView: headerVisible } = useInView();
  const { ref: gridRef, inView: gridVisible } = useInView({ rootMargin: "0px 0px -40px 0px" });

  return (
    <section className="fn-section-y bg-bg">
      <Container>
        <header
          ref={headerRef as React.RefObject<HTMLElement>}
          className={cn("reveal mb-10 max-w-2xl md:mb-14", headerVisible && "in-view")}
        >
          <Flourish width={56} className="mb-4 text-accent md:w-[80px] md:mb-5" />
          <p className="fn-eyebrow-step">
            <span className="fn-step-num">01</span>
            <span className="fn-step-rule" />
            <span>{t.home.shopByFeelingEyebrow}</span>
          </p>
          <h2 className="fn-section-title mt-4 md:mt-5">
            {t.home.shopByFeelingTitle}
          </h2>
          <p className="fn-section-lede mt-4 md:mt-5">
            {t.home.shopByFeelingBody}
          </p>
        </header>

        <ul
          ref={gridRef as React.RefObject<HTMLUListElement>}
          className={cn(
            "reveal grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4 lg:gap-6",
            gridVisible && "in-view"
          )}
          style={{ transitionDelay: "100ms" }}
        >
          {feelings.map((f) => (
            <li key={f.id}>
              <Link
                href={f.href}
                onClick={() =>
                  track("view_item", { surface: "shop_by_feeling", id: f.id })
                }
                className="group relative block aspect-[4/5] overflow-hidden rounded-2xl shadow-[0_8px_22px_rgba(31,24,21,0.08)] hover-lift focus-ring"
              >
                {f.branded ? (
                  /* ──────────────── Branded card variant ──────────────── */
                  <div className="relative h-full w-full bg-ink text-bg">
                    {/* Rose-copper radial — pulls the eye to the wordmark */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_50%_30%,rgba(186,110,92,0.32),transparent_70%)]"
                    />
                    <div className="relative flex h-full flex-col items-center justify-between p-4 text-center md:p-7">
                      {/* Save badge */}
                      {f.saveBadge ? (
                        <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-accent ring-1 ring-accent/30 backdrop-blur-sm md:px-3 md:py-1 md:text-[11px]">
                          {pickLocalized(f.saveBadge, locale)}
                        </span>
                      ) : null}

                      {/* Wordmark + offer */}
                      <div className="my-auto flex flex-col items-center gap-2 md:gap-4">
                        <Wordmark size="md" tone="light" />
                        <Flourish width={48} className="text-accent md:w-[72px]" />
                        {f.amount ? (
                          <p className="font-display text-2xl font-semibold tracking-tight md:text-4xl">
                            {pickLocalized(f.amount, locale)}
                          </p>
                        ) : null}
                        <p className="text-[11px] leading-snug text-bg/75 md:max-w-[180px] md:text-[13px]">
                          {pickLocalized(f.caption, locale)}
                        </p>
                      </div>

                      {/* CTA pill */}
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-bg/95 md:text-[13px]">
                        {pickLocalized(f.label, locale)}
                        <ArrowLeft className="size-3.5 ltr:rotate-180 transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                ) : (
                  /* ──────────────── Image card variant ──────────────── */
                  <>
                    <div className="absolute inset-0 bg-brand-soft">
                      <Image
                        src={f.image.src}
                        alt={pickLocalized(f.image.alt, locale)}
                        fill
                        sizes="(min-width: 1024px) 320px, 50vw"
                        className="object-cover transition-transform duration-700 ease-premium group-hover:scale-[1.06]"
                      />
                    </div>
                    {/* Bottom gradient to lift label off any image */}
                    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />

                    <div className="absolute inset-x-0 bottom-0 p-3.5 text-bg md:p-5">
                      <h3 className="font-display text-[17px] font-semibold leading-tight tracking-tight md:text-2xl">
                        {pickLocalized(f.label, locale)}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-bg/80 md:text-[13px]">
                        {pickLocalized(f.caption, locale)}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-bg/95 opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:text-[13px]">
                        {locale === "ar" ? "اكتشف" : "Explore"}
                        <ArrowLeft className="size-3.5 ltr:rotate-180" />
                      </span>
                    </div>
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
