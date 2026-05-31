import type { ZodType } from "zod";
import type {
  CallContext,
  ImageRef,
  ProviderHealth,
  ProviderId,
} from "./types";
import type {
  ImageResult,
  ScrapeOptions,
  ScrapeResult,
  TextResult,
  VisionResult,
} from "./result-types";

/**
 * Provider contracts — the unified interfaces every adapter implements
 * (PLATFORM.md §12).
 *
 * # Why one interface per capability instead of one Provider type?
 *
 * A single `Provider` interface with optional `generateText` / `generateImage`
 * / `scrape` would force every caller to handle the "method is undefined"
 * case. Splitting by capability lets the registry resolve per-capability
 * chains and gives callers strongly-typed providers without optional-chain
 * gymnastics.
 *
 * # Cost attribution
 *
 * Every call requires a `CallContext` (`storeId`, optional `runId`). The
 * M6 Inngest middleware will wrap these calls and write a `StudioStep`
 * row per invocation. Adapters MUST NOT skip cost computation — every
 * result type's `costUsd` is non-optional.
 *
 * # Structured output via Zod
 *
 * When `schema` is provided to a text/vision call, the adapter is
 * responsible for:
 *
 *   1. Adding "respond with JSON matching this schema" to the system
 *      prompt (vendor-specific implementation).
 *   2. Parsing the response with `schema.safeParse()`.
 *   3. Populating `result.parsed` on success.
 *   4. Throwing on validation failure with `cause` carrying the
 *      Zod issues (callers can catch + retry with a "fix JSON" reprompt).
 */

/**
 * Common surface across every provider — capability tag + health probe.
 * Every concrete provider interface extends this so the registry can
 * iterate a heterogeneous list and call `.healthCheck()` uniformly.
 */
export interface BaseProvider {
  readonly id: ProviderId;
  /**
   * 1-token cheap call validating credentials + reachability. Total
   * round-trip cost MUST be ≤ $0.001 per call so the platform can
   * health-check freely on every container start.
   *
   * Never throws. Failure is communicated through `{ ok: false, errorMessage }`.
   */
  healthCheck(): Promise<ProviderHealth>;
}

// ─────────────────────────────────────────────────────────────────────────
// Text
// ─────────────────────────────────────────────────────────────────────────

export interface TextProvider extends BaseProvider {
  generate<T = string>(opts: TextCallOptions<T>): Promise<TextResult<T>>;
}

export type TextCallOptions<T = string> = {
  /** System prompt — persona, guardrails, output format constraints. */
  system: string;
  /** User prompt — the actual task content. */
  prompt: string;
  /** Optional Zod schema for structured JSON output. When set, the adapter
   *  parses the response and populates `result.parsed`. */
  schema?: ZodType<T>;
  /** 0..2 typical. Vendor-defaulted when omitted. */
  temperature?: number;
  /** Cap on output tokens. Adapters may translate to per-vendor limits. */
  maxTokens?: number;
  /** Vendor model override. When omitted the adapter picks its default. */
  model?: string;
} & CallContext;

// ─────────────────────────────────────────────────────────────────────────
// Vision
// ─────────────────────────────────────────────────────────────────────────

export interface VisionProvider extends BaseProvider {
  analyze<T = string>(opts: VisionCallOptions<T>): Promise<VisionResult<T>>;
}

export type VisionCallOptions<T = string> = {
  /** 1+ image references — R2 keys or absolute URLs. */
  images: ImageRef[];
  /** Free-form task description ("describe the product, list visible
   *  features, identify the form factor…"). */
  instructions: string;
  schema?: ZodType<T>;
  temperature?: number;
  maxTokens?: number;
  model?: string;
} & CallContext;

// ─────────────────────────────────────────────────────────────────────────
// Image generation
// ─────────────────────────────────────────────────────────────────────────

export interface ImageProvider extends BaseProvider {
  /**
   * Price ceiling for cost-budget gating. Pre-computed at adapter
   * construction time so the Inngest middleware can pre-flight a budget
   * check before kicking off N parallel image jobs.
   */
  readonly cost: { perImageUsd: number };
  generate(opts: ImageCallOptions): Promise<ImageResult>;
}

export type ImageCallOptions = {
  prompt: string;
  /** Negative prompt — vendor-supported only on some models. */
  negative?: string;
  size: { w: number; h: number };
  /**
   * Aspect-ratio label (e.g. "1:1", "4:5"). Some models (fal Kontext) take an
   * `aspect_ratio` enum rather than pixel dimensions; adapters use this when
   * present and fall back to deriving it from `size`.
   */
  aspectRatio?: string;
  /** Reference images for img2img / style transfer / character consistency. */
  referenceImages?: ImageRef[];
  /** Vendor model override ("fal-ai/flux-pro/v1.1", "fal-ai/recraft-v3"). */
  model?: string;
  /** Deterministic seed for reproducibility. */
  seed?: number;
} & CallContext;

// ─────────────────────────────────────────────────────────────────────────
// Scraper
// ─────────────────────────────────────────────────────────────────────────

export interface ScraperProvider extends BaseProvider {
  fetch(url: string, opts?: ScrapeOptions): Promise<ScrapeResult>;
}

// ─────────────────────────────────────────────────────────────────────────
// Embedding
// ─────────────────────────────────────────────────────────────────────────

export interface EmbeddingProvider extends BaseProvider {
  /** Dimensionality of the produced vectors. Used by callers to size
   *  pgvector columns at table-create time. */
  readonly dimensions: number;
  embed(opts: EmbeddingCallOptions): Promise<number[]>;
}

export type EmbeddingCallOptions = {
  input: string;
  model?: string;
} & CallContext;
