import type { ImageRef } from "../providers/types";

/**
 * Stage 03 (Vision) input + output types.
 *
 * The vision stage consumes operator-uploaded images (typically 1–5)
 * and emits a structured visual summary. PLATFORM.md §11 stage 03
 * failure mode: "retry-once-higher-temp; skip on second fail" — handled
 * structurally via the helper retry + a final `skipped: true` exit.
 */
export interface VisionInput {
  /** Image references — R2 keys or absolute URLs. 1–10 supported. */
  images: ImageRef[];
}

export interface VisionOutput {
  /** True when the vision call was skipped or both retries failed. */
  skipped: boolean;
  skipReason?: string;
  productCategory?: string;
  formFactor?: string;
  /** CSS hex strings, dominant first. */
  visibleColors?: string[];
  packagingMaterial?: string;
  /** Any text visible on the packaging, concatenated. */
  visibleText?: string;
  /** ISO codes for languages detected on the label. */
  labelLanguages?: string[];
  approximateSize?: string;
  /** Short noun phrases the copy stage can reuse. */
  visualHooks?: string[];
  /** 0..1. Drives whether downstream stages trust visual hints. */
  confidence?: number;
  notes?: string;
  costUsd: number;
}
