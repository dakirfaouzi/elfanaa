import type { ImageProvider } from "../providers/contracts";
import { ImageGenOutputSchema } from "../schemas/image-gen";
import type { StageContext } from "./types";
import type {
  AspectRatio,
  CreativePrompt,
} from "./types-creative-prompts";
import {
  DEFAULT_IMG2IMG_MODEL,
  type ImageGenFailure,
  type ImageGenInput,
  type ImageGenOutput,
  type ImageGenResult,
} from "./types-image-gen";

/**
 * Stage 08 — Image generation (PLATFORM.md §11).
 *
 * Failure mode: "Per-prompt 3× retry + provider fallback; partial
 * success accepted." Provider fallback itself lives in the M4
 * registry / M6 worker — this stage retries the same provider 3×
 * and tolerates per-prompt failure.
 *
 * Parallelism: prompts are run in parallel via `Promise.all`. With a
 * typical 1 hero + 2–4 lifestyle prompts the wall-time is roughly equal
 * to the slowest single image (20–60s per PLATFORM.md latency table).
 */
export async function imageGen(
  opts: {
    input: ImageGenInput;
    providers: { image: ImageProvider };
  } & StageContext,
): Promise<ImageGenOutput> {
  const maxAttempts = opts.input.maxAttemptsPerPrompt ?? 3;

  // Step 3 (ADR-S3-3): when a servable reference photo is supplied, generate
  // the hero image-to-image (Kontext) so it preserves the real product's
  // identity, with a hard fallback to text-to-image so a Kontext failure can
  // never regress hero quality below today's working baseline.
  const referenceUrl = resolveServableReference(opts.input.referenceImage?.src);
  const heroJob = referenceUrl
    ? runHeroWithIdentity({
        creative: opts.input.prompts.hero,
        referenceUrl,
        img2imgModel: opts.input.img2imgModel ?? DEFAULT_IMG2IMG_MODEL,
        provider: opts.providers.image,
        maxAttempts,
        storeId: opts.storeConfig.id,
        runId: opts.runId,
      })
    : runOnePrompt({
        role: "hero",
        creative: opts.input.prompts.hero,
        provider: opts.providers.image,
        maxAttempts,
        storeId: opts.storeConfig.id,
        runId: opts.runId,
      });

  const lifestyleJobs = opts.input.prompts.lifestyle.map((cp) =>
    runOnePrompt({
      role: "lifestyle",
      creative: cp,
      provider: opts.providers.image,
      maxAttempts,
      storeId: opts.storeConfig.id,
      runId: opts.runId,
    }),
  );

  const outcomes = await Promise.all([heroJob, ...lifestyleJobs]);

  const results: ImageGenResult[] = [];
  const failed: ImageGenFailure[] = [];
  let totalCostUsd = 0;
  for (const outcome of outcomes) {
    if (outcome.ok) {
      results.push(outcome.result);
      totalCostUsd += outcome.result.costUsd;
    } else {
      failed.push(outcome.failure);
    }
  }

  const output: ImageGenOutput = {
    results,
    failed,
    totalCostUsd,
  };
  return ImageGenOutputSchema.parse(output);
}

type RunOutcome =
  | { ok: true; result: ImageGenResult }
  | { ok: false; failure: ImageGenFailure };

/**
 * Generate the hero image-to-image first (identity-preserving), falling back
 * to the standard text-to-image hero if the img2img path fails. The fallback
 * guarantees we never end up worse than the legacy behaviour.
 */
async function runHeroWithIdentity(opts: {
  creative: CreativePrompt;
  referenceUrl: string;
  img2imgModel: string;
  provider: ImageProvider;
  maxAttempts: number;
  storeId: string;
  runId: string;
}): Promise<RunOutcome> {
  const img2img = await runOnePrompt({
    role: "hero",
    creative: { ...opts.creative, prompt: buildIdentityPrompt(opts.creative.prompt) },
    provider: opts.provider,
    maxAttempts: opts.maxAttempts,
    storeId: opts.storeId,
    runId: opts.runId,
    model: opts.img2imgModel,
    referenceImages: [{ src: opts.referenceUrl }],
  });
  if (img2img.ok) return img2img;

  // Hard fallback: text-to-image hero with the original prompt (no reference,
  // default model). This is exactly today's working path.
  return runOnePrompt({
    role: "hero",
    creative: opts.creative,
    provider: opts.provider,
    maxAttempts: opts.maxAttempts,
    storeId: opts.storeId,
    runId: opts.runId,
  });
}

/**
 * Wrap a text-to-image hero prompt as an identity-preserving EDIT instruction
 * for Kontext: keep the actual product pixels, only restyle the scene.
 */
function buildIdentityPrompt(heroPrompt: string): string {
  return (
    "Using the provided product photo as the exact reference, keep the " +
    "product's shape, packaging, label text, logo and colours identical. " +
    "Re-render it as a premium studio hero shot: " +
    heroPrompt +
    " Do not alter, redesign, or relabel the product itself."
  );
}

/**
 * Only http(s) URLs are usable as fal references (fal must fetch the bytes).
 * Bare R2 keys / empty values return undefined → caller uses text-to-image.
 */
function resolveServableReference(src?: string): string | undefined {
  if (!src) return undefined;
  return /^https?:\/\//i.test(src.trim()) ? src.trim() : undefined;
}

async function runOnePrompt(opts: {
  role: "hero" | "lifestyle";
  creative: CreativePrompt;
  provider: ImageProvider;
  maxAttempts: number;
  storeId: string;
  runId: string;
  /** Optional model override (e.g. Kontext for img2img). */
  model?: string;
  /** Optional reference images for img2img / identity conditioning. */
  referenceImages?: { src: string; alt?: string }[];
}): Promise<RunOutcome> {
  const { w, h } = aspectToPx(opts.creative.aspectRatio);
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const res = await opts.provider.generate({
        prompt: opts.creative.prompt,
        negative: opts.creative.negative,
        size: { w, h },
        aspectRatio: opts.creative.aspectRatio,
        storeId: opts.storeId,
        runId: opts.runId,
        ...(opts.model ? { model: opts.model } : {}),
        ...(opts.referenceImages ? { referenceImages: opts.referenceImages } : {}),
      });
      return {
        ok: true,
        result: {
          role: opts.role,
          intent: opts.creative.intent,
          prompt: opts.creative.prompt,
          url: res.url,
          width: res.width,
          height: res.height,
          costUsd: res.costUsd,
          model: res.model,
          providerId: res.providerId,
          seed: res.seed,
          attempts: attempt,
        },
      };
    } catch (err) {
      lastError = err;
    }
  }

  return {
    ok: false,
    failure: {
      role: opts.role,
      intent: opts.creative.intent,
      prompt: opts.creative.prompt,
      errorMessage:
        lastError instanceof Error ? lastError.message : "unknown_error",
      attempts: opts.maxAttempts,
    },
  };
}

/**
 * Translate an aspect ratio label into concrete pixel dimensions for the
 * underlying image provider. Sizes are picked to match the M4 fal.ai
 * adapter's accepted resolutions (Flux Pro 1.1 supports 1024² and rectangular
 * variants).
 */
function aspectToPx(ratio: AspectRatio): { w: number; h: number } {
  switch (ratio) {
    case "1:1":
      return { w: 1024, h: 1024 };
    case "4:5":
      return { w: 1024, h: 1280 };
    case "9:16":
      return { w: 768, h: 1344 };
    case "16:9":
      return { w: 1344, h: 768 };
    case "3:4":
      return { w: 1024, h: 1365 };
    case "2:3":
      return { w: 1024, h: 1536 };
  }
}
