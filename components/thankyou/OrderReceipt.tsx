"use client";

import Image from "next/image";
import { Sparkles } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { getProductById } from "@/data/products";
import { pickLocalized } from "@/lib/format";
import type { OrderReceipt as Receipt } from "@/lib/order-receipt";

type Props = {
  receipt: Receipt;
};

/**
 * Order receipt panel.
 *
 * Why this lives on the thank-you page (not just in an email):
 *   • Print-friendly — `window.print()` from the hero produces a clean copy.
 *   • Authoritative — same line-totals as the API, no client recomputation.
 *   • Visible — Saudi customers expect to see what they bought right now,
 *     not "wait for the email to arrive". Trust signal.
 *
 * Upsell lines are visually flagged with a subtle "99 SAR offer" pill so
 * the customer recognises what they accepted seconds earlier.
 */
export function OrderReceipt({ receipt }: Props) {
  const { locale, t } = useLocale();
  const format = useFormatPrice();

  const itemCount = receipt.lines.reduce((acc, l) => acc + l.quantity, 0);

  return (
    <section aria-label={t.thankyou.receiptTitle} className="bg-surface py-14 md:py-20">
      <Container size="md">
        <article className="overflow-hidden rounded-md border border-line bg-bg shadow-card">
          <header className="flex items-baseline justify-between gap-4 border-b border-line px-6 py-5 md:px-8">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight md:text-2xl">
                {t.thankyou.receiptTitle}
              </h2>
              <p className="mt-1 text-xs text-muted">
                {itemCount} {locale === "ar" ? "قطعة" : itemCount === 1 ? "item" : "items"}
              </p>
            </div>
            <span
              className="font-mono text-[12px] tracking-tight text-muted"
              dir="ltr"
            >
              #{receipt.orderId}
            </span>
          </header>

          <div className="grid gap-x-10 gap-y-6 px-6 py-6 md:grid-cols-[1fr_220px] md:px-8 md:py-8">
            {/* ─── Items column ─────────────────────────────────────────── */}
            <div className="space-y-4">
              <ul className="divide-y divide-line">
                {receipt.lines.map((line) => {
                  const product = getProductById(line.productId);
                  const image = product?.images[0];
                  const isUpsell = line.source === "post_purchase_upsell";
                  return (
                    <li
                      key={`${line.productId}-${line.source}`}
                      className="flex items-start gap-4 py-4"
                    >
                      {image ? (
                        <div className="relative size-16 shrink-0 overflow-hidden rounded-sm bg-brand-soft">
                          <Image
                            src={image.src}
                            alt={pickLocalized(image.alt, locale)}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="size-16 shrink-0 rounded-sm bg-brand-soft" />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="truncate text-sm font-medium text-ink">
                            {pickLocalized(line.title, locale)}
                          </h3>
                          <span className="shrink-0 text-sm tabular-nums">
                            {format(line.lineTotal)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          {locale === "ar" ? "الكمية" : "Qty"}: {line.quantity}
                          {" · "}
                          {format(line.unitPrice)}{" "}
                          {locale === "ar" ? "للقطعة" : "each"}
                        </p>
                        {isUpsell && (
                          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-success">
                            <Sparkles className="size-2.5" />
                            {t.thankyou.receiptUpsellTag}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* ─── Customer & totals column ────────────────────────────── */}
            <aside className="space-y-5 md:border-s md:border-line md:ps-8">
              <DetailBlock label={t.thankyou.receiptDeliveryTo} value={receipt.customer.fullName} />
              <DetailBlock
                label={t.thankyou.receiptPhone}
                value={receipt.customer.phone}
                ltr
              />
              <DetailBlock
                label={t.thankyou.receiptPaymentMethod}
                value={t.thankyou.receiptPaymentCod}
              />

              <dl className="space-y-1.5 border-t border-line pt-4 text-sm">
                <Row
                  label={t.thankyou.receiptSubtotal}
                  value={format(receipt.totals.subtotal)}
                />
                <Row
                  label={t.thankyou.receiptShipping}
                  value={t.thankyou.receiptShippingFree}
                  muted
                />
                <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3 text-base">
                  <dt className="font-semibold">{t.thankyou.receiptTotal}</dt>
                  <dd className="font-semibold tabular-nums">
                    {format(receipt.totals.total)}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </article>
      </Container>
    </section>
  );
}

function DetailBlock({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p
        className="mt-1 text-sm font-medium text-ink"
        dir={ltr ? "ltr" : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={muted ? "text-muted" : "font-medium tabular-nums"}>{value}</dd>
    </div>
  );
}
