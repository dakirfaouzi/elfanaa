import { signPayload } from "./verify";
import {
  WEBHOOK_HEADER_SIGNATURE,
  WEBHOOK_HEADER_TIMESTAMP,
} from "@/lib/brand";

type DispatchOptions = {
  url?: string;
  payload: unknown;
  secret?: string;
};

/**
 * Fire-and-log outbound webhook. Returns the receiving service's response.
 *
 * In production, swap the bare fetch for a queued job (e.g. Inngest, QStash,
 * or a self-hosted BullMQ worker) so retries survive a cold serverless
 * function. The signature contract intentionally mirrors Stripe / Shopify
 * for easy recipient implementation, with the brand-prefixed header names
 * pulled from `lib/brand.ts` so dispatcher and verifier can never drift.
 */
export async function dispatchWebhook({ url, payload, secret }: DispatchOptions) {
  if (!url) return { ok: true, skipped: true as const };

  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  const sig = secret ? signPayload(body, secret, ts) : undefined;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sig
        ? {
            [WEBHOOK_HEADER_TIMESTAMP]: String(ts),
            [WEBHOOK_HEADER_SIGNATURE]: sig,
          }
        : {}),
    },
    body,
    cache: "no-store",
  });

  return { ok: res.ok, status: res.status };
}
