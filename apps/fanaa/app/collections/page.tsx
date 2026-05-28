import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { collections, concernCollections } from "@/data/collections";
import { siteConfig } from "@/data/site";
import { pickLocalized } from "@/lib/format";

/*
 * /collections — index of every collection in the storefront.
 *
 * # Why this page exists
 *
 * Before Phase 2.4.1, navigating to `/collections` (no slug) returned
 * a 404. The mega-menu always rendered `/collections/<slug>` links and
 * the footer pointed at `/shop?collection=…`, so internally nothing
 * leaked the bare prefix — but external referrers, sitemap probers,
 * and operator URL-typing all surfaced the dead route in production
 * logs. Adding the index page (instead of a redirect to `/shop`)
 * gives every collection a discoverable parent and lets us host a
 * second-level catalog directory without rebuilding navigation.
 *
 * # Composition
 *
 *   1. Editorial header — eyebrow + Arabic display headline + EN
 *      subhead, matching the homepage section rhythm.
 *   2. Main collections grid — large 3-column tiles reusing the same
 *      CollectionRow card pattern (hero image + index numeral + title
 *      + tagline + CTA). Each tile links to `/collections/<slug>`.
 *   3. Concern collections grid — a denser secondary section so a
 *      buyer who arrives by *problem* (dark spots, dryness, breakage)
 *      lands on the right page without scrolling the homepage first.
 *
 * # Static, server-only
 *
 * No data fetching, no `loadAllCatalogProducts` call here — the page
 * is a pure directory of in-code collection definitions. ISR isn't
 * needed; collections.ts only changes on a code deploy. Keeps the
 * route blazingly fast (~5 KB rendered HTML) and removes any DB hop
 * from the redirect target most external links land on.
 */

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: `المجموعات | ${siteConfig.name.ar}`,
  description:
    "اكتشف مجموعات فناء — العناية بالبشرة، الشعر، والروتين الكامل. مجموعات مرتبطة بالمشكلة، مصممة للرجل والمرأة السعودية.",
};

export default function CollectionsIndexPage() {
  return (
    <div className="pb-20 md:pb-28">
      {/* ── Editorial header ───────────────────────────────────────── */}
      <section className="border-b border-line bg-surface">
        <Container>
          <div className="mx-auto max-w-3xl py-14 text-center md:py-20">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[rgb(var(--color-accent-deep))]">
              المجموعات
            </p>
            <h1 className="mt-3 font-display text-[32px] font-semibold leading-[1.1] tracking-tight md:text-5xl">
              {"اختر طريقك\nإلى عناية أفضل."}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted md:text-[17px]">
              كل مجموعة مبنية حول حالة محدّدة — من سيروم الإشراق لروتين العناية
              الكامل. اختر مجموعتك وابدأ منها.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Main collections ───────────────────────────────────────── */}
      <section className="fn-section-y bg-bg">
        <Container>
          <header className="mb-10 max-w-2xl md:mb-12">
            <p className="fn-eyebrow">
              <span className="fn-rule" />
              <span>الأقسام الرئيسية</span>
            </p>
            <h2 className="fn-section-title mt-4 md:mt-5">
              ابدأ من نوع المنتج
            </h2>
          </header>

          <ul className="grid gap-5 md:grid-cols-3 md:gap-6">
            {collections.map((collection, i) => (
              <li key={collection.id}>
                <Link
                  href={`/collections/${collection.slug}`}
                  className="group relative block aspect-[3/4] overflow-hidden rounded-2xl shadow-[0_8px_24px_rgba(31,24,21,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {collection.heroImage ? (
                    <Image
                      src={collection.heroImage}
                      alt={pickLocalized(collection.title, "ar")}
                      fill
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover object-center transition-transform duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:scale-[1.04]"
                      priority={i === 0}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-brand-soft" />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-ink/88 via-ink/24 to-transparent" />

                  <span className="absolute start-4 top-4 font-display text-[12px] italic tabular-nums text-bg/70 md:start-5 md:top-5 md:text-[13px]">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <div className="absolute inset-x-0 bottom-0 p-5 md:p-8">
                    <h3
                      className="font-display text-[26px] font-semibold leading-[1.05] tracking-[-0.01em] text-bg md:text-[32px]"
                      dir="rtl"
                    >
                      {pickLocalized(collection.title, "ar")}
                    </h3>
                    {collection.tagline ? (
                      <p className="mt-2 text-[12.5px] text-bg/70 md:text-[14px]">
                        {pickLocalized(collection.tagline, "ar")}
                      </p>
                    ) : null}
                    <span className="mt-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-bg/95 transition-all duration-300 md:mt-4 md:text-[13px] md:opacity-0 md:group-hover:opacity-100">
                      اكتشف المجموعة
                      <ArrowLeft className="size-3.5 ltr:rotate-180" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ── Concern collections ────────────────────────────────────── */}
      <section className="fn-section-y bg-surface">
        <Container>
          <header className="mb-10 max-w-2xl md:mb-12">
            <p className="fn-eyebrow">
              <span className="fn-rule" />
              <span>حسب المشكلة</span>
            </p>
            <h2 className="fn-section-title mt-4 md:mt-5">
              اختصر الطريق — ابدأ من مشكلتك
            </h2>
          </header>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {concernCollections.map((concern) => (
              <li key={concern.id}>
                <Link
                  href={`/concerns/${concern.slug}`}
                  className="group flex h-full flex-col gap-3 rounded-2xl border border-line bg-bg p-5 transition-colors hover:border-accent/40 md:p-6"
                >
                  <h3
                    className="font-display text-[20px] font-semibold tracking-tight text-ink md:text-[22px]"
                    dir="rtl"
                  >
                    {pickLocalized(concern.title, "ar")}
                  </h3>
                  {concern.tagline ? (
                    <p className="text-[13.5px] leading-relaxed text-muted md:text-[14px]">
                      {pickLocalized(concern.tagline, "ar")}
                    </p>
                  ) : null}
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[12.5px] font-semibold text-accent transition-colors group-hover:text-[rgb(var(--color-accent-deep))]">
                    استكشف
                    <ArrowLeft className="size-3.5 ltr:rotate-180" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </div>
  );
}
