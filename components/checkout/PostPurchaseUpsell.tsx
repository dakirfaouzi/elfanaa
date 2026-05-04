"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Timer, Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useLocale } from "@/hooks/useLocale";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { useCountdown } from "@/hooks/useCountdown";
import { usePostPurchaseUpsell } from "@/hooks/useUpsells";
import { POST_PURCHASE_TIMER_SECONDS } from "@/lib/upsell/strategy";
import { pickLocalized } from "@/lib/format";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { attachUpsellLine, type UpsellStatus } from "@/lib/order-receipt";
import { apiUrl } from "@/lib/api";

type Props = {
  orderProductIds: string[];
  orderId: string;
  /** Called when the user finishes — disposition tags the funnel for analytics. */
  onComplete: (status: UpsellStatus) => void;
};

type AcceptStatus = "idle" | "submitting" | "accepted" | "error";

/**
 * Post-purchase one-click upsell screen — premium edition.
 *
 * Anchoring (Conversion Studio, Shopify research):
 *   • Compare-at price shown as strikethrough next to the 99 SAR offer.
 *   • "Save X SAR" badge for absolute savings, "-Y%" badge for relative.
 *   • Anchor ratio enforced upstream by `lib/upsell/strategy.ts` — products
 *     are pre-filtered to the 1.5x–6x credibility window so a 99 SAR price
 *     never feels fake.
 *
 * Urgency (Aftersell, NeuroscienceMarketing):
 *   • 12s countdown — short enough to feel urgent, long enough to read.
 *   • Smooth shrinking progress bar (100ms tick under the hood).
 *   • Bar shifts amber → red as time runs out.
 *   • Honest expiry: when the timer hits zero, the offer is genuinely gone.
 *     We do NOT silently accept and we do NOT reset the timer if the user
 *     idles. The decline button is replaced with "Continue to confirmation".
 *
 * One offer rule:
 *   • Exactly ONE product, ONE price (POST_PURCHASE_OFFER_PRICE).
 *   • No carousel, no decoy options, no "let the customer pick".
 *   • If no eligible product exists for this order, the screen self-skips.
 */
export function PostPurchaseUpsell({ orderProductIds, orderId, onComplete }: Props) {
  const { locale, t } = useLocale();
  const format = useFormatPrice();
  const upsell = usePostPurchaseUpsell(orderProductIds);

  const [status, setStatus] = useState<AcceptStatus>("idle");

  // Cancel pending continue if the parent unmounts mid-celebration / mid-expiry.
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, []);

  const { secondsLeft, progress, expired } = useCountdown(POST_PURCHASE_TIMER_SECONDS, {
    autoStart: Boolean(upsell),
    onExpire: () => {
      if (!upsell) return;
      track("upsell_expired", {
        item_id: upsell.product.id,
        surface: "post_purchase",
        order_id: orderId,
      });
      // Honest expiry → auto-advance to thank-you. The customer briefly
      // sees the "offer ended" card (so the urgency was real, not a UI
      // trick), then we move them along without making them click again.
      // 1500ms is long enough to read the two-line expired card and
      // short enough that nobody feels stuck.
      transitionTimer.current = setTimeout(() => onComplete("expired"), 1500);
    },
  });

  // Track the impression once when an offer mounts (not on re-renders).
  useEffect(() => {
    if (!upsell) return;
    track("view_upsell", {
      item_id: upsell.product.id,
      surface: "post_purchase",
      order_id: orderId,
      reason: upsell.reason,
      score: upsell.score,
      value: upsell.offerPrice.amount / 100,
      currency: upsell.offerPrice.currency,
    });
  }, [upsell, orderId]);

  // No eligible offer → never block the funnel; jump straight to success.
  useEffect(() => {
    if (!upsell) onComplete("none");
  }, [upsell, onComplete]);

  if (!upsell) return null;

  const { product, offerPrice, basePrice, savings, discountPercent, reason } = upsell;
  const image = product.images[0];
  const reasonCopy = reasonText(reason, t);

  const accept = async () => {
    if (status !== "idle" || expired) return;
    setStatus("submitting");
    track("accept_upsell", {
      item_id: product.id,
      surface: "post_purchase",
      order_id: orderId,
      value: offerPrice.amount / 100,
      currency: offerPrice.currency,
    });

    try {
      // FastAPI exposes a slightly different sub-path; the Next.js route
      // accepts either form via apiUrl resolution.
      const path = process.env.NEXT_PUBLIC_API_BASE_URL
        ? `/orders/${encodeURIComponent(orderId)}/upsell/accept`
        : `/api/orders/${encodeURIComponent(orderId)}/upsell`;
      const res = await fetch(apiUrl(path), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: 1, locale }),
      });
      if (!res.ok) throw new Error(String(res.status));
      // Both backends return the upsell line. The Next.js route returns
      // `line`; FastAPI returns the full updated order — extract the
      // upsell line from `items` in that case.
      const data = (await res.json()) as {
        line?: {
          productId: string;
          title: typeof product.title;
          unitPrice: typeof offerPrice;
          quantity: number;
          lineTotal: typeof offerPrice;
          source: "post_purchase_upsell";
        };
        items?: Array<{
          productId: string;
          title: string;
          quantity: number;
          unitPrice: typeof offerPrice;
          lineTotal: typeof offerPrice;
          source: string;
        }>;
      };
      const line =
        data.line ??
        (() => {
          const upsellItem = data.items?.find(
            (it) => it.productId === product.id && it.source === "upsell"
          );
          if (!upsellItem) return null;
          return {
            productId: upsellItem.productId,
            title: product.title,
            unitPrice: upsellItem.unitPrice,
            quantity: upsellItem.quantity,
            lineTotal: upsellItem.lineTotal,
            source: "post_purchase_upsell" as const,
          };
        })();
      if (!line) throw new Error("upsell_response_missing_line");
      // Persist the upsell line into the receipt so the thank-you page
      // can render the "Your add-on is in" banner + the line in the summary.
      attachUpsellLine(orderId, line);
      setStatus("accepted");
      // Brief celebratory pause before transitioning so the customer sees
      // their tap "land". 900ms is the sweet spot — long enough to feel
      // confirmed, short enough not to feel slow.
      transitionTimer.current = setTimeout(() => onComplete("accepted"), 900);
    } catch {
      // Acceptance failed — the main order is still fine. Move on without
      // blocking; surface the error silently to analytics.
      setStatus("error");
      transitionTimer.current = setTimeout(() => onComplete("declined"), 1200);
    }
  };

  const decline = () => {
    track("decline_upsell", {
      item_id: product.id,
      surface: "post_purchase",
      order_id: orderId,
      expired,
    });
    onComplete(expired ? "expired" : "declined");
  };

  return (
    <div className="space-y-6">
      <UrgencyHeader
        expired={expired}
        secondsLeft={secondsLeft}
        progress={progress}
        eyebrow={t.upsell.eyebrow}
        timerLabel={t.upsell.timerLabel}
        timerSeconds={t.upsell.timerSeconds}
        timerExpired={t.upsell.timerExpired}
      />

      <header className="space-y-2 text-center">
        <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
          {t.upsell.title}
        </h2>
        <p className="text-sm text-muted">{t.upsell.subtitle}</p>
      </header>

      <article
        className={cn(
          "relative overflow-hidden rounded-md border bg-bg shadow-card transition-opacity",
          expired ? "border-line opacity-60" : "border-ink/15"
        )}
      >
        <div className="grid gap-0 md:grid-cols-[200px_1fr]">
          <div className="relative aspect-square overflow-hidden bg-brand-soft md:aspect-auto md:h-full">
            <Image
              src={image.src}
              alt={pickLocalized(image.alt, locale)}
              fill
              sizes="(min-width: 768px) 200px, 100vw"
              className="object-cover"
            />
            {!expired && (
              <span className="absolute end-3 top-3 inline-flex items-center gap-1 rounded-full bg-ink/95 px-2.5 py-1 text-[11px] font-semibold text-bg backdrop-blur">
                -{discountPercent}%
              </span>
            )}
          </div>

          <div className="flex flex-col justify-between gap-4 p-5 md:p-6">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                {reasonCopy}
              </p>
              <h3 className="font-display text-xl font-semibold leading-tight tracking-tight md:text-2xl">
                {pickLocalized(product.title, locale)}
              </h3>
              <p className="line-clamp-2 text-sm text-muted">
                {pickLocalized(product.description, locale)}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-2xl font-semibold tabular-nums">
                  {format(offerPrice)}
                </span>
                <span className="text-sm text-muted line-through tabular-nums">
                  {format(basePrice)}
                </span>
              </div>
              <p className="text-[12px] text-success">
                {t.upsell.saveBadge} {format(savings)} {t.upsell.youSaveSuffix}
              </p>
            </div>
          </div>
        </div>
      </article>

      <div className="space-y-2.5">
        {!expired ? (
          <>
            <Button
              onClick={accept}
              size="lg"
              fullWidth
              loading={status === "submitting"}
              disabled={status === "accepted"}
              iconStart={
                status === "accepted" ? (
                  <Check className="size-4" />
                ) : (
                  <Sparkles className="size-4" />
                )
              }
            >
              {status === "accepted"
                ? t.upsell.addedBadge
                : `${t.upsell.accept} · ${format(offerPrice)}`}
            </Button>

            <button
              type="button"
              onClick={decline}
              disabled={status === "accepted" || status === "submitting"}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium text-muted transition-colors hover:text-ink disabled:opacity-40"
            >
              <X className="size-3.5" />
              {t.upsell.declineWithTimer}
            </button>

            <p className="text-center text-[11px] text-muted/80">
              {t.upsell.noPaymentChange}
            </p>
          </>
        ) : (
          // Post-expiry state — no buttons. The countdown's onExpire
          // hook auto-advances to the thank-you page; the customer just
          // reads the "offer ended" card briefly while we transition.
          <ExpiredCard
            title={t.upsell.timerExpired}
            body={t.upsell.timerExpiredBody}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------- Sub-views ------------------------------- */

function UrgencyHeader({
  expired,
  secondsLeft,
  progress,
  eyebrow,
  timerLabel,
  timerSeconds,
  timerExpired,
}: {
  expired: boolean;
  secondsLeft: number;
  progress: number;
  eyebrow: string;
  timerLabel: string;
  timerSeconds: string;
  timerExpired: string;
}) {
  const danger = !expired && progress < 0.33;
  const warn = !expired && progress < 0.66 && progress >= 0.33;

  const barColor = expired
    ? "bg-muted/40"
    : danger
      ? "bg-danger"
      : warn
        ? "bg-warning"
        : "bg-success";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
          <Sparkles className="size-3" />
          {eyebrow}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[12px] font-medium tabular-nums",
            expired ? "text-muted" : danger ? "text-danger" : "text-ink"
          )}
          dir="ltr"
        >
          {expired ? (
            <>
              <Clock className="size-3.5" />
              {timerExpired}
            </>
          ) : (
            <>
              <Timer
                className={cn(
                  "size-3.5",
                  danger && "animate-pulse"
                )}
              />
              {timerLabel} {String(secondsLeft).padStart(2, "0")}
              {timerSeconds}
            </>
          )}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="h-1 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className={cn("h-full origin-start transition-[width] duration-100 ease-linear", barColor)}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

function ExpiredCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-line bg-brand-soft/40 p-4 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-[12px] text-muted">{body}</p>
    </div>
  );
}

/* --------------------------------- Helpers -------------------------------- */

function reasonText(
  reason: "editorial" | "curated" | "complement" | "collection" | "fallback",
  t: ReturnType<typeof useLocale>["t"]
): string {
  switch (reason) {
    case "editorial":
    case "curated":
      return t.upsell.reasonCurated;
    case "collection":
      return t.upsell.reasonCollection;
    case "complement":
      return t.upsell.reasonComplement;
    case "fallback":
    default:
      return t.upsell.reasonFallback;
  }
}
