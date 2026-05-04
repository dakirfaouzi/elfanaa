"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import {
  ConfirmationHero,
  ContactPanel,
  DeliveryTimeline,
  OrderReceipt as OrderReceiptPanel,
  ThankYouCrossSells,
  ThankYouRecommendations,
  TrustReinforcement,
  UpsellAcceptedBanner,
} from "@/components/thankyou";
import { useCart } from "@/hooks/useCart";
import { useLocale } from "@/hooks/useLocale";
import { loadReceipt, type OrderReceipt } from "@/lib/order-receipt";
import { resolveCartCrossSells } from "@/data/upsells";

type Params = { orderId: string };

/**
 * Thank-you page composition.
 *
 * Order of sections (top → bottom) is intentional and CRO-driven:
 *   1. ConfirmationHero        → reassure first, sell never (yet)
 *   2. UpsellAcceptedBanner    → reinforce the buyer's most recent decision
 *   3. DeliveryTimeline        → collapse uncertainty about "what now?"
 *   4. OrderReceipt            → authoritative line-item summary
 *   5. TrustReinforcement      → social proof + warranty + returns
 *   6. ThankYouCrossSells      → on-brand same-price suggestions (3 max)
 *   7. ThankYouRecommendations → broader best-sellers (4 max)
 *   8. ContactPanel            → WhatsApp + phone + onward link
 *
 * The cart is cleared on first mount — the order is now safely server-side
 * (see `/api/orders` route) and the storefront should not re-prompt for it.
 *
 * Receipts come from `sessionStorage`; if missing (refresh after 24h, link
 * shared, etc.) we degrade to a minimal "your order is confirmed" state.
 */
export default function ThankYouPage({ params }: { params: Promise<Params> }) {
  const { orderId } = use(params);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const clearCart = useCart((s) => s.clear);

  useEffect(() => {
    setReceipt(loadReceipt(orderId));
    setHydrated(true);
    // Cart is now an artifact of a completed order — close the loop on the
    // client. The order itself is durable on the server side.
    clearCart();
  }, [orderId, clearCart]);

  // Compute IDs to exclude from "Recommendations" so we don't show the same
  // cross-sells twice in a row.
  const excludeIds = useMemo(() => {
    if (!receipt) return [] as string[];
    const synth = {
      lines: receipt.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      currency: receipt.totals.total.currency,
    };
    const cross = resolveCartCrossSells(synth, 3).map((p) => p.id);
    return [...receipt.lines.map((l) => l.productId), ...cross];
  }, [receipt]);

  if (!hydrated) {
    return <ThankYouSkeleton />;
  }

  if (!receipt) {
    return <FallbackReceipt orderId={orderId} />;
  }

  return (
    <>
      <ConfirmationHero
        customerName={firstName(receipt.customer.fullName)}
        orderId={orderId}
      />
      {receipt.upsellStatus === "accepted" && receipt.upsellLine ? (
        <UpsellAcceptedBanner upsellLine={receipt.upsellLine} />
      ) : null}
      <DeliveryTimeline />
      <OrderReceiptPanel receipt={receipt} />
      <TrustReinforcement />
      <ThankYouCrossSells receipt={receipt} />
      <ThankYouRecommendations receipt={receipt} excludeIds={excludeIds} />
      <ContactPanel orderId={orderId} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Auxiliary states                                 */
/* -------------------------------------------------------------------------- */

function ThankYouSkeleton() {
  return (
    <div className="border-b border-line bg-surface">
      <Container>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 py-16 text-center md:py-24">
          <div className="size-16 animate-pulse rounded-full bg-line md:size-20" />
          <div className="h-7 w-72 max-w-full animate-pulse rounded bg-line md:h-10 md:w-96" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-line/70" />
        </div>
      </Container>
    </div>
  );
}

function FallbackReceipt({ orderId }: { orderId: string }) {
  const { t } = useLocale();
  return (
    <>
      <div className="border-b border-line bg-surface">
        <Container>
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-20 text-center md:py-28">
            <div className="grid size-16 place-items-center rounded-full bg-success/10 text-success md:size-20">
              <svg
                className="size-8 md:size-10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <div className="space-y-3">
              <h1 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
                {t.thankyou.missingReceiptTitle}
              </h1>
              <p className="mx-auto max-w-xl text-base leading-relaxed text-muted md:text-[17px]">
                {t.thankyou.missingReceiptBody}
              </p>
              <p className="text-sm text-muted">
                {t.thankyou.orderIdLabel}:{" "}
                <span className="font-mono tracking-tight text-ink/80" dir="ltr">
                  {orderId}
                </span>
              </p>
            </div>
            <Link
              href="/shop"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-ink"
            >
              <span className="border-b border-ink/40 pb-0.5 transition-colors group-hover:border-ink">
                {t.thankyou.backToShop}
              </span>
              <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 rtl:group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Container>
      </div>
      <TrustReinforcement />
      <ThankYouRecommendations receipt={null} />
      <ContactPanel orderId={orderId} />
    </>
  );
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}
