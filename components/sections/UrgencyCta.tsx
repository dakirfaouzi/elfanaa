"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Flourish } from "@/components/brand";
import { useLocale } from "@/hooks/useLocale";
import { track } from "@/lib/analytics";

/**
 * Final-fold urgency CTA — the closer.
 *
 * After the customer has seen problems → products → testimonials →
 * trust → story, this section names the offer and pushes for action.
 * The pattern is the same one Hims/Keeps use to anchor the bundle:
 *   • A single dramatic offer line ("X SAR — save Y").
 *   • A single CTA pointing at the highest-AOV path.
 *   • A reassurance line tied to COD so the click feels safe.
 *
 * Visual: dark ink background to break the rhythm of the page and
 * focus the eye. Rose-copper save-badge anchors the discount, while
 * the CTA pill is alabaster-on-ink for max contrast.
 */
export function UrgencyCta() {
  const { t, locale } = useLocale();

  return (
    <section
      className="relative overflow-hidden bg-ink py-20 text-bg md:py-28"
      aria-labelledby="urgency-heading"
    >
      {/* Subtle radial accent — pulls the eye to the centre */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(circle_at_50%_30%,rgba(186,110,92,0.18),transparent_60%)]"
      />

      <Container>
        <div className="relative mx-auto max-w-2xl text-center">
          <Flourish width={88} className="mx-auto mb-6 text-accent" />

          {/* Save badge */}
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-accent ring-1 ring-accent/25 backdrop-blur-sm">
            {t.urgencyCta.saveBadge}
          </span>

          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-bg/60">
            {t.urgencyCta.eyebrow}
          </p>

          <h2
            id="urgency-heading"
            className="mt-3 whitespace-pre-line text-balance font-display text-4xl font-semibold leading-[1.04] tracking-[-0.02em] md:text-5xl lg:text-[64px]"
          >
            {t.urgencyCta.title}
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-bg/85 md:text-lg">
            {t.urgencyCta.body}
          </p>

          <div className="mt-9">
            <Link
              href="/shop"
              onClick={() =>
                track("begin_checkout", { surface: "urgency_cta_home", locale })
              }
              className="group inline-flex h-13 items-center gap-2.5 rounded-md bg-bg px-9 text-sm font-semibold text-ink transition-all duration-200 ease-premium hover:gap-3.5 md:h-14 md:px-11 md:text-base"
            >
              {t.urgencyCta.cta}
              <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5 ltr:rotate-180 rtl:group-hover:translate-x-0.5" />
            </Link>
          </div>

          <p className="mt-5 inline-flex items-center justify-center gap-2 text-xs text-bg/65 md:text-[13px]">
            <ShieldCheck className="size-4 shrink-0 text-bg/70" strokeWidth={1.8} />
            {t.urgencyCta.reassurance}
          </p>
        </div>
      </Container>
    </section>
  );
}
