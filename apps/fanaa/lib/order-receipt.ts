/**
 * Order receipt — the snapshot the thank-you page reads.
 *
 * Persisted to `sessionStorage` (not `localStorage`) deliberately:
 *   • Survives full-page reloads of the thank-you page.
 *   • Disappears when the customer closes the tab — preserves privacy.
 *   • Cannot leak across browser profiles or shared computers.
 *
 * Receipts auto-expire after 24h to avoid stale data when a customer
 * comes back the next day to a re-used `orderId`.
 *
 * The thank-you page degrades gracefully when no receipt is found
 * (refresh after 24h, link shared with a friend, etc.) — see
 * `app/thank-you/[orderId]/page.tsx → FallbackReceipt`.
 */

import { STORAGE_KEY_RECEIPT_PREFIX } from "./brand";
import type { Locale, LocalizedString, Money } from "./types";

export type ReceiptLineSource = "base" | "post_purchase_upsell";

export type ReceiptLine = {
  productId: string;
  title: LocalizedString;
  unitPrice: Money;
  quantity: number;
  lineTotal: Money;
  source: ReceiptLineSource;
  /**
   * Thumbnail captured at checkout from the resolved product.
   *
   * The thank-you page is client-only with sessionStorage as its single
   * source — it cannot re-resolve product images at render time. Snapshot
   * (curated) products could be re-resolved via `getProductById`, but
   * AI-generated (`run_*`) products are absent from the snapshot, so the
   * receipt embeds the image (same rationale as `CartLine.productSnapshot`).
   * Optional so receipts persisted before this field still load + degrade
   * to the snapshot/placeholder fallback in `OrderReceipt`.
   */
  image?: { src: string; alt: LocalizedString };
};

export type UpsellStatus = "none" | "pending" | "accepted" | "declined" | "expired";

export type OrderReceipt = {
  orderId: string;
  /** ISO-8601 — created server-side. */
  createdAt: string;
  paymentMethod: "cod";
  locale: Locale;
  customer: {
    fullName: string;
    /** Local Saudi format (`05XXXXXXXX`). */
    phone: string;
    /** International form for click-to-call. */
    phoneE164?: string;
  };
  lines: ReceiptLine[];
  totals: {
    subtotal: Money;
    total: Money;
  };
  upsellStatus: UpsellStatus;
  /** When upsellStatus = "accepted", the line we appended. */
  upsellLine?: ReceiptLine;
  /** Internal — saved client-side, used to expire stale receipts. */
  savedAt: number;
};

const TTL_MS = 24 * 60 * 60 * 1000;

const isBrowser = (): boolean => typeof window !== "undefined";
const key = (orderId: string): string => `${STORAGE_KEY_RECEIPT_PREFIX}${orderId}`;

/* -------------------------------------------------------------------------- */
/*                                Persistence                                  */
/* -------------------------------------------------------------------------- */

export function saveReceipt(receipt: Omit<OrderReceipt, "savedAt">): void {
  if (!isBrowser()) return;
  const payload: OrderReceipt = { ...receipt, savedAt: Date.now() };
  try {
    sessionStorage.setItem(key(receipt.orderId), JSON.stringify(payload));
  } catch {
    /* storage full or disabled — degrade silently */
  }
}

export function loadReceipt(orderId: string): OrderReceipt | null {
  if (!isBrowser()) return null;
  try {
    const raw = sessionStorage.getItem(key(orderId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrderReceipt;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > TTL_MS) {
      sessionStorage.removeItem(key(orderId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearReceipt(orderId: string): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(key(orderId));
  } catch {
    /* noop */
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Mutations                                  */
/* -------------------------------------------------------------------------- */

export function setUpsellStatus(
  orderId: string,
  status: Exclude<UpsellStatus, "accepted">
): void {
  const current = loadReceipt(orderId);
  if (!current) return;
  saveReceipt({ ...current, upsellStatus: status, upsellLine: undefined });
}

export function attachUpsellLine(orderId: string, line: ReceiptLine): void {
  const current = loadReceipt(orderId);
  if (!current) return;
  const newTotal: Money = {
    amount: current.totals.total.amount + line.lineTotal.amount,
    currency: current.totals.total.currency,
  };
  saveReceipt({
    ...current,
    upsellStatus: "accepted",
    upsellLine: line,
    lines: [...current.lines, line],
    totals: { subtotal: newTotal, total: newTotal },
  });
}
