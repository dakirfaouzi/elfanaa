import { fal } from "@fal-ai/client";
import type {
  Adapter,
  ProviderHealth,
  ProviderId,
} from "../types";
import type { ImageCallOptions, ImageProvider } from "../contracts";
import type { ImageResult } from "../result-types";
import { providerEnv } from "../env";

/**
 * fal.ai adapter — image generation (PLATFORM.md §12 stage 08).
 *
 * # Models
 *
 *   • Flux Pro 1.1  — primary photographic / product / lifestyle imagery.
 *                     High fidelity, low artifact rate on hands and text.
 *   • Recraft v3    — secondary, used specifically for in-image Arabic
 *                     text (logos, packaging mockups, badge overlays).
 *                     Flux's Arabic rendering still misshapes letterforms.
 *
 * The default is Flux Pro 1.1. Callers pass `opts.model` to swap.
 *
 * # Health-check ping
 *
 * fal.ai doesn't expose a free `/health` endpoint. We validate the API
 * key via the SDK's `fal.config()` call + a minimal authenticated probe
 * (queue status of a known-nonexistent request id, which returns a fast
 * 404 without burning compute credits). This proves the key works
 * without generating an image (≥$0.04 per real image).
 */

const PROVIDER_ID: ProviderId = "fal";

const DEFAULT_IMAGE_MODEL = "fal-ai/flux-pro/v1.1";
const RECRAFT_MODEL = "fal-ai/recraft-v3";

// USD per image at default size (1024×1024). Validate against
// https://fal.ai/models/<model>/api when bumping models.
const PRICE_PER_IMAGE: Record<string, number> = {
  "fal-ai/flux-pro/v1.1": 0.04,
  "fal-ai/recraft-v3": 0.06,
};

function priceFor(model: string): number {
  return PRICE_PER_IMAGE[model] ?? 0.04;
}

/**
 * Loose type for the SDK image-result payload. fal's response shape varies
 * across models — every image model returns an `images` array of objects
 * with at least `{ url, width, height }`. Other fields (seed, content_type)
 * are model-specific and surfaced opportunistically via `detail`.
 */
type FalImagePayload = {
  images: Array<{ url: string; width: number; height: number; content_type?: string }>;
  seed?: number;
  timings?: { inference: number };
};

// ─────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────

export function createFalAdapter(): Adapter {
  const apiKey = providerEnv.falKey();

  if (!apiKey) {
    return { id: PROVIDER_ID, image: createStubImageProvider() };
  }

  // SDK config is module-global — set once at adapter construction.
  fal.config({ credentials: apiKey });

  const image: ImageProvider = {
    id: PROVIDER_ID,
    // Quote the most expensive routine model so the M6 budget-gate is
    // conservative when planning a parallel batch. Specific calls
    // recompute precisely from `priceFor(model)`.
    cost: { perImageUsd: priceFor(DEFAULT_IMAGE_MODEL) },

    async healthCheck(): Promise<ProviderHealth> {
      const startedAt = performance.now();
      try {
        // Bogus request-id forces fal to return a fast 404 — authenticates
        // the key without queuing a real job. Any 401/403 surfaces as a
        // thrown error (caught below); a 404 means the key works.
        await fal.queue.status(DEFAULT_IMAGE_MODEL, {
          requestId: "healthcheck-nonexistent",
        });
        // 200 here would be surprising (request ID doesn't exist); treat
        // as success regardless since we got an authorised response.
        return successHealth(startedAt);
      } catch (err) {
        // 404 ("Request not found") is the expected happy path — the key
        // works, the request just doesn't exist. Distinguish from real
        // auth failures by checking for 401/403 in the error string.
        if (isNotFoundError(err)) {
          return successHealth(startedAt);
        }
        return {
          ok: false,
          providerId: PROVIDER_ID,
          capability: "image",
          latencyMs: Math.round(performance.now() - startedAt),
          errorMessage: describeFalError(err),
        };
      }
    },

    async generate(opts: ImageCallOptions): Promise<ImageResult> {
      const model = opts.model ?? DEFAULT_IMAGE_MODEL;
      const startedAt = performance.now();
      let result: Awaited<ReturnType<typeof fal.subscribe>>;
      try {
        result = await fal.subscribe(model, {
          input: {
            prompt: opts.prompt,
            negative_prompt: opts.negative,
            image_size: { width: opts.size.w, height: opts.size.h },
            seed: opts.seed,
            // Image references for img2img / character consistency. fal
            // accepts URL arrays under `image_url(s)` depending on model;
            // we pass the first one as `image_url` which Flux + Recraft
            // both accept.
            ...(opts.referenceImages?.[0]
              ? { image_url: opts.referenceImages[0].src }
              : {}),
          },
        });
      } catch (err) {
        // fal throws a structured `ApiError` whose human-readable cause
        // (auth vs exhausted balance vs model validation) lives in
        // `status` + `body`, NOT `message`. Surface all of it so the
        // captured `failed[].errorMessage` is actionable instead of a
        // generic "Forbidden" / "Unprocessable Entity".
        throw new Error(`fal_generate_failed[${model}]: ${describeFalError(err)}`);
      }
      const latencyMs = Math.round(performance.now() - startedAt);
      const payload = result.data as FalImagePayload;
      const first = payload.images?.[0];
      if (!first) {
        throw new Error("fal_image_empty_response");
      }
      return {
        url: first.url,
        width: first.width,
        height: first.height,
        seed: payload.seed,
        costUsd: priceFor(model),
        latencyMs,
        model,
        providerId: PROVIDER_ID,
      };
    },
  };

  return { id: PROVIDER_ID, image };

  function successHealth(startedAt: number): ProviderHealth {
    return {
      ok: true,
      providerId: PROVIDER_ID,
      capability: "image",
      model: DEFAULT_IMAGE_MODEL,
      latencyMs: Math.round(performance.now() - startedAt),
      costUsd: 0,
      detail: {
        availableModels: [DEFAULT_IMAGE_MODEL, RECRAFT_MODEL],
        note: "Auth verified via queue-status probe; no image generated.",
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function isNotFoundError(err: unknown): boolean {
  if (typeof err === "object" && err !== null) {
    // fal-client throws structured errors with `status` in some versions;
    // fall back to a string-match heuristic for older versions.
    const e = err as { status?: number; message?: string };
    if (e.status === 404) return true;
    if (e.message && /not\s*found|404/i.test(e.message)) return true;
  }
  return false;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Extract every diagnostic field from a fal error. The fal client
 * (`@fal-ai/client`) throws `ApiError`-like objects carrying:
 *   • `status`  — HTTP code (401/403 = auth, 402 = billing, 422 = model
 *                 validation, 5xx = fal outage).
 *   • `body`    — JSON detail; e.g. `{ detail: "Exhausted balance..." }`
 *                 for insufficient credits, or validation specifics.
 *   • `message` — usually a generic reason phrase.
 * We concatenate them (body truncated) so the persisted failure reason
 * tells the operator exactly which knob to turn.
 */
function describeFalError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { status?: number; message?: string; body?: unknown };
    const parts: string[] = [];
    if (typeof e.status === "number") parts.push(`status=${e.status}`);
    if (e.message) parts.push(`message=${e.message}`);
    if (e.body !== undefined && e.body !== null) {
      let bodyStr: string;
      try {
        bodyStr = typeof e.body === "string" ? e.body : JSON.stringify(e.body);
      } catch {
        bodyStr = String(e.body);
      }
      parts.push(`body=${bodyStr.slice(0, 600)}`);
    }
    if (parts.length > 0) return parts.join(" ");
  }
  return errorMessage(err);
}

// ─────────────────────────────────────────────────────────────────────────
// Stubs
// ─────────────────────────────────────────────────────────────────────────

function createStubImageProvider(): ImageProvider {
  return {
    id: PROVIDER_ID,
    cost: { perImageUsd: priceFor(DEFAULT_IMAGE_MODEL) },
    async healthCheck() {
      return {
        ok: false,
        providerId: PROVIDER_ID,
        capability: "image",
        latencyMs: 0,
        errorMessage: "missing_api_key:FAL_KEY",
      };
    },
    async generate() {
      throw new Error("fal_image_unavailable: FAL_KEY is not set");
    },
  };
}
