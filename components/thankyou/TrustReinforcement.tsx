"use client";

import {
  Truck,
  Wallet,
  BadgeCheck,
  MessageCircle,
  ShieldCheck,
  Headset,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

/**
 * ReassuranceBadges — six trust pillars, post-purchase.
 *
 * Why six, not three:
 *   Pre-purchase pages can survive on a three-icon trust strip ("free
 *   shipping / COD / 14-day returns").  On a confirmation page the
 *   reassurance load is heavier — the buyer is now imagining the
 *   delivery, the call, the package itself.  Six pillars cover the
 *   full surface of doubt: shipping, payment, authenticity, support
 *   channel, return policy, and the people behind the brand.
 *
 * Layout:
 *   • Mobile: 2-column grid of chip cards.  Six items split cleanly
 *     into three balanced rows, each row reads in one glance.
 *   • Desktop: 3 × 2 grid for the same balance at wider breakpoints.
 *   • Each card carries a small accent icon — gold/champagne tint so
 *     the strip reads as decorative-but-trustworthy rather than
 *     loud-and-salesy.
 */
export function TrustReinforcement() {
  const { t } = useLocale();

  const items: { icon: typeof Truck; title: string; body: string }[] = [
    { icon: Truck, title: t.thankyou.badge1Title, body: t.thankyou.badge1Body },
    { icon: Wallet, title: t.thankyou.badge2Title, body: t.thankyou.badge2Body },
    {
      icon: BadgeCheck,
      title: t.thankyou.badge3Title,
      body: t.thankyou.badge3Body,
    },
    {
      icon: MessageCircle,
      title: t.thankyou.badge4Title,
      body: t.thankyou.badge4Body,
    },
    {
      icon: ShieldCheck,
      title: t.thankyou.badge5Title,
      body: t.thankyou.badge5Body,
    },
    {
      icon: Headset,
      title: t.thankyou.badge6Title,
      body: t.thankyou.badge6Body,
    },
  ];

  return (
    <section
      aria-labelledby="ty-badges-title"
      className="bg-bg py-12 md:py-16"
    >
      <Container>
        <header className="mb-7 md:mb-9">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[rgb(var(--color-accent-deep))]">
            {t.thankyou.badgesEyebrow}
          </p>
          <h2
            id="ty-badges-title"
            className="sr-only"
          >
            {t.thankyou.badgesEyebrow}
          </h2>
        </header>

        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {items.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-2xl border border-line/80 bg-surface/60 p-4 transition-colors duration-300 ease-premium hover:border-accent/40 hover:bg-surface md:gap-4 md:p-5"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-bg text-[rgb(var(--color-accent-deep))] ring-1 ring-line/70 md:size-12">
                <Icon className="size-[18px] md:size-5" strokeWidth={1.5} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[13.5px] font-semibold leading-tight tracking-tight text-ink md:text-[14.5px]">
                  {title}
                </h3>
                <p className="mt-1 text-[12px] leading-snug text-muted md:text-[13px]">
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
