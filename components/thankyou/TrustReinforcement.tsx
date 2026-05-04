"use client";

import { Star, ShieldCheck, Undo2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

/**
 * Trust reinforcement strip for the thank-you page.
 *
 * Different from the homepage `TrustStrip`:
 *   • Homepage trust = pre-purchase reassurance ("you can buy from us safely").
 *   • Thank-you trust = post-purchase reinforcement ("you made the right call").
 *
 * Replaces "Pay on delivery" (already happened) with "4.8 from 500+ reviews"
 * — social proof is the most useful trust signal *after* a purchase, because
 * it validates the decision the customer just made.
 */
export function TrustReinforcement() {
  const { t } = useLocale();
  const items = [
    { icon: Star, title: t.thankyou.trustReviewsTitle, body: t.thankyou.trustReviewsBody },
    {
      icon: ShieldCheck,
      title: t.thankyou.trustWarrantyTitle,
      body: t.thankyou.trustWarrantyBody,
    },
    { icon: Undo2, title: t.thankyou.trustReturnsTitle, body: t.thankyou.trustReturnsBody },
  ];

  return (
    <section
      aria-labelledby="thankyou-trust-heading"
      className="border-y border-line bg-brand-soft/40"
    >
      <Container>
        <h2
          id="thankyou-trust-heading"
          className="sr-only"
        >
          {t.thankyou.trustTitle}
        </h2>
        <ul className="grid gap-x-8 gap-y-6 py-10 md:grid-cols-3 md:gap-x-12 md:py-14">
          {items.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-bg text-ink shadow-card">
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
