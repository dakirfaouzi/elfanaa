import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Flourish } from "@/components/brand";
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
    <section className="bg-bg py-16 md:py-24">
      <Container>
        {/* Section header */}
        <header className="mb-10 flex items-end justify-between gap-6 md:mb-12">
          <div>
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em]">
              <Flourish width={44} className="text-accent" />
              <span className="h-px w-5 bg-line" aria-hidden />
              <span className="text-accent">المجموعات</span>
            </div>
            <h2 className="mt-3 whitespace-pre-line font-display text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
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

        {/* Cards — horizontal scroll on mobile */}
        <ul className="flex gap-4 overflow-x-auto pb-2 scrollbar-none md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0">
          {collections.map((collection, i) => (
            <li key={collection.id} className="w-[72vw] shrink-0 md:w-auto">
              <Link
                href={`/collections/${collection.slug}`}
                className="group relative block aspect-[3/4] overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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

                {/* Gradient overlay — cinematic bottom legibility zone */}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/88 via-ink/30 to-transparent" />

                {/* Index number — subtle premium touch */}
                <span className="absolute start-4 top-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-bg/50">
                  {String(i + 1).padStart(2, "0")}
                </span>

                {/* Content overlay */}
                <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                  <h3
                    className="font-display text-[26px] font-semibold leading-[1.05] tracking-[-0.01em] text-bg md:text-[30px]"
                    dir="rtl"
                  >
                    {collection.title.ar}
                  </h3>
                  {collection.tagline && (
                    <p className="mt-1.5 text-[12px] text-bg/65 md:text-[13px]">
                      {collection.tagline.ar}
                    </p>
                  )}

                  {/* CTA — visible on hover */}
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-bg/90 opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:text-[13px]">
                    اكتشف المجموعة
                    <ArrowLeft className="size-3.5 ltr:rotate-180" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {/* Mobile "all products" link */}
        <div className="mt-6 flex justify-center md:hidden">
          <Link
            href="/shop"
            className="text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline"
          >
            كل المنتجات ←
          </Link>
        </div>
      </Container>
    </section>
  );
}
