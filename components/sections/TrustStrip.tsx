"use client";

import { BadgeCheck, Truck, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

/**
 * Trust strip — three pillars between the hero and the problem-ID tiles.
 *
 * Each pillar is a *benefit-led* title plus one short body line. The
 * icons are wrapped in a rose-copper-tinted ring so the whole strip
 * carries the brand colour at a glance, anchoring the page's identity
 * before the user scrolls into the editorial sections below.
 *
 * Research: keep the trust band ≤150px tall, three pillars max, one
 * short sentence each. Goal: answer "is this brand trustworthy?" in
 * < 2 seconds.
 */
export function TrustStrip() {
  const { t } = useLocale();
  const items = [
    { icon: BadgeCheck, title: t.trust.codTitle, body: t.trust.codBody },
    { icon: Truck, title: t.trust.shippingTitle, body: t.trust.shippingBody },
    { icon: ShieldCheck, title: t.trust.qualityTitle, body: t.trust.qualityBody },
  ];

  return (
    <section
      aria-labelledby="trust-heading"
      className="border-y border-line bg-surface"
    >
      <Container>
        {/*
         * Editorial eyebrow — a quiet gold-rule + small-caps label that
         * frames the trust pillars as a curated promise band rather than
         * a generic Shopify icon strip. Matches /sugarbear's section
         * hand-shake.
         */}
        <p className="fn-eyebrow mt-7 md:mt-12">
          <span className="fn-rule" />
          <span>{t.home.trustEyebrow}</span>
        </p>
        <h2 id="trust-heading" className="sr-only">
          {t.home.trustEyebrow}
        </h2>
        <ul className="mt-4 grid gap-x-8 gap-y-4 pb-7 md:mt-6 md:grid-cols-3 md:gap-x-12 md:gap-y-6 md:pb-12">
          {items.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3.5 md:gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-bg text-accent ring-1 ring-accent/30 md:size-12">
                <Icon className="size-4 md:size-5" strokeWidth={1.6} />
              </span>
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-ink md:text-[15px]">
                  {title}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted md:mt-1.5 md:text-sm">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
