import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { collections } from "@/data/collections";

/**
 * Homepage editorial collection row.
 *
 * Three portrait cards — one per main collection — with editorial hero
 * imagery, the premium Arabic collection name, a functional tagline,
 * and an "اكتشف" CTA. Cards link to the canonical collection pages
 * (/collections/[slug]) rather than the filtered shop URL, so each
 * collection gets its own SEO-indexed landing page.
 *
 * Horizontal scroll on mobile, 3-column grid on desktop.
 * Server component — no interactivity needed.
 */
export function CollectionRow() {
  return (
    <section className="fn-section-y bg-bg">
      <Container>
        {/* Section header */}
        <header className="mb-10 flex items-end justify-between gap-6 md:mb-14">
          <div>
            <p className="fn-eyebrow-step">
              <span className="fn-step-num">03</span>
              <span className="fn-step-rule" />
              <span>المجموعات</span>
            </p>
            <h2 className="fn-section-title mt-4 md:mt-5">
              {"ابدأ من مشكلتك.\nالمنتج يجيك هو."}
            </h2>
          </div>
          <Link
            href="/shop"
            className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-ink/70 transition-colors hover:text-ink md:inline-flex"
          >
            كل المنتجات
            <ArrowLeft className="size-4 ltr:rotate-180" />
          </Link>
        </header>

        {/*
         * Horizontal scroll on mobile — `w-full overflow-hidden` on the
         * Container prevents the list from becoming a page-level overflow source.
         * Each card is 78vw (max 280px) on mobile so users can see a peek of
         * the next card, signalling scrollability.
         */}
        <ul className="flex w-full gap-4 overflow-x-auto pb-3 scrollbar-none md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0">
          {collections.map((collection, i) => (
            <li key={collection.id} className="w-[78vw] max-w-[280px] shrink-0 md:w-auto md:max-w-none">
              <Link
                href={`/collections/${collection.slug}`}
                className="group relative block aspect-[3/4] overflow-hidden rounded-2xl shadow-[0_8px_24px_rgba(31,24,21,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {/* Editorial image */}
                {collection.heroImage ? (
                  <Image
                    src={collection.heroImage}
                    alt={collection.title.ar}
                    fill
                    sizes="(min-width: 768px) 33vw, 72vw"
                    className="object-cover object-center transition-transform duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:scale-[1.04]"
                    priority={i === 0}
                  />
                ) : (
                  <div className="absolute inset-0 bg-brand-soft" />
                )}

                {/*
                 * Tri-layer overlay: top cream tint pulls the index numeral
                 * into the warm palette, bottom espresso wash carries the
                 * title legibility, gold corner whisper adds the editorial
                 * handshake.
                 */}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/88 via-ink/24 to-transparent" />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-b from-ink/24 via-transparent to-transparent"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(60% 35% at 90% 8%, rgba(199,162,124,0.30) 0%, transparent 60%)",
                  }}
                />

                {/* Index number — subtle premium touch (numeric editorial mark) */}
                <span className="absolute start-4 top-4 font-display text-[12px] italic tabular-nums text-bg/70 md:start-5 md:top-5 md:text-[13px]">
                  {String(i + 1).padStart(2, "0")}
                </span>

                {/* Content overlay */}
                <div className="absolute inset-x-0 bottom-0 p-5 md:p-8">
                  <h3
                    className="font-display text-[26px] font-semibold leading-[1.05] tracking-[-0.01em] text-bg md:text-[32px]"
                    dir="rtl"
                  >
                    {collection.title.ar}
                  </h3>
                  {collection.tagline && (
                    <p className="mt-2 text-[12.5px] text-bg/70 md:text-[14px]">
                      {collection.tagline.ar}
                    </p>
                  )}

                  {/* CTA — always visible on mobile, animated on desktop hover */}
                  <span className="mt-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-bg/95 transition-all duration-300 md:mt-4 md:text-[13px] md:opacity-0 md:group-hover:opacity-100">
                    اكتشف المجموعة
                    <ArrowLeft className="size-3.5 ltr:rotate-180" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {/* Mobile "all products" link */}
        <div className="mt-7 flex justify-center md:hidden">
          <Link
            href="/shop"
            className="inline-flex h-[46px] items-center gap-2 rounded-full border border-line bg-bg px-6 text-[14px] font-semibold text-ink shadow-[0_6px_16px_rgba(31,24,21,0.06)] transition-colors hover:border-accent/40"
          >
            كل المنتجات
            <ArrowLeft className="size-4 ltr:rotate-180" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
