import type { ProviderId } from "../providers/types";
import type { CreativePromptsOutput } from "./types-creative-prompts";

/**
 * Stage 08 (Image generation) input + output types.
 *
 * Runs every prompt from stage 07 through the image provider in parallel.
 * PLATFORM.md §11 stage 08 failure mode: "Per-prompt 3× retry + provider
 * fallback; partial success accepted" — implemented at the stage level.
 *
 * The stage NEVER throws on partial failure — it returns whatever it
 * could produce in `results` and the rest in `failed`. Assembly downstream
 * is responsible for handling a missing hero by falling back to one of
 * the operator's uploaded supplier images.
 */
export interface ImageGenInput {
  prompts: CreativePromptsOutput;
  /** Per-prompt max retries before giving up. PLATFORM.md says 3. */
  maxAttemptsPerPrompt?: number;
  /**
   * Step 3 (ADR-S3-3) — the operator's primary product photo, resolved to a
   * PUBLIC, fetchable URL. When present, the hero is generated image-to-image
   * (fal Kontext) conditioned on this reference so the rendered hero preserves
   * the exact product identity. Absent / non-http → text-to-image hero
   * (legacy behaviour). The orchestrator only sets this when it can resolve a
   * servable URL (never the private S3 endpoint).
   */
  referenceImage?: { src: string; alt?: string };
  /** Override the img2img model. Defaults to `fal-ai/flux-pro/kontext`. */
  img2imgModel?: string;
  /**
   * Phase 4.6.4d — vision QA gate config. QA only runs when a `vision` provider
   * is supplied to the stage; absent provider → QA skipped (legacy behaviour).
   */
  qa?: ImageQaConfig;
}

export interface ImageQaConfig {
  /** Master switch (default true when a vision provider is present). */
  enabled?: boolean;
  /**
   * Max corrective REGENERATIONS per image after the first attempt (default 1).
   * Each regen is +1 image call +1 vision call, so this bounds added cost.
   */
  maxRegens?: number;
}

/** Default identity-preserving image-to-image model (fal Kontext [pro]). */
export const DEFAULT_IMG2IMG_MODEL = "fal-ai/flux-pro/kontext";

export interface ImageGenResult {
  role: "hero" | "lifestyle";
  intent?: string;
  prompt: string;
  url: string;
  width: number;
  height: number;
  costUsd: number;
  model: string;
  providerId: ProviderId;
  seed?: number;
  /** Number of attempts (1..maxAttempts) it took to produce this result. */
  attempts: number;
}

export interface ImageGenFailure {
  role: "hero" | "lifestyle";
  intent?: string;
  prompt: string;
  errorMessage: string;
  attempts: number;
}

export interface ImageGenOutput {
  results: ImageGenResult[];
  failed: ImageGenFailure[];
  totalCostUsd: number;
}
