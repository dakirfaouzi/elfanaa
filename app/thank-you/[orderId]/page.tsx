"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import {
  CallReassuranceBanner,
  ConfirmationHero,
  ContactPanel,
  CustomerInfoReview,
  DeliveryTimeline,
  OrderReceipt as OrderReceiptPanel,
  ResultsExpectations,
  SocialProof,
  ThankYouCrossSells,
  ThankYouFAQ,
  ThankYouRecommendations,
  TrustReinforcement,
  UpsellAcceptedBanner,
} from "@/components/thankyou";
import { useCart } from "@/hooks/useCart";
import { useUI } from "@/hooks/useUI";
import { useLocale } from "@/hooks/useLocale";
import { loadReceipt, type OrderReceipt } from "@/lib/order-receipt";
import { resolveCartCrossSells } from "@/data/upsells";

type Params = { orderId: string };

/**
 * Thank-you page composition.
 *
 * Section order (top → bottom) is a CRO-tuned psychological sequence,
 * not arbitrary.  Each block answers the next question the buyer's
 * mind asks in the seconds and minutes after placing the order:
 *
 *   1. ConfirmationHero        → "Did it work?"  (yes — your order is reserved)
 *   2. UpsellAcceptedBanner    → "Did my upsell go through?"  (conditional)
 *   3. CallReassuranceBanner   → "Will someone call me?  Why a Saudi number?"
 *   4. CustomerInfoReview      → "Is my number right?  Will they reach me?"
 *   5. OrderReceipt            → "What exactly did I buy?"
 *   6. DeliveryTimeline        → "What happens next?"
 *   7. ResultsExpectations     → "When will I see the benefit?"
 *   8. SocialProof             → "Are real people happy with this?"
 *   9. ThankYouFAQ             → "What if [edge case]?"  (COD objections)
 *  10. TrustReinforcement      → "Final reassurance — guarantees."
 *  11. ThankYouCrossSells      → "Anything to complete the routine?"
 *  12. ThankYouRecommendations → "What else is loved this season?"
 *  13. ContactPanel            → "How do I reach you if I need to?"
 *
 * Strict no-touch guardrails honoured by this redesign:
 *   • No change to `OrderReceipt` data contract — every section reads
 *     the existing `lines[] / customer / totals / upsellStatus` fields.
 *   • No change to checkout, webhook, or tracking code.  Purchase pixel
 *     still fires upstream in `CodCheckoutModal`.
 *   • No new fetches, no SWR, no server data shape changes.  The page
 *     remains client-only with sessionStorage as its single source.
 *   • `clearCart()` / `closeAllUI()` mount-time side effects preserved.
 *   • `excludeIds` filter for the recommendations strip preserved so
 *     we never duplicate a cross-sell into the recommendations grid.
 *
 * Section spacing is owned by each component (every section already
 * carries its own vertical padding).  The page is just a list — no
 * wrapper paddings, no margins, no global rhythm overrides.
 */
export default function ThankYouPage({ params }: { params: Promise<Params> }) {
  const { orderId } = use(params);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const clearCart = useCart((s) => s.clear);
  const closeAllUI = useUI((s) => s.closeAll);

  useEffect(() => {
    setReceipt(loadReceipt(orderId));
    setHydrated(true);
    // Cart is now an artifact of a completed order — close the loop on the
    // client. The order itself is durable on the server side.
    clearCart();
    // Defensive cleanup. The checkout flow already closes its own modal
    // before navigating, but if anything (a stray toggle, a back-nav from
    // mid-funnel) left a surface open, kill it here so the buyer lands on
    // a clean confirmation page with no popups in their face.
    closeAllUI();
  }, [orderId, clearCart, closeAllUI]);

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
      <CallReassuranceBanner />
      <CustomerInfoReview receipt={receipt} />
      <OrderReceiptPanel receipt={receipt} />
      <DeliveryTimeline />
      <ResultsExpectations />
      <SocialProof />
      <ThankYouFAQ />
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

/**
 * Degraded state — sessionStorage missing or expired.
 *
 * Still gives the buyer the most important reassurance blocks (trust
 * badges, FAQ, recommendations, contact) so a re-opened thank-you link
 * never lands on an empty page.  We deliberately omit the call-
 * reassurance and customer-info sections because we have no receipt
 * data to fill them with — better silent than fabricated.
 */
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
      <ThankYouFAQ />
      <TrustReinforcement />
      <ThankYouRecommendations receipt={null} />
      <ContactPanel orderId={orderId} />
    </>
  );
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}
