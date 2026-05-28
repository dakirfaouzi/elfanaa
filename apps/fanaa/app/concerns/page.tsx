import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { collections, concernCollections } from "@/data/collections";
import { siteConfig } from "@/data/site";
import { pickLocalized } from "@/lib/format";

/*
 * /concerns — index of every problem-led collection.
 *
 * # Why this page exists
 *
 * The mega menu renders `/concerns/<slug>` links and the bare
 * `/concerns` prefix returned a 404 (same root cause as
 * `/collections` — see the comment block in that page). Adding a
 * proper concern directory keeps the route alive for external
 * referrers, sitemap probes, and the operator-typed URL surface,
 * while doubling as a discovery surface for problem-first buyers.
 *
 * # Composition
 *
 *   1. Editorial header — same rhythm as `/collections/page.tsx`
 *      so the two index pages feel like a paired set, not two
 *      one-offs.
 *   2. Concerns grid — denser, problem-led tiles. Concern pages
 *      lean on the underlying filter system rather than hero
 *      imagery, so the index leans on copy + an outline card
 *      treatment instead of editorial photography.
 *   3. Cross-link out — a footer band pointing buyers who don't
 *      know their concern yet back to the main `/collections`
 *      directory.
 *
 * Pure server / static — see `dynamic = "force-static"`. No DB
 * traffic, no `loadAllCatalogProducts` call — the page is a directory
 * of in-code concern definitions.
 */

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: `حسب المشكلة | ${siteConfig.name.ar}`,
  description:
    "اختصر الطريق — اختر مشكلتك (بقع داكنة، جفاف، تقصف الشعر) وشوف المنتجات المصممة لها.",
};

export default function ConcernsIndexPage() {
  return (
    <div className="pb-20 md:pb-28">
      {/* ── Editorial header ───────────────────────────────────────── */}
      <section className="border-b border-line bg-surface">
        <Container>
          <div className="mx-auto max-w-3xl py-14 text-center md:py-20">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[rgb(var(--color-accent-deep))]">
              حسب المشكلة
            </p>
            <h1 className="mt-3 font-display text-[32px] font-semibold leading-[1.1] tracking-tight md:text-5xl">
              {"كل مشكلة\nلها حل واضح."}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted md:text-[17px]">
              اختر مشكلتك من القائمة — تركيباتنا مصممة لتعالج الجذور، لا لتخفي
              الأعراض. كل بطاقة تقودك لمنتجات مختارة لتلك الحالة بالضبط.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Concerns grid ──────────────────────────────────────────── */}
      <section className="fn-section-y bg-bg">
        <Container>
          <header className="mb-10 max-w-2xl md:mb-12">
            <p className="fn-eyebrow">
              <span className="fn-rule" />
              <span>المشاكل المتاحة</span>
            </p>
            <h2 className="fn-section-title mt-4 md:mt-5">
              ابدأ من المكان الصحيح
            </h2>
          </header>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {concernCollections.map((concern, i) => (
              <li key={concern.id}>
                <Link
                  href={`/concerns/${concern.slug}`}
                  className="group flex h-full flex-col gap-3 rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-accent/40 md:p-7"
                >
                  <span className="font-display text-[12px] italic tabular-nums text-muted/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3
                    className="font-display text-[22px] font-semibold leading-[1.15] tracking-tight text-ink md:text-[24px]"
                    dir="rtl"
                  >
                    {pickLocalized(concern.title, "ar")}
                  </h3>
                  {concern.tagline ? (
                    <p className="text-[13.5px] leading-relaxed text-muted md:text-[14px]">
                      {pickLocalized(concern.tagline, "ar")}
                    </p>
                  ) : null}
                  {concern.description ? (
                    <p className="text-[13px] leading-relaxed text-muted/85 md:text-[13.5px]">
                      {pickLocalized(concern.description, "ar")}
                    </p>
                  ) : null}
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[12.5px] font-semibold text-accent transition-colors group-hover:text-[rgb(var(--color-accent-deep))]">
                    استكشف الحلول
                    <ArrowLeft className="size-3.5 ltr:rotate-180" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ── Cross-link to /collections ─────────────────────────────── */}
      <section className="border-t border-line bg-surface">
        <Container>
          <div className="mx-auto max-w-2xl py-12 text-center md:py-16">
            <p className="text-[13px] uppercase tracking-[0.18em] text-muted md:text-[13.5px]">
              لست متأكدًا من مشكلتك؟
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight md:text-3xl">
              ابدأ من نوع المنتج بدلاً من ذلك
            </h2>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/collections"
                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-6 text-[13.5px] font-semibold text-bg transition-colors hover:bg-ink/90"
              >
                تصفح المجموعات
                <ArrowLeft className="size-4 ltr:rotate-180" />
              </Link>
              <Link
                href="/shop"
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-bg px-6 text-[13.5px] font-semibold text-ink transition-colors hover:border-accent/40"
              >
                كل المنتجات
              </Link>
            </div>
            {collections.length > 0 ? (
              <p className="mt-4 text-[12px] text-muted/80">
                {collections.length} مجموعات · {concernCollections.length} مشاكل
              </p>
            ) : null}
          </div>
        </Container>
      </section>
    </div>
  );
}
