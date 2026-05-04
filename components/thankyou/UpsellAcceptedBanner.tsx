"use client";

import { Sparkles } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { pickLocalized } from "@/lib/format";
import type { ReceiptLine } from "@/lib/order-receipt";

type Props = {
  upsellLine: ReceiptLine;
};

/**
 * "Your add-on is in" success banner.
 *
 * Shown only when `receipt.upsellStatus === "accepted"`. Reinforces the
 * customer's decision (no buyer's remorse) and confirms it carries the same
 * COD terms — they don't owe anything new.
 */
export function UpsellAcceptedBanner({ upsellLine }: Props) {
  const { locale, t } = useLocale();
  const format = useFormatPrice();

  const body = t.thankyou.upsellAcceptedBody
    .replace("{title}", pickLocalized(upsellLine.title, locale))
    .replace("{price}", format(upsellLine.lineTotal));

  return (
    <Container size="md">
      <aside
        role="status"
        className="-mb-2 mt-8 flex items-start gap-4 rounded-md border border-success/25 bg-success/5 px-5 py-4 text-success md:items-center md:px-6 md:py-5"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success/15">
          <Sparkles className="size-4" />
        </span>
        <div className="space-y-0.5 text-ink">
          <p className="text-sm font-semibold">{t.thankyou.upsellAcceptedTitle}</p>
          <p className="text-sm text-muted">{body}</p>
          <p className="text-[12px] text-muted/80">{t.thankyou.upsellAcceptedNote}</p>
        </div>
      </aside>
    </Container>
  );
}
