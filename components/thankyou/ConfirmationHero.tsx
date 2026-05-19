"use client";

import { useEffect, useState } from "react";
import { Check, Truck, ShieldCheck, MessageCircle, Copy } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { useBusinessHours } from "@/hooks/useBusinessHours";

type Props = {
  customerName?: string;
  orderId: string;
};

/**
 * SuccessHero — the first thing the buyer sees after a successful COD order.
 *
 * Psychological objectives (in priority order):
 *   1. **Reassurance** — large calm checkmark, "your order is reserved" badge,
 *      personalised greeting.  Reduces post-purchase anxiety, which is the
 *      single biggest cause of "did the order really go through?" support
 *      tickets in MENA COD.
 *   2. **Anticipation** — dynamic business-hours line tells the buyer
 *      EXACTLY when the call will come.  Removes the open question that
 *      otherwise sits unanswered for hours.
 *   3. **Trust** — three pill-chips reinforce the COD promise (free
 *      shipping, pay on delivery, Saudi support) so a hesitant buyer
 *      doesn't second-guess on hour 2.
 *   4. **Authority** — typography hierarchy (display serif headline, fine
 *      eyebrow, monospace order ID) signals premium, not bargain-bin.
 *
 * No tracking calls, no animations beyond a one-shot mount fade, no heavy
 * dependencies.  All copy lives in `dictionaries.ts` so a single translation
 * file edit changes both AR and EN simultaneously.
 */
export function ConfirmationHero({ customerName, orderId }: Props) {
  const { t } = useLocale();
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const businessHours = useBusinessHours();

  useEffect(() => {
    setMounted(true);
  }, []);

  const heading = customerName
    ? t.thankyou.heroTitle.replace("{name}", customerName)
    : t.thankyou.heroTitleGuest;

  // Dynamic call-window line.  Before the hook has measured time we render
  // the in-hours copy as a sensible default — it's the more common state
  // (12h of the 24) and avoids a flicker between renders.
  const callLine = businessHours.ready
    ? businessHours.isWithinHours
      ? t.thankyou.heroCallWithin
      : t.thankyou.heroCallMorning
    : t.thankyou.heroCallWithin;

  const onCopyOrderId = async () => {
    if (typeof window === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — fail silently, the number is still on screen */
    }
  };

  return (
    <section
      aria-labelledby="thankyou-heading"
      className="relative overflow-hidden border-b border-line bg-surface"
    >
      {/* Soft warm halo so the success state sits on a luxe glow rather
       *  than a flat cream — purely visual, no JS, no perf cost. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 mx-auto block h-64 max-w-3xl bg-[radial-gradient(60%_60%_at_50%_0%,rgb(var(--color-accent-soft)/0.45)_0%,transparent_70%)]"
      />

      <Container>
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-7 py-14 text-center md:py-20">
          {/* Animated checkmark — celebratory but not loud.  Spec: scale
           *  + fade single tick, ease-premium curve, 700ms duration. */}
          <div
            aria-hidden
            className={`grid size-20 place-items-center rounded-full bg-success/15 text-success ring-8 ring-success/[0.06] transition-all duration-700 ease-premium md:size-24 ${
              mounted ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
          >
            <Check className="size-10 md:size-12" strokeWidth={2.25} />
          </div>

          {/* Eyebrow pill — "Order reserved" — instant emotional anchor. */}
          <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/[0.07] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-success">
            <span aria-hidden className="size-1.5 rounded-full bg-success" />
            {t.thankyou.heroReserved}
          </span>

          <div className="space-y-3">
            <h1
              id="thankyou-heading"
              className="text-balance font-display text-[28px] font-semibold leading-[1.15] tracking-tight md:text-5xl"
            >
              {heading}
            </h1>
            <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-muted md:text-[17px]">
              {t.thankyou.heroBody}
            </p>
          </div>

          {/* Dynamic business-hours promise — the most CRO-impactful line
           *  on the page after the headline.  Renders inside a soft gold
           *  card so the eye lands on it. */}
          <div className="mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-accent/25 bg-bg px-4 py-3.5 text-start shadow-luxury-sm md:max-w-lg">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-accent/15 text-[rgb(var(--color-accent-deep))]">
              <MessageCircle className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-tight text-ink md:text-sm">
                {t.thankyou.heroPendingStep}
              </p>
              <p className="mt-1 text-[12.5px] leading-snug text-muted md:text-[13px]">
                {callLine}
                <span className="ms-1.5 text-[11px] text-muted/70">
                  · {t.thankyou.heroCallSubtle}
                </span>
              </p>
            </div>
          </div>

          {/* Order ID badge with copy-to-clipboard — discreet, monospace,
           *  shows confirmation feedback inline.  Print sits beside it. */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-bg/70 px-3.5 py-1.5">
              <span className="text-[11px] uppercase tracking-[0.16em] text-muted">
                {t.thankyou.orderIdLabel}
              </span>
              <span
                className="font-mono text-[12.5px] tracking-tight text-ink"
                dir="ltr"
              >
                {orderId}
              </span>
              <button
                type="button"
                onClick={onCopyOrderId}
                aria-label={copied ? t.thankyou.orderIdCopied : t.thankyou.orderIdCopy}
                className="inline-flex items-center gap-1 rounded-md text-muted transition-colors hover:text-ink"
              >
                {copied ? (
                  <Check className="size-3.5 text-success" strokeWidth={2.25} />
                ) : (
                  <Copy className="size-3.5" />
                )}
                <span className="text-[11px]">
                  {copied ? t.thankyou.orderIdCopied : t.thankyou.orderIdCopy}
                </span>
              </button>
            </div>
          </div>

          {/* Three trust pill-chips — COD / free shipping / Saudi support.
           *  Visual proof points that pre-empt the most common COD doubts. */}
          <ul className="flex flex-wrap items-center justify-center gap-2 text-[12px] text-muted md:text-[12.5px]">
            <li className="inline-flex items-center gap-1.5 rounded-full bg-bg/70 px-3 py-1.5 ring-1 ring-line/80">
              <ShieldCheck
                className="size-3.5 text-[rgb(var(--color-accent-deep))]"
                strokeWidth={1.75}
              />
              {t.thankyou.heroReassureCod}
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full bg-bg/70 px-3 py-1.5 ring-1 ring-line/80">
              <Truck
                className="size-3.5 text-[rgb(var(--color-accent-deep))]"
                strokeWidth={1.75}
              />
              {t.thankyou.heroReassureFreeShip}
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full bg-bg/70 px-3 py-1.5 ring-1 ring-line/80">
              <MessageCircle
                className="size-3.5 text-[rgb(var(--color-accent-deep))]"
                strokeWidth={1.75}
              />
              {t.thankyou.heroReassureLocal}
            </li>
          </ul>
        </div>
      </Container>
    </section>
  );
}
