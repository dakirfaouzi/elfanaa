"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { feelings } from "@/data/feelings";
import { pickLocalized } from "@/lib/format";
import { track } from "@/lib/analytics";

/**
 * "Shop by Feeling" — mood-led category entry, Pottery Barn / Article style.
 *
 * Layout: 4 tiles, 2-up on mobile, 4-up on desktop, taller cards (4:5)
 * to mimic editorial photography. Image fills the card; label sits in the
 * thumb-zone with a subtle gradient.
 */
export function ShopByFeeling() {
  const { t, locale } = useLocale();

  return (
    <section className="py-16 md:py-24">
      <Container>
        <header className="mb-10 max-w-2xl md:mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            {t.home.shopByFeelingEyebrow}
          </p>
          <h2 className="mt-2 whitespace-pre-line font-display text-3xl font-semibold leading-[1.1] tracking-tight md:text-4xl lg:text-5xl">
            {t.home.shopByFeelingTitle}
          </h2>
        </header>

        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
          {feelings.map((f) => (
            <li key={f.id}>
              <Link
                href={f.href}
                onClick={() => track("view_item", { surface: "shop_by_feeling", id: f.id })}
                className="group relative block aspect-[4/5] overflow-hidden rounded-md bg-brand-soft shadow-card hover-lift focus-ring"
              >
                <Image
                  src={f.image.src}
                  alt={pickLocalized(f.image.alt, locale)}
                  fill
                  sizes="(min-width: 1024px) 320px, 50vw"
                  className="object-cover transition-transform duration-700 ease-premium group-hover:scale-[1.06]"
                />
                {/* Bottom gradient to lift label off any image */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-4 text-bg md:p-5">
                  <h3 className="font-display text-xl font-semibold tracking-tight md:text-2xl">
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
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
