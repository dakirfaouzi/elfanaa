import type { ImageProvider } from "../providers/contracts";
import { ImageGenOutputSchema } from "../schemas/image-gen";
import type { StageContext } from "./types";
import type {
  AspectRatio,
  CreativePrompt,
} from "./types-creative-prompts";
import type {
  ImageGenFailure,
  ImageGenInput,
  ImageGenOutput,
  ImageGenResult,
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

  const heroJob = runOnePrompt({
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

async function runOnePrompt(opts: {
  role: "hero" | "lifestyle";
  creative: CreativePrompt;
  provider: ImageProvider;
  maxAttempts: number;
  storeId: string;
  runId: string;
}): Promise<RunOutcome> {
  const { w, h } = aspectToPx(opts.creative.aspectRatio);
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const res = await opts.provider.generate({
        prompt: opts.creative.prompt,
        negative: opts.creative.negative,
        size: { w, h },
        storeId: opts.storeId,
        runId: opts.runId,
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
