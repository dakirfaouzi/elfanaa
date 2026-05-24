import OpenAI from "openai";
import type {
  Adapter,
  ProviderHealth,
  ProviderId,
} from "../types";
import type {
  EmbeddingCallOptions,
  EmbeddingProvider,
  TextCallOptions,
  TextProvider,
  VisionCallOptions,
  VisionProvider,
} from "../contracts";
import type { TextResult, VisionResult } from "../result-types";
import { providerEnv } from "../env";
import { parseJsonWithRepair } from "../_helpers/parse-json";

/**
 * OpenAI adapter — text + vision fallback, embedding primary
 * (PLATFORM.md §12 "Adapter table").
 *
 * # Why OpenAI is fallback-only for text/vision
 *
 * Anthropic out-performs OpenAI on the Khaleeji Arabic register the
 * Studio's M5 copy stage needs, and OpenAI's vision is weaker on
 * lifestyle/product photography for the Studio's vision stage. OpenAI
 * is kept exclusively as a failover so any single-vendor outage doesn't
 * stop the pipeline mid-draft.
 *
 * # Why OpenAI is primary for embeddings
 *
 * `text-embedding-3-small` is the cheapest stable multilingual embedder
 * with 1536-dim output that fits naturally into pgvector. Anthropic
 * doesn't ship a public embedding API; fal.ai is image-only.
 *
 * # Health-check ping
 *
 * Uses an `embeddings.create()` call against `text-embedding-3-small`
 * with a single-character input. Total cost ~$0.00000002 per ping —
 * effectively free.
 */

const PROVIDER_ID: ProviderId = "openai";

const DEFAULT_TEXT_MODEL = "gpt-4o-mini";
const DEFAULT_VISION_MODEL = "gpt-4o-mini";
const DEFAULT_EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMENSIONS = 1536;

// Pricing (USD per 1M tokens) — source: https://openai.com/pricing as of 2024-10.
const PRICE_PER_M_TOKENS: Record<string, { in: number; out: number }> = {
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
};

// Embedding pricing (USD per 1M tokens; output-only).
const EMBED_PRICE_PER_M: Record<string, number> = {
  "text-embedding-3-small": 0.02,
  "text-embedding-3-large": 0.13,
};

function computeTextCost(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICE_PER_M_TOKENS[model] ?? { in: 0.15, out: 0.6 };
  return (tokensIn * p.in + tokensOut * p.out) / 1_000_000;
}

function computeEmbedCost(model: string, tokensIn: number): number {
  const p = EMBED_PRICE_PER_M[model] ?? 0.02;
  return (tokensIn * p) / 1_000_000;
}

/**
 * OpenAI offers native JSON mode (`response_format: { type: "json_object" }`)
 * which is materially more reliable than instruction-only JSON output.
 * Use it whenever a schema is supplied; the system prompt still describes
 * the expected shape so the model knows what to emit.
 */
function withSchemaInstruction(system: string, hasSchema: boolean): string {
  if (!hasSchema) return system;
  return `${system}\n\nRespond ONLY with a single JSON object matching the requested schema.`;
}

function parseStructuredOutput<T>(
  text: string,
  schema: TextCallOptions<T>["schema"]
): T | undefined {
  if (!schema) return undefined;
  // Two-stage parse via the shared helper — see
  // `_helpers/parse-json.ts` for rationale. OpenAI rarely emits
  // malformed JSON (the SDK uses `response_format` + JSON-mode), but
  // we apply the same repair fallback for consistency with the
  // Anthropic adapter and as defense in depth — a future model
  // change or prompt edit shouldn't re-introduce parse fragility.
  const json = parseJsonWithRepair(text, "openai");
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error("openai_schema_validation_failed", {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

// ─────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────

export function createOpenAIAdapter(): Adapter {
  const apiKey = providerEnv.openaiApiKey();

  if (!apiKey) {
    return {
      id: PROVIDER_ID,
      text: createStubTextProvider(),
      vision: createStubVisionProvider(),
      embedding: createStubEmbeddingProvider(),
    };
  }

  const client = new OpenAI({ apiKey });

  const embedding: EmbeddingProvider = {
    id: PROVIDER_ID,
    dimensions: EMBED_DIMENSIONS,

    async healthCheck(): Promise<ProviderHealth> {
      const startedAt = performance.now();
      try {
        const res = await client.embeddings.create({
          model: DEFAULT_EMBED_MODEL,
          input: "ping",
        });
        const latencyMs = Math.round(performance.now() - startedAt);
        const tokensIn = res.usage?.total_tokens ?? 0;
        return {
          ok: true,
          providerId: PROVIDER_ID,
          capability: "embedding",
          model: DEFAULT_EMBED_MODEL,
          latencyMs,
          costUsd: computeEmbedCost(DEFAULT_EMBED_MODEL, tokensIn),
          detail: { dimensions: res.data[0]?.embedding.length ?? 0 },
        };
      } catch (err) {
        return {
          ok: false,
          providerId: PROVIDER_ID,
          capability: "embedding",
          model: DEFAULT_EMBED_MODEL,
          latencyMs: Math.round(performance.now() - startedAt),
          errorMessage: errorMessage(err),
        };
      }
    },

    async embed(opts: EmbeddingCallOptions): Promise<number[]> {
      const model = opts.model ?? DEFAULT_EMBED_MODEL;
      const res = await client.embeddings.create({ model, input: opts.input });
      const vec = res.data[0]?.embedding;
      if (!vec) {
        throw new Error("openai_embedding_empty_response");
      }
      return vec;
    },
  };

  const text: TextProvider = {
    id: PROVIDER_ID,

    async healthCheck(): Promise<ProviderHealth> {
      // Reuse the embedding health probe — it's the cheapest sane call
      // (~$0.00000002) and proves the API key works. Don't burn tokens
      // on a chat completion for the same signal.
      const result = await embedding.healthCheck();
      return { ...result, capability: "text" };
    },

    async generate<T = string>(
      opts: TextCallOptions<T>
    ): Promise<TextResult<T>> {
      const model = opts.model ?? DEFAULT_TEXT_MODEL;
      const startedAt = performance.now();
      const res = await client.chat.completions.create({
        model,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature,
        messages: [
          { role: "system", content: withSchemaInstruction(opts.system, !!opts.schema) },
          { role: "user", content: opts.prompt },
        ],
        response_format: opts.schema ? { type: "json_object" } : undefined,
      });
      const latencyMs = Math.round(performance.now() - startedAt);
      const out = res.choices[0]?.message.content ?? "";
      const inTok = res.usage?.prompt_tokens ?? 0;
      const outTok = res.usage?.completion_tokens ?? 0;
      return {
        text: out,
        parsed: opts.schema
          ? parseStructuredOutput<T>(out, opts.schema)
          : (out as unknown as T),
        usage: { tokensIn: inTok, tokensOut: outTok },
        costUsd: computeTextCost(model, inTok, outTok),
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
      const result = await embedding.healthCheck();
      return { ...result, capability: "vision" };
    },

    async analyze<T = string>(
      opts: VisionCallOptions<T>
    ): Promise<VisionResult<T>> {
      const model = opts.model ?? DEFAULT_VISION_MODEL;
      const startedAt = performance.now();
      const res = await client.chat.completions.create({
        model,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature,
        messages: [
          {
            role: "system",
            content: withSchemaInstruction(
              "You are a vision analysis assistant.",
              !!opts.schema
            ),
          },
          {
            role: "user",
            content: [
              { type: "text", text: opts.instructions },
              ...opts.images.map(
                (r): OpenAI.Chat.Completions.ChatCompletionContentPartImage => ({
                  type: "image_url",
                  image_url: { url: r.src },
                })
              ),
            ],
          },
        ],
        response_format: opts.schema ? { type: "json_object" } : undefined,
      });
      const latencyMs = Math.round(performance.now() - startedAt);
      const out = res.choices[0]?.message.content ?? "";
      const inTok = res.usage?.prompt_tokens ?? 0;
      const outTok = res.usage?.completion_tokens ?? 0;
      return {
        text: out,
        parsed: opts.schema
          ? parseStructuredOutput<T>(out, opts.schema)
          : (out as unknown as T),
        usage: { tokensIn: inTok, tokensOut: outTok },
        costUsd: computeTextCost(model, inTok, outTok),
        latencyMs,
        model,
        providerId: PROVIDER_ID,
        requestId: res.id,
      };
    },
  };

  return { id: PROVIDER_ID, text, vision, embedding };
}

// ─────────────────────────────────────────────────────────────────────────
// Stubs — used when OPENAI_API_KEY is unset
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
        errorMessage: "missing_api_key:OPENAI_API_KEY",
      };
    },
    async generate() {
      throw new Error("openai_text_unavailable: OPENAI_API_KEY is not set");
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
        errorMessage: "missing_api_key:OPENAI_API_KEY",
      };
    },
    async analyze() {
      throw new Error("openai_vision_unavailable: OPENAI_API_KEY is not set");
    },
  };
}

function createStubEmbeddingProvider(): EmbeddingProvider {
  return {
    id: PROVIDER_ID,
    dimensions: EMBED_DIMENSIONS,
    async healthCheck() {
      return {
        ok: false,
        providerId: PROVIDER_ID,
        capability: "embedding",
        latencyMs: 0,
        errorMessage: "missing_api_key:OPENAI_API_KEY",
      };
    },
    async embed() {
      throw new Error("openai_embedding_unavailable: OPENAI_API_KEY is not set");
    },
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
