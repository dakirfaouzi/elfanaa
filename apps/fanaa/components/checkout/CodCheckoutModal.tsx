"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Check,
  Flame,
  Phone,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useUI } from "@/hooks/useUI";
import {
  useCartSubtotal,
  useResolvedCartLines,
} from "@/hooks/useCart";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { useLocale } from "@/hooks/useLocale";
import { lineTotal } from "@/lib/pricing";
import { getPrimaryImage } from "@/lib/product-image";
import { pickLocalized } from "@/lib/format";
import { formatSaudiPhoneAsYouType, validateSaudiPhone } from "@/lib/phone";
import { track, trackCommerce } from "@/lib/analytics";
import { newEventId, readAttributionCookies } from "@/lib/pixels";
import { apiUrl } from "@/lib/api";
import {
  saveReceipt,
  setUpsellStatus,
  type OrderReceipt,
  type UpsellStatus,
} from "@/lib/order-receipt";
import type { CodOrderInput } from "@/lib/types";
import { fetchGeoVerdict, type GeoVerdict } from "@/lib/geo";
import { useCart } from "@/hooks/useCart";
import { PostPurchaseUpsell } from "./PostPurchaseUpsell";

type CheckoutScreen = "form" | "upsell";
type Status = "idle" | "submitting" | "error" | "geo_blocked";
type FormState = { fullName: string; phone: string; city: string };
type Touched = Record<keyof FormState, boolean>;

const initialForm: FormState = { fullName: "", phone: "", city: "" };
const initialTouched: Touched = { fullName: false, phone: false, city: false };

/**
 * COD Checkout — premium two-field popup.
 *
 * Two-screen flow:
 *   1. `form`    → Name + Saudi phone, blur validation, sticky summary.
 *   2. `upsell`  → Single 99 SAR offer screen with 12s countdown.
 *
 * On upsell completion (accept / decline / expire) the modal closes and the
 * router navigates to `/thank-you/[orderId]`. The full receipt was persisted
 * to sessionStorage immediately after the order was created, so the page
 * loads with no second round-trip.
 */
export function CodCheckoutModal() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const open = useUI((s) => s.checkoutOpen);
  const close = useUI((s) => s.closeCheckout);
  const closeAll = useUI((s) => s.closeAll);

  const lines = useResolvedCartLines();
  const subtotal = useCartSubtotal();
  const clearCart = useCart((s) => s.clear);

  const [screen, setScreen] = useState<CheckoutScreen>("form");
  const [status, setStatus] = useState<Status>("idle");
  const [form, setForm] = useState<FormState>(initialForm);
  const [touched, setTouched] = useState<Touched>(initialTouched);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [purchasedProductIds, setPurchasedProductIds] = useState<string[]>([]);
  const [geo, setGeo] = useState<GeoVerdict | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const errors = useMemo(() => validateForm(form, t), [form, t]);
  const showError = (key: keyof FormState) => touched[key] && Boolean(errors[key]);
  const isValid = !errors.fullName && !errors.phone && !errors.city;

  // Reset whenever the modal closes — never carry stale state across opens.
  // Also fires `InitiateCheckout` exactly once per opened session so the
  // pixels register the funnel step. The matching server-side event would
  // require a phone number we don't have yet; we keep IC browser-only.
  useEffect(() => {
    if (open) {
      setScreen("form");
      setStatus("idle");
      trackCommerce("begin_checkout", {
        products: lines.map((l) => l.product),
        value: subtotal,
      });
      requestAnimationFrame(() => firstFieldRef.current?.focus());

      // Fire-and-forget geo probe. The result is purely advisory — the
      // submit handler still posts to the server, which runs the
      // authoritative MaxMind check and is the only thing that can
      // actually reject the order.
      let cancelled = false;
      fetchGeoVerdict().then((verdict) => {
        if (!cancelled) setGeo(verdict);
      });
      return () => {
        cancelled = true;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onClose = () => {
    if (status === "submitting") return;
    close();
  };

  const onChange = <K extends keyof FormState>(key: K, value: string) => {
    const next = key === "phone" ? formatSaudiPhoneAsYouType(value) : value;
    setForm((f) => ({ ...f, [key]: next }));
  };

  const onBlur = (key: keyof FormState) =>
    setTouched((tt) => ({ ...tt, [key]: true }));

  const submit = async () => {
    setTouched({ fullName: true, phone: true, city: true });

    // Always-clickable button → if anything is invalid, surface the inline
    // errors AND pull the user's eye to the first broken field. This is
    // what gives the "validate on click" UX its honest feedback loop:
    // tapping "Place order" never silently does nothing.
    if (!isValid) {
      const firstBadKey: keyof FormState = errors.fullName
        ? "fullName"
        : errors.phone
          ? "phone"
          : "city";
      if (typeof document !== "undefined") {
        const el = document.getElementById(firstBadKey) as HTMLInputElement | null;
        el?.focus({ preventScroll: false });
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setStatus("submitting");
    const phoneCheck = validateSaudiPhone(form.phone);

    // Mint the Purchase event_id NOW so both the browser pixel AND the
    // server-side CAPI fire with the same id → Meta/TikTok/Snap dedup
    // collapse them into a single conversion.
    const purchaseEventId = newEventId("pur");
    const cookies = readAttributionCookies();

    const payload: CodOrderInput & { context?: Record<string, unknown> } = {
      fullName: form.fullName.trim(),
      phone: phoneCheck.ok ? phoneCheck.normalised : form.phone,
      // `city` is consumed server-side by `composeFullAddress(city, address)`
      // and written into the Sheets "Full Address" column. There is no
      // dedicated city column in the sheet — the joined "City — Street"
      // form keeps the sheet schema unchanged.
      city: form.city.trim(),
      cart: {
        lines: lines.map(({ productId, variantId, quantity, source }) => ({
          productId,
          variantId,
          quantity,
          // Forward the per-line source so the backend can place each
          // item in the correct slot of the Sheets 3-slot format
          // (`base / upsell / cross_sell`). Falls back to `"base"`
          // for any legacy persisted cart line missing the tag.
          source: source ?? "base",
        })),
        currency: subtotal.currency,
      },
      locale,
      context: {
        event_id: purchaseEventId,
        fbp: cookies.fbp,
        fbc: cookies.fbc,
        ttp: cookies.ttp,
        sc_click_id: cookies.scClickId,
        // First-party admin attribution. Same forwarding contract as
        // `fbp`/`fbc` — never affects checkout pricing, validation, or UX.
        visitor_id: cookies.faVisitorId,
        session_id: cookies.faSessionId,
        user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        landing_url:
          typeof window !== "undefined" ? window.location.href : undefined,
        referrer: typeof document !== "undefined" ? document.referrer : undefined,
      },
    };

    try {
      const res = await fetch(apiUrl("/api/orders"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // Surface a dedicated geo-block UX for 403 + `geo_blocked`. Other
        // 4xx/5xx fall through to the generic "error" state.
        if (res.status === 403) {
          let code: string | undefined;
          try {
            const body = (await res.json()) as {
              detail?: { error?: string };
            };
            code = body?.detail?.error;
          } catch {
            /* ignore body parse error */
          }
          if (code === "geo_blocked") {
            setStatus("geo_blocked");
            return;
          }
        }
        throw new Error(String(res.status));
      }
      // Two backends return slightly different receipt shapes; normalise
      // here so the thank-you page only ever sees the OrderReceipt type.
      const raw = (await res.json()) as ApiOrderResponse;
      const data = normaliseOrderResponse(raw);

      // Browser pixel `Purchase` — same event_id as the server CAPI for dedup.
      trackCommerce("place_order", {
        products: lines.map((l) => l.product),
        value: subtotal,
        eventId: purchaseEventId,
        extra: { method: "cod", order_id: data.orderId },
      });

      // Persist the receipt for the thank-you page BEFORE switching screens.
      // The upsell screen may mutate this snapshot if the customer accepts.
      //
      // Embed each line's thumbnail from the resolved cart product so the
      // (client-only) thank-you receipt renders AI-generated `run_*` products
      // too — those are absent from the snapshot the receipt would otherwise
      // re-resolve against, which is exactly why their thumbnails fell back to
      // the placeholder. Curated products carry the same image, so the path is
      // uniform.
      const imageByProductId = new Map(
        lines.map((l) => {
          const img = getPrimaryImage(l.product);
          return [l.productId, { src: img.src, alt: img.alt }] as const;
        }),
      );
      const receiptWithImages = {
        ...data.receipt,
        lines: data.receipt.lines.map((rl) => ({
          ...rl,
          image: rl.image ?? imageByProductId.get(rl.productId),
        })),
      };
      saveReceipt({ ...receiptWithImages, upsellStatus: "pending" });

      // Order is durable on the server now — clear the local cart immediately
      // so a stray cart-drawer open (or hard refresh mid-upsell) doesn't show
      // the buyer items they've already paid for. The upsell screen reads from
      // the receipt snapshot, not from the cart, so this is safe.
      clearCart();

      setOrderId(data.orderId);
      setPurchasedProductIds(data.productIds);
      setStatus("idle");
      setScreen("upsell");
    } catch {
      setStatus("error");
    }
  };

  /**
   * Called by the upsell screen with its final disposition.
   * - "accepted" — `PostPurchaseUpsell` already attached the line to the receipt
   *   via the `/api/orders/[id]/upsell` route.
   * - Anything else — record the disposition for analytics and the
   *   "Your add-on is in" banner suppression on the thank-you page.
   *
   * Navigation choreography (fixes the ~2s flash of `/sugarbear` reported
   * from real Saudi traffic): we trigger `router.push` FIRST and DO NOT
   * close the modal here. The destination page (`app/thank-you/[orderId]`)
   * runs `closeAllUI()` in its mount effect, so the modal remains opaque
   * over the route transition and the underlying product page never
   * becomes visible. The previous order (`closeAll()` → `router.push`)
   * faded the modal out (200ms opacity transition) before the new page
   * mounted, exposing the product page underneath for the duration of
   * the client-side navigation. `useCallback` keeps the identity stable
   * so the `useEffect(...,[upsell, onComplete])` in `PostPurchaseUpsell`
   * cannot re-fire with a fresh callback and trigger a second
   * `router.push`.
   */
  const handleUpsellComplete = useCallback(
    (disposition: UpsellStatus) => {
      if (orderId && disposition !== "accepted") {
        setUpsellStatus(orderId, disposition);
      }
      if (orderId) {
        router.push(`/thank-you/${encodeURIComponent(orderId)}`);
        return;
      }
      // Degraded: no orderId means we have nowhere to send the buyer.
      // Close so they're not stuck staring at the modal.
      closeAll();
    },
    [orderId, router, closeAll]
  );

  /* ------------------------------- Render ------------------------------- */

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={screen === "form" ? t.checkout.title : undefined}
      description={screen === "form" ? t.checkout.subtitle : undefined}
      size={screen === "form" ? "lg" : "md"}
      footer={
        screen === "form" ? (
          <FormFooter
            onSubmit={submit}
            status={status}
            // Always clickable when the order is *placeable* — validation
            // errors do NOT disable the button. Clicking with an empty
            // / invalid form runs `submit()`, which marks every field as
            // touched and lets the inline error states do the talking.
            // The only hard blockers are: no items in cart, the server
            // already rejected this IP, or the soft client probe says the
            // visitor is outside KSA / on a VPN.
            disabled={
              lines.length === 0 ||
              status === "geo_blocked" ||
              geo?.allowed === false
            }
            label={`${t.checkout.placeOrder} · ${formatPrice(subtotal.amount, subtotal.currency, locale)}`}
            placing={t.checkout.placing}
          />
        ) : null
      }
    >
      {screen === "form" && (
        <div className="grid gap-8 md:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            <GeoNoticeBanner geo={geo} blocked={status === "geo_blocked"} />
            <CheckoutScarcityBanner />
            <Field
              label={t.checkout.fullName}
              id="fullName"
              error={showError("fullName") ? errors.fullName : undefined}
              hint={!showError("fullName") ? t.checkout.fullNameHint : undefined}
            >
              <Input
                ref={firstFieldRef}
                id="fullName"
                autoComplete="name"
                placeholder={t.checkout.fullNamePlaceholder}
                value={form.fullName}
                invalid={showError("fullName")}
                onChange={(e) => onChange("fullName", e.target.value)}
                onBlur={() => onBlur("fullName")}
              />
            </Field>

            <Field
              label={t.checkout.phone}
              id="phone"
              error={showError("phone") ? errors.phone : undefined}
              hint={!showError("phone") ? t.checkout.phoneHint : undefined}
            >
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                /* Canonical Arabic-phone pattern:
                   • dir="ltr"   — locks the input's content direction so
                     digits are appended in the order the user typed them.
                     Without this, some Chromium/Safari builds re-order
                     weak-LTR digit runs inside an RTL input and you get
                     "0513697421" rendered as "741 698 0523".
                   • text-right  — right-aligns content so the caret and
                     placeholder visually start from the right edge,
                     matching native Arabic input UX.
                   • The parent form stays RTL, so the label / hint /
                     error all read naturally from the right.
                   • type="tel" + inputMode="tel" preserve the mobile
                     numeric keypad and Saudi phone formatting. */
                dir="ltr"
                className="text-right"
                placeholder={t.checkout.phonePlaceholder}
                value={form.phone}
                invalid={showError("phone")}
                onChange={(e) => onChange("phone", e.target.value)}
                onBlur={() => onBlur("phone")}
              />
              <span className="mt-1 block text-[11px] text-muted/80">
                {t.checkout.phoneExample}
              </span>
            </Field>

            <Field
              label={t.checkout.city}
              id="city"
              error={showError("city") ? errors.city : undefined}
              hint={!showError("city") ? t.checkout.cityHint : undefined}
            >
              <Input
                id="city"
                autoComplete="address-level2"
                placeholder={t.checkout.cityPlaceholder}
                value={form.city}
                invalid={showError("city")}
                onChange={(e) => onChange("city", e.target.value)}
                onBlur={() => onBlur("city")}
              />
            </Field>

            {status === "error" ? (
              <p
                role="alert"
                className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
              >
                {t.checkout.error}
              </p>
            ) : null}

            <ReassuranceList />
          </div>

          <OrderSummary />
        </div>
      )}

      {screen === "upsell" && (
        <PostPurchaseUpsell
          orderProductIds={purchasedProductIds}
          orderId={orderId ?? ""}
          onComplete={handleUpsellComplete}
        />
      )}
    </Modal>
  );
}

/* ----------------------------- Response shape ---------------------------- */

/**
 * Both the in-Next.js fallback (`app/api/orders/route.ts`) and the FastAPI
 * service return order data, but in slightly different shapes. We accept
 * either and normalise to the OrderReceipt the thank-you page expects.
 */
type LegacyReceipt = Omit<OrderReceipt, "upsellStatus" | "savedAt">;
type FastApiReceipt = {
  id: string;
  createdAt: string;
  paymentMethod: "cod" | string;
  locale: "ar" | "en";
  customer: { fullName: string; phoneE164: string; phoneNational?: string };
  items: Array<{
    productId: string;
    title: string;
    quantity: number;
    unitPrice: { amount: number; currency: string };
    lineTotal: { amount: number; currency: string };
    source: "base" | "upsell" | "cross_sell";
  }>;
  subtotal: { amount: number; currency: string };
  upsellTotal: { amount: number; currency: string };
  total: { amount: number; currency: string };
};

type ApiOrderResponse =
  | {
      ok?: boolean;
      orderId: string;
      productIds?: string[];
      receipt: LegacyReceipt;
    }
  | { ok?: boolean; orderId: string; receipt: FastApiReceipt };

function normaliseOrderResponse(raw: ApiOrderResponse): {
  orderId: string;
  productIds: string[];
  receipt: LegacyReceipt;
} {
  const receipt = raw.receipt as LegacyReceipt | FastApiReceipt;

  // Detect the FastAPI shape by the presence of `items` (legacy uses `lines`).
  if ("items" in receipt && Array.isArray(receipt.items)) {
    const fa = receipt as FastApiReceipt;
    return {
      orderId: raw.orderId,
      // Exclude POST-purchase upsell lines so the upsell strategy can
      // still pick from outside the cart. Both pre-checkout sources
      // (`base` and `cross_sell`) ARE included so the strategy does not
      // re-offer a product the customer already added in-cart. Before
      // cart cross-sell tagging existed, every line had `source ===
      // "base"`; after the 3-slot rollout we keep the "everything
      // pre-upsell counts" contract by switching the filter polarity.
      productIds: fa.items
        .filter((it) => it.source !== "upsell")
        .map((it) => it.productId),
      receipt: {
        orderId: raw.orderId,
        createdAt: fa.createdAt,
        paymentMethod: "cod",
        locale: fa.locale,
        customer: {
          fullName: fa.customer.fullName,
          phone: fa.customer.phoneNational ?? fa.customer.phoneE164,
          phoneE164: fa.customer.phoneE164,
        },
        lines: fa.items.map((it) => ({
          productId: it.productId,
          title: { ar: it.title, en: it.title },
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          lineTotal: it.lineTotal,
          source:
            it.source === "upsell" ? "post_purchase_upsell" : "base",
        })),
        totals: { subtotal: fa.subtotal, total: fa.total },
      },
    };
  }

  // Legacy in-Next.js shape — already matches OrderReceipt.
  const legacy = raw as {
    orderId: string;
    productIds?: string[];
    receipt: LegacyReceipt;
  };
  return {
    orderId: legacy.orderId,
    productIds:
      legacy.productIds ??
      // Fallback path — legacy receipts only ever carried `"base"` and
      // `"post_purchase_upsell"` sources (cross-sell wasn't tagged when
      // the older shape was written). Excluding post-purchase upsells
      // preserves the original contract.
      legacy.receipt.lines
        .filter((l) => l.source !== "post_purchase_upsell")
        .map((l) => l.productId),
    receipt: legacy.receipt,
  };
}

/* --------------------------------- Helpers -------------------------------- */

function validateForm(
  form: FormState,
  t: ReturnType<typeof useLocale>["t"]
): { fullName?: string; phone?: string; city?: string } {
  const errors: { fullName?: string; phone?: string; city?: string } = {};

  if (form.fullName.trim().length < 2) errors.fullName = t.checkout.fullNameError;

  const phoneCheck = validateSaudiPhone(form.phone);
  if (!phoneCheck.ok) {
    errors.phone =
      phoneCheck.reason === "empty"
        ? t.checkout.phoneErrorEmpty
        : phoneCheck.reason === "non_digits"
          ? t.checkout.phoneErrorDigits
          : phoneCheck.reason === "wrong_prefix"
            ? t.checkout.phoneErrorPrefix
            : t.checkout.phoneErrorLength;
  }

  // City is required. The trimmed value also lands in the Sheets "Full
  // Address" column via `composeFullAddress(city, address)` server-side,
  // so empty / whitespace-only inputs must not pass.
  if (form.city.trim().length < 2) errors.city = t.checkout.cityError;

  return errors;
}

function formatPrice(amountMinor: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-SA", {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
      maximumFractionDigits: 0,
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(0)} ${currency}`;
  }
}

/* ------------------------------- Sub-views -------------------------------- */

function FormFooter({
  onSubmit,
  status,
  disabled,
  label,
  placing,
}: {
  onSubmit: () => void;
  status: Status;
  disabled: boolean;
  label: string;
  placing: string;
}) {
  return (
    <Button
      onClick={onSubmit}
      size="lg"
      fullWidth
      loading={status === "submitting"}
      disabled={disabled}
      iconStart={<Check className="size-4" />}
    >
      {status === "submitting" ? placing : label}
    </Button>
  );
}

function ReassuranceList() {
  const { t } = useLocale();
  const items = [
    { icon: ShieldCheck, label: t.checkout.noPaymentNow },
    { icon: Phone, label: t.checkout.callConfirm },
    { icon: Truck, label: t.checkout.whatsappBackup },
  ];
  return (
    <ul className="space-y-2 border-t border-line pt-4 text-[12px] text-muted">
      {items.map(({ icon: Icon, label }) => (
        <li key={label} className="inline-flex items-center gap-2">
          <Icon className="size-3.5 shrink-0" />
          {label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Two-line scarcity banner above the form. Pulls double duty —
 * social proof on top, concurrent activity on the bottom — so the
 * customer gets a quick "others are doing this, hurry" without us
 * adding a third pop-up surface.
 *
 * `activeCount` is a small randomised constant per session so the number
 * doesn't visibly tick on re-render. When real-time presence is wired
 * (Vercel KV / Pusher), swap this for a live counter.
 */
/**
 * Banner shown above the checkout form when MaxMind says the customer's
 * IP is outside KSA, an anonymising proxy / VPN, or a hosting provider —
 * or when the server already rejected an order with `geo_blocked`.
 *
 * `geo` is the soft client probe (`/geo/me`); `blocked` is set after the
 * server returns 403 + `geo_blocked` on submit. Either signal renders
 * the same banner; the submit button is disabled by the parent.
 */
function GeoNoticeBanner({
  geo,
  blocked,
}: {
  geo: GeoVerdict | null;
  blocked: boolean;
}) {
  const { t } = useLocale();
  const softBlock = geo?.allowed === false;
  if (!softBlock && !blocked) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-3 text-sm"
    >
      <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
      <div className="space-y-0.5">
        <p className="font-medium text-ink">{t.checkout.geoBlockedTitle}</p>
        <p className="text-[12px] leading-relaxed text-muted">
          {t.checkout.geoBlockedBody}
        </p>
      </div>
    </div>
  );
}

function CheckoutScarcityBanner() {
  const { t } = useLocale();
  // null on the server — populated client-side only to avoid hydration mismatch
  // caused by Math.random() producing different values on SSR vs CSR.
  const [activeCount, setActiveCount] = useState<number | null>(null);
  useEffect(() => {
    setActiveCount(6 + Math.floor(Math.random() * 9));
  }, []);
  return (
    <div className="grid gap-2 rounded-md border border-line bg-brand-soft/40 p-3 sm:grid-cols-2">
      <p className="inline-flex items-center gap-2 text-[12px] font-medium text-success">
        <Flame className="size-3.5 shrink-0" aria-hidden />
        {t.checkout.socialProof}
      </p>
      <p className="inline-flex items-center gap-2 text-[12px] font-medium text-accent">
        <Activity className="size-3.5 shrink-0" aria-hidden />
        {activeCount !== null
          ? t.checkout.activityNow.replace("{count}", String(activeCount))
          : null}
      </p>
    </div>
  );
}

function OrderSummary() {
  const { locale, t } = useLocale();
  const lines = useResolvedCartLines();
  const subtotal = useCartSubtotal();
  const format = useFormatPrice();

  return (
    <aside className="rounded-md border border-line bg-brand-soft/40 p-5 md:sticky md:top-0 md:self-start">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        {t.checkout.summaryTitle}
      </h3>

      <ul className="mt-4 space-y-3">
        {lines.map((l) => (
          <li key={l.productId} className="flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{pickLocalized(l.product.title, locale)}</p>
              <p className="text-xs text-muted">× {l.quantity}</p>
            </div>
            <span className="tabular-nums">{format(lineTotal(l.product, l.quantity))}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">{t.cart.subtotal}</span>
          <span className="tabular-nums font-medium">{format(subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>{t.cart.shipping}</span>
          <span>{t.cart.shippingAtCheckout}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3 text-base font-semibold">
          <span>{t.cart.total}</span>
          <span className="tabular-nums">{format(subtotal)}</span>
        </div>
      </div>
    </aside>
  );
}
