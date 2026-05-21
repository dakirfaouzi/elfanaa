import { z } from "zod";
import type { ProviderHealth } from "./types";
import type {
  ImageResult,
  ScrapeResult,
  TextResult,
  TokenUsage,
} from "./result-types";

/**
 * Zod validators for provider-layer DTOs.
 *
 * Annotated as `z.ZodType<T>` so any drift between the hand-written type
 * (the contract) and the runtime schema (the validator) is caught at
 * compile time. M4 ships these dormant — the M5 pipeline + M6 Inngest
 * middleware will invoke them where it matters (cost-attribution write
 * paths in particular).
 */

const ProviderCapabilitySchema = z.enum([
  "text",
  "vision",
  "image",
  "scraper",
  "embedding",
]);

const TokenUsageSchema: z.ZodType<TokenUsage> = z.object({
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
});

export const ProviderHealthSchema: z.ZodType<ProviderHealth> = z.object({
  ok: z.boolean(),
  providerId: z.string().min(1),
  capability: ProviderCapabilitySchema,
  model: z.string().optional(),
  latencyMs: z.number().nonnegative(),
  costUsd: z.number().nonnegative().optional(),
  errorMessage: z.string().optional(),
  detail: z.record(z.string(), z.unknown()).optional(),
});

/**
 * `parsed` is intentionally typed loose (`unknown`) — the strongly-typed
 * version `TextResult<T>` is enforced at the call site by the schema
 * passed into `generate()`. Validating the result wrapper against this
 * runtime schema only proves the wrapper shape is correct; the inner
 * `parsed` content has already been schema-validated by the adapter.
 */
export const TextResultSchema: z.ZodType<TextResult<unknown>> = z.object({
  text: z.string(),
  parsed: z.unknown().optional(),
  usage: TokenUsageSchema,
  costUsd: z.number().nonnegative(),
  latencyMs: z.number().nonnegative(),
  model: z.string().min(1),
  providerId: z.string().min(1),
  requestId: z.string().optional(),
});

export const ImageResultSchema: z.ZodType<ImageResult> = z.object({
  r2Key: z.string().optional(),
  url: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().nonnegative().optional(),
  seed: z.number().int().optional(),
  costUsd: z.number().nonnegative(),
  latencyMs: z.number().nonnegative(),
  model: z.string().min(1),
  providerId: z.string().min(1),
});

export const ScrapeResultSchema: z.ZodType<ScrapeResult> = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  description: z.string().optional(),
  markdown: z.string().optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  images: z
    .array(
      z.object({
        src: z.string().min(1),
        alt: z.string().optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      })
    )
    .optional(),
  links: z.array(z.string()).optional(),
  language: z.string().optional(),
  fetchedAt: z.string().min(1),
  durationMs: z.number().nonnegative(),
  providerId: z.string().min(1),
  costUsd: z.number().nonnegative(),
});
