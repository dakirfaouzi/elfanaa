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
}

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
