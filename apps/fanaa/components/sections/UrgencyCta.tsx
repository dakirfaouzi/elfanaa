"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck, Clock, Flame } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { track } from "@/lib/analytics";

/**
 * Final-fold urgency CTA — the closer.
 *
 * After the customer has seen problems → clinical mechanism →
 * products → testimonials → differentiation, this section names
 * the offer and pushes for action with SCARCITY + URGENCY.
 *
 * CRO elements layered:
 *   1. Scarcity badge (limited stock today)
 *   2. Offer headline (price + saving)
 *   3. What's included (3 products listed)
 *   4. CTA with urgency verb
 *   5. Reassurance (COD + returns)
 */
export function UrgencyCta() {
  const { locale } = useLocale();
  const isAr = locale === "ar";

  return (
    <section
      className="fn-section-y relative overflow-hidden bg-ink text-bg"
      aria-labelledby="urgency-heading"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_50%_25%,rgba(199,162,124,0.22),transparent_62%)]"
      />

      <Container>
        <div className="relative mx-auto max-w-2xl text-center">
          {/* Scarcity badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-warning/15 px-4 py-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-warning ring-1 ring-warning/30">
            <Flame className="size-3.5" />
            {isAr ? "طلب عالي اليوم — الكمية محدودة" : "High demand today — limited stock"}
          </div>

          {/* Save badge */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-accent ring-1 ring-accent/30">
              {isAr ? "وفّر ٢٤٨ ريال" : "Save 248 SAR"}
            </span>
          </div>

          <h2
            id="urgency-heading"
            className="fn-section-title mt-6 text-bg"
          >
            {isAr
              ? "روتين التجديد الشامل\nبـ ٣٤٩ ريال بدل ٥٩٧"
              : "The Complete Revival Routine\n349 SAR instead of 597"}
          </h2>

          {/* What's included — mobile: stacked column; sm+: inline row */}
          <div className="mx-auto mt-6 flex flex-col items-center gap-2 text-[13.5px] text-bg/78 md:flex-row md:justify-center md:gap-4 md:text-[14px]">
            <span>✓ {isAr ? "سيروم الإشراق" : "Glow Serum"}</span>
            <span className="hidden md:inline text-bg/30">+</span>
            <span>✓ {isAr ? "كريم ترميم الحاجز" : "Barrier Repair Cream"}</span>
            <span className="hidden md:inline text-bg/30">+</span>
            <span>✓ {isAr ? "قناع الترميم العميق" : "Deep Repair Mask"}</span>
          </div>

          <p className="mx-auto mt-5 max-w-lg text-[14.5px] leading-[1.8] text-bg/72 md:text-[16px]">
            {isAr
              ? "ثلاث خطوات علمية لتجديد بشرتك وشعرك. ١٤ يوم لنتائج مرئية. والدفع عند الاستلام."
              : "Three scientific steps to revive your skin and hair. 14 days to visible results. Cash on delivery."}
          </p>

          <div className="mt-9 flex flex-col items-center gap-4">
            <Link
              href="/shop"
              onClick={() =>
                track("begin_checkout", { surface: "urgency_cta_home", locale })
              }
              className="btn-press fn-cta-glow group flex h-[58px] w-full items-center justify-center gap-2.5 rounded-full bg-bg px-7 text-[15px] font-semibold text-ink transition-all duration-300 ease-premium hover:gap-3.5 sm:inline-flex sm:w-auto sm:px-12 md:h-[64px] md:px-14 md:text-base"
              style={{
                boxShadow:
                  "0 16px 40px rgba(31,24,21,0.30), 0 0 0 1px rgba(199,162,124,0.45)",
              }}
            >
              {isAr ? "اطلب الروتين الكامل — ٣٤٩ ر.س" : "Order the full routine — 349 SAR"}
              <ArrowLeft className="size-4 shrink-0 transition-transform duration-300 ease-premium group-hover:-translate-x-0.5 ltr:rotate-180 rtl:group-hover:translate-x-0.5" />
            </Link>

            <div className="flex flex-col items-center gap-2 text-[12px] text-bg/60 md:flex-row md:gap-5 md:text-[13px]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-accent" />
                {isAr ? "ادفع عند الاستلام" : "Cash on delivery"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5 text-accent" />
                {isAr ? "إرجاع مجاني ١٤ يوم" : "Free 14-day returns"}
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
