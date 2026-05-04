"use client";

import { useEffect, useState } from "react";
import { Check, Printer } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

type Props = {
  customerName?: string;
  orderId: string;
};

/**
 * Hero confirmation block.
 *
 * UX rationale:
 *   • A large, calm checkmark animates in once on mount — celebratory but
 *     not loud. (Premium brands earn the gravitas; flashy confetti cheapens it.)
 *   • The headline addresses the customer by name. Personalisation lifts
 *     perceived effort and trust by 30%+ in post-purchase studies.
 *   • Order ID is presented as monospace metadata, not as a wall of receipt
 *     characters — it's there for support, not for show.
 *   • Print is offered as a quiet secondary action — useful for the customer
 *     who wants a physical copy, invisible to everyone else.
 */
export function ConfirmationHero({ customerName, orderId }: Props) {
  const { t } = useLocale();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const heading = customerName
    ? t.thankyou.heroTitle.replace("{name}", customerName)
    : t.thankyou.heroTitleGuest;

  return (
    <section
      aria-labelledby="thankyou-heading"
      className="relative overflow-hidden border-b border-line bg-surface"
    >
      <Container>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 py-16 text-center md:py-24">
          <div
            aria-hidden
            className={`grid size-16 place-items-center rounded-full bg-success/10 text-success transition-all duration-700 ease-premium md:size-20 ${
              mounted ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
          >
            <Check className="size-8 md:size-10" strokeWidth={2.25} />
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-success">
              {t.thankyou.heroEyebrow}
            </p>
            <h1
              id="thankyou-heading"
              className="text-balance font-display text-3xl font-semibold leading-[1.15] tracking-tight md:text-5xl"
            >
              {heading}
            </h1>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-muted md:text-[17px]">
              {t.thankyou.heroBody}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1 text-sm">
            <span className="text-muted">
              {t.thankyou.orderIdLabel}:{" "}
              <span className="font-mono tracking-tight text-ink/80" dir="ltr">
                {orderId}
              </span>
            </span>
            <button
              type="button"
              onClick={() => typeof window !== "undefined" && window.print()}
              className="inline-flex items-center gap-1.5 rounded-md text-muted transition-colors hover:text-ink"
            >
              <Printer className="size-3.5" />
              {t.thankyou.printReceipt}
            </button>
          </div>
        </div>
      </Container>
    </section>
  );
}
