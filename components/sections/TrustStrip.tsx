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
        <h2 id="trust-heading" className="sr-only">
          {t.home.trustEyebrow}
        </h2>
        <ul className="grid gap-x-8 gap-y-8 py-12 md:grid-cols-3 md:gap-x-12 md:py-16">
          {items.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-bg text-accent ring-1 ring-accent/25">
                <Icon className="size-5" strokeWidth={1.6} />
              </span>
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight text-ink md:text-base">
                  {title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
