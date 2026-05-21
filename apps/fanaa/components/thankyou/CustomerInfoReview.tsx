"use client";

import { User, Phone, BadgeCheck, Receipt, Check } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import type { OrderReceipt } from "@/lib/order-receipt";

type Props = {
  receipt: OrderReceipt;
};

/**
 * CustomerInfoReview — "this is what we'll call".
 *
 * Why a separate section instead of folding into the order summary?
 *   On a COD flow the **call details** are the most-important customer data
 *   on the page (more than the order total).  Giving them their own card —
 *   with a green "details look correct" affirmation — does two things:
 *     1. Lets the buyer mentally double-check the number before the call
 *        comes through (catches typos early → fewer failed deliveries).
 *     2. Reinforces that we already validated everything before saving the
 *        order, which prevents the "is this a real order?" anxiety spike.
 *
 * Read-only on purpose.  The current backend has no buyer-facing edit
 * endpoint; building a fake edit button that does nothing would be worse
 * than no button at all.  When edit-by-WhatsApp is implemented, this is
 * the obvious place to mount the CTA — but until then, the FAQ section
 * already directs buyers to WhatsApp for corrections.
 */
export function CustomerInfoReview({ receipt }: Props) {
  const { t } = useLocale();

  const rows: { icon: typeof User; label: string; value: string; ltr?: boolean }[] = [
    {
      icon: User,
      label: t.thankyou.customerInfoNameLabel,
      value: receipt.customer.fullName,
    },
    {
      icon: Phone,
      label: t.thankyou.customerInfoPhoneLabel,
      value: receipt.customer.phone,
      ltr: true,
    },
    {
      icon: BadgeCheck,
      label: t.thankyou.customerInfoPaymentLabel,
      value: t.thankyou.receiptPaymentCod,
    },
    {
      icon: Receipt,
      label: t.thankyou.customerInfoOrderLabel,
      value: receipt.orderId,
      ltr: true,
    },
  ];

  return (
    <section
      aria-labelledby="ty-customer-info-title"
      className="bg-bg py-10 md:py-14"
    >
      <Container size="md">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface/70 shadow-luxury-sm">
          {/* Header strip with the green "data confirmed" affirmation. */}
          <header className="flex items-start justify-between gap-4 border-b border-line/80 bg-bg/60 px-5 py-4 md:px-6 md:py-5">
            <div>
              <h2
                id="ty-customer-info-title"
                className="font-display text-[17px] font-semibold tracking-tight text-ink md:text-xl"
              >
                {t.thankyou.customerInfoTitle}
              </h2>
              <p className="mt-0.5 text-[12px] text-muted md:text-[12.5px]">
                {t.thankyou.customerInfoCheck}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-success/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-success ring-1 ring-success/25">
              <Check className="size-3.5" strokeWidth={2.5} />
              {t.thankyou.customerInfoCorrect}
            </span>
          </header>

          {/* Data rows — generous spacing, icon-led, RTL-safe.  On mobile
           *  each row stacks the label above the value for thumb-readability;
           *  on md+ they sit on the same baseline for fast scanning. */}
          <dl className="divide-y divide-line/70">
            {rows.map(({ icon: Icon, label, value, ltr }) => (
              <div
                key={label}
                className="flex items-start gap-4 px-5 py-4 md:items-center md:px-6 md:py-5"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bg text-muted ring-1 ring-line/70">
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-center md:justify-between md:gap-4">
                  <dt className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {label}
                  </dt>
                  <dd
                    className="truncate text-[14.5px] font-medium text-ink md:text-[15px]"
                    dir={ltr ? "ltr" : undefined}
                  >
                    {value}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </section>
  );
}
