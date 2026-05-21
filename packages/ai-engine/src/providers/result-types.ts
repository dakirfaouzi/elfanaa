import type { ProviderId } from "./types";

/**
 * Provider result types — the shapes returned by each capability's
 * primary method. Each result carries enough metadata for cost
 * attribution + observability without dragging in vendor SDK types.
 *
 * Generics:
 *
 *   • `TextResult<T>`  — when caller passes a `schema`, `parsed: T`
 *                         is populated from the validated JSON output.
 *                         When no schema is passed, `T = string` and
 *                         `parsed` is the raw text again.
 *   • `VisionResult<T>` — same generic shape as TextResult.
 *
 * Concrete types (`ImageResult`, `ScrapeResult`) are non-generic.
 */

// ── Text + Vision ──────────────────────────────────────────────────────────

/**
 * Output of `TextProvider.generate()`. Always carries the raw text plus
 * a structured `parsed` value (typed `T`) when the caller supplied a
 * Zod schema. `usage` and `costUsd` are populated by the adapter's
 * price table — providers that don't return usage info estimate from
 * input/output byte counts.
 */
export type TextResult<T = string> = {
  /** The raw text response, untouched. */
  text: string;
  /** Schema-parsed structured output. `undefined` when no schema given
   *  OR when schema validation failed (in which case the adapter throws
   *  with `cause` — see contracts.ts). */
  parsed?: T;
  usage: TokenUsage;
  costUsd: number;
  latencyMs: number;
  /** Vendor model identifier ("claude-3-5-sonnet-latest"). */
  model: string;
  /** Which adapter served this call — useful when callers iterate a chain. */
  providerId: ProviderId;
  /** Optional vendor request ID for debugging. */
  requestId?: string;
};

export type VisionResult<T = string> = TextResult<T>;

export type TokenUsage = {
  tokensIn: number;
  tokensOut: number;
};

// ── Image ──────────────────────────────────────────────────────────────────

/**
 * Output of `ImageProvider.generate()`. In M4 the `r2Key` field is always
 * undefined — the M5 storage layer is what writes the image to R2 and
 * fills this in. The `url` field carries the vendor's direct URL so
 * dev/test flows can preview without R2 wiring.
 */
export type ImageResult = {
  /** R2 key — populated by the M5 storage layer; undefined in M4. */
  r2Key?: string;
  /** Direct vendor URL to the generated image. Expires per vendor policy. */
  url: string;
  width: number;
  height: number;
  /** Image bytes when the adapter chose to download synchronously. */
  bytes?: number;
  /** Seed used (for reproducibility); only some providers report it. */
  seed?: number;
  costUsd: number;
  latencyMs: number;
  model: string;
  providerId: ProviderId;
};

// ── Scraper ────────────────────────────────────────────────────────────────

/**
 * Output of `ScraperProvider.fetch()`. Most pipeline consumers want
 * `markdown` (clean text for LLM input) + `images` (URLs to download to
 * R2). `html` is available for adapters that need DOM-level parsing.
 *
 * All content fields are optional because different scrape modes emit
 * different shapes (Firecrawl's `formats` opt-in selects which).
 */
export type ScrapeResult = {
  url: string;
  /** Page title (`<title>` or open-graph). */
  title?: string;
  description?: string;
  /** Cleaned markdown — best for LLM consumption. */
  markdown?: string;
  /** Raw HTML — only emit when scrape opts requested `"html"`. */
  html?: string;
  /** Visible text — fallback when markdown extraction is too lossy. */
  text?: string;
  /** Image references found on the page. */
  images?: ImageOnPage[];
  /** Outbound links — useful for sibling/variant discovery. */
  links?: string[];
  /** Page language hint (`<html lang="...">`). */
  language?: string;
  fetchedAt: string;
  durationMs: number;
  providerId: ProviderId;
  costUsd: number;
};

export type ImageOnPage = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
};

/**
 * Options passed to `ScraperProvider.fetch()`. Knobs map to Firecrawl
 * conventions because it's the primary scraper; other adapters subset
 * as needed.
 */
export type ScrapeOptions = {
  /**
   * Milliseconds to wait after page load before extracting. Default 2000.
   * Increase for JS-heavy product pages that render reviews asynchronously.
   */
  waitFor?: number;
  /**
   * Which content formats to extract. Most pipeline stages need only
   * "markdown" + "links". "html" is expensive (full DOM serialisation).
   */
  formats?: Array<"markdown" | "html" | "links" | "screenshot" | "text">;
  /**
   * Whether to follow client-side redirects. Default true. Disable for
   * suppliers with aggressive redirect loops.
   */
  followRedirects?: boolean;
};
