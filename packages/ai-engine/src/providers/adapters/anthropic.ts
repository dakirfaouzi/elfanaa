import Anthropic from "@anthropic-ai/sdk";
import type {
  Adapter,
  ProviderHealth,
  ProviderId,
} from "../types";
import type {
  TextProvider,
  VisionProvider,
  TextCallOptions,
  VisionCallOptions,
} from "../contracts";
import type { TextResult, VisionResult } from "../result-types";
import { providerEnv } from "../env";

/**
 * Anthropic adapter — Claude Sonnet 4.6 primary for text + vision
 * (PLATFORM.md §12 "Adapter table").
 *
 * # Why Anthropic is text + vision primary
 *
 *   • Best-in-class Arabic copywriting register for GCC luxury voice
 *     (the M5 copy stage's Khaleeji prompt was tuned against Claude;
 *     Sonnet 4.6 preserves register fidelity across the 3.5 → 4.x bump).
 *   • Vision model accepts multiple images in a single message — saves
 *     the M5 vision stage from batching.
 *   • Structured-output JSON via system-prompt instruction + reliable
 *     parsing (no native JSON-mode like OpenAI, but reliably steered).
 *
 * # Health-check ping
 *
 * Uses claude-haiku-4-5 (the cheapest Anthropic model) with max_tokens=1,
 * costing ~$0.000001 per ping. Safe to call on every container start
 * and per-deployment-smoke-test.
 */

const PROVIDER_ID: ProviderId = "anthropic";

// Model defaults — pinned to the **4.6-generation dateless IDs**.
//
// History of two deprecation pain-points that informed this choice:
//
//   1. `claude-3-5-sonnet-latest` (used by M2-M11): NOT universally
//      resolvable. Some accounts / regions / projects 404'd silently.
//      Switched to dated alias in feb9161.
//
//   2. `claude-3-5-sonnet-20241022` (used post-feb9161): now RETIRED
//      (Anthropic retired the 3.5 family in late 2025 / early 2026).
//      Any pipeline still pointing at it returns:
//        HTTP 404 {"type":"error","error":{"type":"not_found_error",
//                  "message":"model: claude-3-5-sonnet-20241022"}}
//
// Per Anthropic's 4.6-generation model-ID design, dateless IDs like
// `claude-sonnet-4-6` are NOT convenience aliases — they're the
// canonical, immutable snapshot. Weights/config never change under a
// given ID; new versions ship under new IDs (`-4-7`, `-4-8`, ...).
// This makes them a strictly better contract than both `-latest`
// (unresolvable on some accounts) and dated aliases (subject to
// retirement). Refs:
//   https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions
//   https://platform.claude.com/docs/en/about-claude/model-deprecations
//
// Each model can be overridden via env vars (`ANTHROPIC_TEXT_MODEL`,
// `ANTHROPIC_VISION_MODEL`, `ANTHROPIC_HEALTH_MODEL`) — see
// `providerEnv.anthropic*Model()` — so bumping to a newer SKU
// (Claude Sonnet 4.7, Opus 5, …) doesn't require a code change. Cost
// tracking handles unknown SKUs via family-prefix fallback in
// `computeCostUsd()` below.
const BUILTIN_TEXT_MODEL = "claude-sonnet-4-6";
const BUILTIN_VISION_MODEL = "claude-sonnet-4-6";
const BUILTIN_HEALTH_MODEL = "claude-haiku-4-5";

function defaultTextModel(): string {
  return providerEnv.anthropicTextModel() ?? BUILTIN_TEXT_MODEL;
}
function defaultVisionModel(): string {
  return providerEnv.anthropicVisionModel() ?? BUILTIN_VISION_MODEL;
}
function defaultHealthModel(): string {
  return providerEnv.anthropicHealthModel() ?? BUILTIN_HEALTH_MODEL;
}

// Price table (USD per 1M tokens, non-cached). Source: Anthropic's
// public pricing page as of May 2026:
//   https://platform.claude.com/docs/en/about-claude/pricing
// Re-validate when bumping major model versions.
//
// Notable price shift: the Opus 4.5 generation dropped the input/output
// rates from $15/$75 to $5/$25 vs. Opus 4 / Opus 3. Don't assume the
// old Opus rate carries forward to new IDs.
//
// Lookup tries the exact model first, then a family prefix match so a
// future operator who sets `ANTHROPIC_TEXT_MODEL=claude-sonnet-4-7`
// (a future SKU we haven't seen yet) still gets cost recording
// without us shipping a code update.
const PRICE_PER_M_TOKENS: Record<string, { in: number; out: number }> = {
  // ─── Active in 2026 ────────────────────────────────────────────────
  // Opus 4.7 / 4.6 / 4.5 share pricing ($5 in / $25 out).
  "claude-opus-4-7": { in: 5, out: 25 },
  "claude-opus-4-6": { in: 5, out: 25 },
  "claude-opus-4-5": { in: 5, out: 25 },
  "claude-opus-4-5-20251101": { in: 5, out: 25 },
  // Sonnet 4.6 / 4.5 share pricing ($3 in / $15 out).
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-sonnet-4-5": { in: 3, out: 15 },
  "claude-sonnet-4-5-20250929": { in: 3, out: 15 },
  // Haiku 4.5.
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-haiku-4-5-20251001": { in: 1, out: 5 },
  // ─── Deprecated (retire 2026-06-15) — kept for cost tracking on
  //      any in-flight run still referencing them.
  "claude-sonnet-4-20250514": { in: 3, out: 15 },
  "claude-sonnet-4-0": { in: 3, out: 15 },
  "claude-opus-4-20250514": { in: 15, out: 75 },
  "claude-opus-4-0": { in: 15, out: 75 },
  "claude-opus-4-1": { in: 15, out: 75 },
  "claude-opus-4-1-20250805": { in: 15, out: 75 },
  // ─── Retired (will 404 on the API). Kept ONLY so historical run
  //      records with these models still cost-resolve correctly when
  //      rendered in the Studio's runs detail view. New requests
  //      MUST NOT use them.
  "claude-3-5-sonnet-20241022": { in: 3, out: 15 },
  "claude-3-5-sonnet-20240620": { in: 3, out: 15 },
  "claude-3-5-sonnet-latest": { in: 3, out: 15 },
  "claude-3-5-haiku-20241022": { in: 0.8, out: 4 },
  "claude-3-5-haiku-latest": { in: 0.8, out: 4 },
  "claude-3-7-sonnet-20250219": { in: 3, out: 15 },
  "claude-3-opus-20240229": { in: 15, out: 75 },
  "claude-3-opus-latest": { in: 15, out: 75 },
};

function computeCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  // Exact match first.
  let p = PRICE_PER_M_TOKENS[model];
  // Family prefix fallback — covers future snapshots of the same SKU.
  // Ordering matters: more specific prefixes must come before their
  // generic ancestors (e.g. `claude-opus-4-1` must be checked before
  // `claude-opus-4` since the former kept the $15/$75 rate while the
  // 4.5+ family dropped to $5/$25).
  if (!p) {
    if (model.startsWith("claude-opus-4-1")) p = { in: 15, out: 75 };
    else if (model.startsWith("claude-opus-4-0") || model === "claude-opus-4") p = { in: 15, out: 75 };
    else if (model.startsWith("claude-opus-4")) p = { in: 5, out: 25 }; // 4.5, 4.6, 4.7, future 4.x
    else if (model.startsWith("claude-sonnet-4")) p = { in: 3, out: 15 };
    else if (model.startsWith("claude-haiku-4")) p = { in: 1, out: 5 };
    else if (model.startsWith("claude-3-5-sonnet")) p = { in: 3, out: 15 };
    else if (model.startsWith("claude-3-5-haiku")) p = { in: 0.8, out: 4 };
    else if (model.startsWith("claude-3-7-sonnet")) p = { in: 3, out: 15 };
    else if (model.startsWith("claude-3-opus")) p = { in: 15, out: 75 };
    else p = { in: 3, out: 15 }; // safe default (Sonnet rate)
  }
  return (tokensIn * p.in + tokensOut * p.out) / 1_000_000;
}

/**
 * Build a multi-modal Anthropic message content array from a list of
 * image references. R2 keys are NOT resolved here — the caller (M5
 * vision stage) is responsible for swapping R2 keys for signed URLs
 * before calling. We pass URLs through Anthropic's `image.source.url`
 * shape directly; base64 inlining is deliberately avoided to keep
 * request bodies small.
 *
 * Return type is inferred (no explicit annotation) because the SDK's
 * `ContentBlockParam` type isn't directly exported across all 0.x
 * versions. The `as const` literals give TypeScript enough info to
 * narrow `type` to the correct discriminator, and the SDK's call
 * signature widens at the call site.
 */
function buildVisionContent(instructions: string, imageUrls: string[]) {
  return [
    ...imageUrls.map(
      (url) =>
        ({
          type: "image" as const,
          source: { type: "url" as const, url },
        })
    ),
    { type: "text" as const, text: instructions },
  ];
}

/**
 * If the caller provides a Zod schema, append a JSON-output instruction
 * to the system prompt. Anthropic doesn't have native JSON-mode but
 * steers reliably with this pattern + low temperature.
 *
 * The actual `safeParse()` happens after the call in `parseStructuredOutput()`.
 */
function withSchemaInstruction(system: string, hasSchema: boolean): string {
  if (!hasSchema) return system;
  return `${system}\n\nRespond ONLY with a single JSON object matching the requested schema. No prose, no markdown fences, no explanation — just the raw JSON.`;
}

/**
 * Best-effort JSON extraction. Claude usually returns clean JSON when
 * steered, but occasionally wraps it in ```json fences. This helper
 * strips them before `safeParse()`.
 */
function extractJsonBlob(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
}

/**
 * Run the user-supplied Zod schema against the response text. Throws
 * on validation failure with `cause` carrying the Zod issues so the
 * pipeline can catch + retry with a "fix JSON" reprompt (PLATFORM.md
 * §11 stage 04 failure mode).
 */
function parseStructuredOutput<T>(
  text: string,
  schema: TextCallOptions<T>["schema"]
): T | undefined {
  if (!schema) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(extractJsonBlob(text));
  } catch (err) {
    throw new Error("anthropic_json_parse_failed", { cause: err });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error("anthropic_schema_validation_failed", {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

// ─────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────

/**
 * Construct the Anthropic adapter. Reads `ANTHROPIC_API_KEY` lazily —
 * returns an adapter with `text`/`vision` capability fields set to
 * **stub** providers when the key is missing. The stubs always return
 * `{ ok: false, errorMessage: "missing_api_key" }` from healthCheck()
 * and throw on `generate()`/`analyze()` — never silently no-op.
 */
export function createAnthropicAdapter(): Adapter {
  const apiKey = providerEnv.anthropicApiKey();

  if (!apiKey) {
    return {
      id: PROVIDER_ID,
      text: createStubTextProvider(),
      vision: createStubVisionProvider(),
    };
  }

  const client = new Anthropic({ apiKey });

  const text: TextProvider = {
    id: PROVIDER_ID,

    async healthCheck(): Promise<ProviderHealth> {
      const healthModel = defaultHealthModel();
      const startedAt = performance.now();
      try {
        const res = await client.messages.create({
          model: healthModel,
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        });
        const latencyMs = Math.round(performance.now() - startedAt);
        const inTok = res.usage?.input_tokens ?? 0;
        const outTok = res.usage?.output_tokens ?? 0;
        return {
          ok: true,
          providerId: PROVIDER_ID,
          capability: "text",
          model: healthModel,
          latencyMs,
          costUsd: computeCostUsd(healthModel, inTok, outTok),
          detail: { requestId: res.id, stopReason: res.stop_reason },
        };
      } catch (err) {
        return {
          ok: false,
          providerId: PROVIDER_ID,
          capability: "text",
          model: healthModel,
          latencyMs: Math.round(performance.now() - startedAt),
          errorMessage: errorMessage(err),
        };
      }
    },

    async generate<T = string>(
      opts: TextCallOptions<T>
    ): Promise<TextResult<T>> {
      const model = opts.model ?? defaultTextModel();
      const startedAt = performance.now();
      const res = await client.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature,
        system: withSchemaInstruction(opts.system, !!opts.schema),
        messages: [{ role: "user", content: opts.prompt }],
      });
      const latencyMs = Math.round(performance.now() - startedAt);
      const out = res.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");
      const inTok = res.usage.input_tokens;
      const outTok = res.usage.output_tokens;
      return {
        text: out,
        parsed: opts.schema
          ? parseStructuredOutput<T>(out, opts.schema)
          : (out as unknown as T),
        usage: { tokensIn: inTok, tokensOut: outTok },
        costUsd: computeCostUsd(model, inTok, outTok),
        latencyMs,
        model,
        providerId: PROVIDER_ID,
        requestId: res.id,
      };
    },
  };

  const vision: VisionProvider = {
    id: PROVIDER_ID,

    async healthCheck(): Promise<ProviderHealth> {
      // Vision health probe shares the cheap text health endpoint —
      // verifying the API key + reachability is sufficient. Sending an
      // actual image would 10x the cost and add a network leg.
      const result = await text.healthCheck();
      return { ...result, capability: "vision" };
    },

    async analyze<T = string>(
      opts: VisionCallOptions<T>
    ): Promise<VisionResult<T>> {
      const model = opts.model ?? defaultVisionModel();
      const startedAt = performance.now();
      const imageUrls = opts.images.map((r) => r.src);
      const res = await client.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature,
        system: withSchemaInstruction(
          "You are a vision analysis assistant.",
          !!opts.schema
        ),
        messages: [
          {
            role: "user",
            content: buildVisionContent(opts.instructions, imageUrls),
          },
        ],
      });
      const latencyMs = Math.round(performance.now() - startedAt);
      const out = res.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");
      const inTok = res.usage.input_tokens;
      const outTok = res.usage.output_tokens;
      return {
        text: out,
        parsed: opts.schema
          ? parseStructuredOutput<T>(out, opts.schema)
          : (out as unknown as T),
        usage: { tokensIn: inTok, tokensOut: outTok },
        costUsd: computeCostUsd(model, inTok, outTok),
        latencyMs,
        model,
        providerId: PROVIDER_ID,
        requestId: res.id,
      };
    },
  };

  return {
    id: PROVIDER_ID,
    text,
    vision,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Stub providers — used when ANTHROPIC_API_KEY is unset
// ─────────────────────────────────────────────────────────────────────────

function createStubTextProvider(): TextProvider {
  return {
    id: PROVIDER_ID,
    async healthCheck() {
      return {
        ok: false,
        providerId: PROVIDER_ID,
        capability: "text",
        latencyMs: 0,
        errorMessage: "missing_api_key:ANTHROPIC_API_KEY",
      };
    },
    async generate() {
      throw new Error(
        "anthropic_text_unavailable: ANTHROPIC_API_KEY is not set"
      );
    },
  };
}

function createStubVisionProvider(): VisionProvider {
  return {
    id: PROVIDER_ID,
    async healthCheck() {
      return {
        ok: false,
        providerId: PROVIDER_ID,
        capability: "vision",
        latencyMs: 0,
        errorMessage: "missing_api_key:ANTHROPIC_API_KEY",
      };
    },
    async analyze() {
      throw new Error(
        "anthropic_vision_unavailable: ANTHROPIC_API_KEY is not set"
      );
    },
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
