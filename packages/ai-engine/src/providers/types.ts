import type { StoreId } from "@platform/catalog-schema";

/**
 * Provider-layer types — the small structural pieces every contract /
 * adapter / registry consumer shares. Kept separate from contracts.ts so
 * the contract file can be read top-to-bottom without 200 lines of
 * primitive types in front of it.
 *
 * Everything here is data-shape only. Adapters never import vendor SDKs
 * from this file — that rule is enforced by convention (and by the
 * directory layout — vendor SDK imports live exclusively in
 * `./adapters/<vendor>.ts`).
 */

/**
 * Stable adapter identifier — matches the file name in `./adapters/` and
 * the value used inside `STUDIO_*_PROVIDERS` chains.
 *
 * The `& {}` suffix preserves IDE autocomplete on known IDs while still
 * accepting any string. A new vendor can be added with a new adapter
 * file without bumping this union.
 */
export type ProviderId =
  | "anthropic"
  | "openai"
  | "fal"
  | "firecrawl"
  | (string & {});

/**
 * Capability tag — one provider call shape per capability. A single
 * vendor adapter may populate multiple capabilities (Anthropic = text +
 * vision; OpenAI = text + vision + embedding). The registry resolves
 * per capability, NOT per provider.
 */
export type ProviderCapability =
  | "text"
  | "vision"
  | "image"
  | "scraper"
  | "embedding";

/**
 * Result of a `healthCheck()` call. Designed for both:
 *
 *   • CLI consumption — the `pnpm --filter @platform/ai-engine ping`
 *     script prints a table of these.
 *   • Future dashboard rollup — the M6+ /admin/studio/providers route
 *     aggregates StudioStep rows; the same shape lands there.
 *
 * `ok === false` MUST come with an `errorMessage`. `latencyMs` is
 * recorded even on failure so a misbehaving provider's slow-fail
 * surfaces alongside its successes.
 */
export type ProviderHealth = {
  ok: boolean;
  providerId: ProviderId;
  capability: ProviderCapability;
  /** Vendor model used for the ping (e.g. "claude-haiku-4-5"). */
  model?: string;
  latencyMs: number;
  /** Approximate cost of the ping in USD (≤ 0.001 for any compliant adapter). */
  costUsd?: number;
  errorMessage?: string;
  /** Free-form provider-specific detail (rate-limit headers, request ID). */
  detail?: Record<string, unknown>;
};

/**
 * Multi-capability adapter shape — what each `create<Vendor>Adapter()`
 * factory returns.
 *
 * Optional capability fields are present only when:
 *
 *   1. The vendor supports that capability, AND
 *   2. The required API key is configured in the environment.
 *
 * When (1) holds but (2) does not, the field is present but its
 * `healthCheck()` always returns `{ ok: false, errorMessage: "missing_api_key" }`
 * — keeps registry chain semantics simple (the chain is "valid" as long
 * as at least one element instantiates; missing keys just degrade silently).
 */
export interface Adapter {
  id: ProviderId;
  text?: import("./contracts").TextProvider;
  vision?: import("./contracts").VisionProvider;
  image?: import("./contracts").ImageProvider;
  scraper?: import("./contracts").ScraperProvider;
  embedding?: import("./contracts").EmbeddingProvider;
}

/**
 * Per-capability provider chain returned by the registry resolver.
 *
 * `primary` is the first reachable adapter for the capability;
 * `fallbacks` is the rest of the chain in order. Callers SHOULD attempt
 * primary, fall through to fallbacks on retryable failure. Non-retryable
 * failures (4xx auth, malformed input) abort the chain immediately.
 *
 * `primary` is null when no adapter in the chain successfully
 * instantiates — typically because every API key in the chain is unset.
 */
export type ProviderChain<T> = {
  primary: T | null;
  fallbacks: T[];
};

// ── Inputs that flow into every adapter call ───────────────────────────────

/**
 * Reference to an image — either an R2 key (post-M5 storage wiring) or
 * an absolute URL. Adapters must accept both; the FanaaPublisher and
 * Studio resolve R2 keys to signed URLs before calling.
 */
export type ImageRef = {
  /** R2 key like "stores/fanaa/runs/r_abc/img/01.webp" OR absolute https URL. */
  src: string;
  alt?: string;
};

/**
 * Cost / usage attribution context. Every provider call carries this so
 * the M6 Inngest middleware can write structured cost rows to
 * `StudioStep` (PLATFORM.md §12 "Provider observability").
 *
 * `storeId` is REQUIRED — drives per-store budget enforcement
 * (`StoreConfig.costCeilingPerDraftUsd`). `runId` is optional only
 * because M4 health-check calls don't belong to a run.
 */
export type CallContext = {
  storeId: StoreId;
  runId?: string;
};
