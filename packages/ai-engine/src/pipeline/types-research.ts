import type { ProviderId } from "../providers/types";

/**
 * Stage 02 (Research) input + output types.
 *
 * The stage wraps a ScraperProvider call with structural handling of
 * the PLATFORM.md §11 stage 02 failure mode: "If both fail, mark
 * skipped; downstream uses only vision."
 *
 * The output is image-URL-pass-through (no R2 upload here — that's the
 * M6 worker stage). Strategy downstream consumes the markdown directly.
 */
export interface ResearchInput {
  /** Supplier URL the operator pasted at intake. */
  supplierUrl: string;
  /** Whether to skip the scrape entirely (operator opt-out at intake). */
  skip?: boolean;
}

export interface ResearchOutput {
  supplierUrl: string;
  /** ISO timestamp. When `skipped`, this is the time the skip decision was made. */
  scrapedAt: string;
  /** True when the scrape was skipped (operator-opt-out or scraper failure). */
  skipped: boolean;
  skipReason?: string;
  title?: string;
  description?: string;
  markdown?: string;
  language?: string;
  images?: Array<{
    src: string;
    alt?: string;
    width?: number;
    height?: number;
  }>;
  links?: string[];
  costUsd: number;
  providerId?: ProviderId;
  durationMs: number;
}
