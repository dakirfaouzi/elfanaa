"use client";

import { PhoneCall, Clock, ShieldCheck, Zap, Check } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

/**
 * CallReassuranceBanner — THE single most CRO-impactful section on this page.
 *
 * In MENA COD, **call-answer rate** is the most direct lever on confirmation
 * rate.  A buyer who picks up and gives a quick "yes" gets shipped same-day;
 * a buyer who ignores three calls is half as likely to ever receive the
 * order.  Operations research from CODRocket / Easyship pegs the lift from a
 * good post-checkout reassurance message at **8–15% on confirmation rate**.
 *
 * Visual approach:
 *   • A bold gold-accented card (the only "loud" surface on the page).
 *   • Big phone icon at the leading edge to signal "this is about the call".
 *   • Two-line lockup: "Don't miss the call" + "Quick answer = faster ship".
 *   • Four bullet pillars (Saudi number / under a minute / no payment /
 *     same-day dispatch) — each with a small icon for fast-scan reading.
 *
 * Why no animations, gradients, or sparkles:
 *   The Saudi luxury aesthetic punishes "spammy" energy.  A still card with
 *   one accent line communicates urgency without screaming.
 */
export function CallReassuranceBanner() {
  const { t } = useLocale();

  const bullets: { icon: typeof PhoneCall; text: string }[] = [
    { icon: PhoneCall, text: t.thankyou.callBullet1 },
    { icon: Clock, text: t.thankyou.callBullet2 },
    { icon: ShieldCheck, text: t.thankyou.callBullet3 },
    { icon: Zap, text: t.thankyou.callBullet4 },
  ];

  return (
    <section aria-labelledby="ty-call-title" className="bg-bg pt-10 md:pt-14">
      <Container size="md">
        <div className="relative overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-b from-[rgb(var(--color-accent-soft)/0.18)] to-bg p-6 shadow-luxury-md md:p-8">
          {/* Subtle gold leading stripe at the inline-start edge. */}
          <span
            aria-hidden
            className="absolute inset-y-4 start-0 w-[3px] rounded-full bg-gradient-to-b from-[rgb(var(--color-accent))] to-[rgb(var(--color-accent-deep))]"
          />

          <div className="flex items-start gap-4 md:gap-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-bg shadow-luxury-sm md:size-14">
              <PhoneCall className="size-5 md:size-6" strokeWidth={1.75} />
            </span>

            <div className="min-w-0 flex-1 space-y-1.5">
              <h2
                id="ty-call-title"
                className="text-balance font-display text-[19px] font-semibold leading-tight tracking-tight text-ink md:text-2xl"
              >
                {t.thankyou.callTitle}
              </h2>
              <p className="text-[13.5px] leading-relaxed text-[rgb(var(--color-accent-deep))] md:text-sm">
                {t.thankyou.callSubtitle}
              </p>
            </div>
          </div>

          {/* Bullet pillars — single-column on mobile for fast vertical
           *  scan, two-column on tablet+ for premium horizontal balance. */}
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4 md:mt-7">
            {bullets.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-start gap-3 rounded-xl bg-bg/60 px-3.5 py-3 ring-1 ring-line/70"
              >
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                  <Check className="size-3.5" strokeWidth={2.5} />
                </span>
                <div className="flex min-w-0 items-start gap-2">
                  <Icon
                    className="mt-0.5 size-4 shrink-0 text-[rgb(var(--color-accent-deep))]"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span className="text-[13.5px] leading-snug text-ink md:text-sm">
                    {text}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
