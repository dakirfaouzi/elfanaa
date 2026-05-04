"use client";

import { BadgeCheck, Truck, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

/**
 * Trust strip — three pillars rendered as compact, equal-weight cards.
 *
 * Research: keep the trust band ≤150px tall, three pillars max, one short
 * sentence each. Goal: answer "is this brand trustworthy?" in <2 seconds.
 */
export function TrustStrip() {
  const { t } = useLocale();
  const items = [
    { icon: BadgeCheck, title: t.trust.codTitle, body: t.trust.codBody },
    { icon: Truck, title: t.trust.shippingTitle, body: t.trust.shippingBody },
    { icon: ShieldCheck, title: t.trust.qualityTitle, body: t.trust.qualityBody },
  ];

  return (
    <section aria-labelledby="trust-heading" className="border-y border-line bg-surface">
      <Container>
        <h2 id="trust-heading" className="sr-only">
          {t.home.trustEyebrow}
        </h2>
        <ul className="grid gap-x-8 gap-y-8 py-10 md:grid-cols-3 md:gap-x-12 md:py-14">
          {items.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-ink">
                <Icon className="size-5" strokeWidth={1.5} />
              </span>
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight text-ink">
                  {title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
