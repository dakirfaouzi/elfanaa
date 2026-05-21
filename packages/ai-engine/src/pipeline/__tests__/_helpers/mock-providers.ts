import type {
  EmbeddingProvider,
  ImageProvider,
  ScraperProvider,
  TextProvider,
  VisionProvider,
} from "../../../providers/contracts";
import type {
  EmbeddingCallOptions,
  ImageCallOptions,
  TextCallOptions,
  VisionCallOptions,
} from "../../../providers/contracts";
import type {
  ImageResult,
  ScrapeOptions,
  ScrapeResult,
  TextResult,
  VisionResult,
} from "../../../providers/result-types";
import type {
  ProviderCapability,
  ProviderHealth,
  ProviderId,
} from "../../../providers/types";

/**
 * Test-only mock provider factories.
 *
 * These build minimal `TextProvider` / `VisionProvider` / `ImageProvider` /
 * `ScraperProvider` / `EmbeddingProvider` instances backed by inline
 * stubs. Each factory accepts a queue of canned responses (and/or a
 * mutator function); calls dequeue in FIFO order, and a `calls` array
 * records every invocation for assertion-time inspection.
 *
 * # Why not Vitest's `vi.fn()`?
 *
 *   • The provider contracts use generics that `vi.fn()` doesn't track
 *     well — typed responses + structural call recording in one helper
 *     reads cleaner in tests.
 *   • Keeps tests free of `as any` and `mockImplementation` ceremony.
 *
 * # Cost / latency
 *
 * Mocks return a default `costUsd: 0` and `latencyMs: 0` so tests don't
 * inadvertently assert on noisy real values.
 */

/** Returned by every factory — exposes `calls` for assertions. */
export interface MockProvider<TProvider, TCallOptions, TResult> {
  provider: TProvider;
  calls: TCallOptions[];
  /** Index of the next response to return. Reset between tests if needed. */
  cursor: { index: number };
  /** Append responses at runtime when a test wants different mid-flight behaviour. */
  enqueue(response: TResult | Error): void;
  /** Replace the entire response queue. */
  setResponses(responses: Array<TResult | Error>): void;
}

// ─────────────────────────────────────────────────────────────────────────
// Text
// ─────────────────────────────────────────────────────────────────────────

export function mockText(opts?: {
  id?: ProviderId;
  responses?: Array<TextResult<unknown> | Error>;
}): MockProvider<TextProvider, TextCallOptions<unknown>, TextResult<unknown>> {
  const calls: TextCallOptions<unknown>[] = [];
  const cursor = { index: 0 };
  const responses: Array<TextResult<unknown> | Error> = [...(opts?.responses ?? [])];

  const provider: TextProvider = {
    id: opts?.id ?? "anthropic",
    async healthCheck(): Promise<ProviderHealth> {
      return health(provider.id, "text");
    },
    async generate<T>(callOpts: TextCallOptions<T>): Promise<TextResult<T>> {
      calls.push(callOpts as TextCallOptions<unknown>);
      const next = responses[cursor.index++];
      if (next === undefined) {
        throw new Error(
          `mockText: no response queued (cursor=${cursor.index - 1}, total=${responses.length})`,
        );
      }
      if (next instanceof Error) throw next;
      return next as unknown as TextResult<T>;
    },
  };

  return {
    provider,
    calls,
    cursor,
    enqueue: (r) => responses.push(r),
    setResponses: (r) => {
      responses.length = 0;
      responses.push(...r);
      cursor.index = 0;
    },
  };
}

/**
 * Helper: build a valid `TextResult<T>` from a `parsed` value. Use this
 * inside test response queues to avoid repetitive boilerplate.
 */
export function textResult<T>(parsed: T, overrides?: Partial<TextResult<T>>): TextResult<T> {
  return {
    text: typeof parsed === "string" ? parsed : JSON.stringify(parsed),
    parsed,
    usage: { tokensIn: 100, tokensOut: 200 },
    costUsd: 0,
    latencyMs: 0,
    model: "mock-model",
    providerId: "anthropic",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Vision
// ─────────────────────────────────────────────────────────────────────────

export function mockVision(opts?: {
  id?: ProviderId;
  responses?: Array<VisionResult<unknown> | Error>;
}): MockProvider<
  VisionProvider,
  VisionCallOptions<unknown>,
  VisionResult<unknown>
> {
  const calls: VisionCallOptions<unknown>[] = [];
  const cursor = { index: 0 };
  const responses: Array<VisionResult<unknown> | Error> = [
    ...(opts?.responses ?? []),
  ];

  const provider: VisionProvider = {
    id: opts?.id ?? "anthropic",
    async healthCheck(): Promise<ProviderHealth> {
      return health(provider.id, "vision");
    },
    async analyze<T>(callOpts: VisionCallOptions<T>): Promise<VisionResult<T>> {
      calls.push(callOpts as VisionCallOptions<unknown>);
      const next = responses[cursor.index++];
      if (next === undefined) {
        throw new Error(
          `mockVision: no response queued (cursor=${cursor.index - 1}, total=${responses.length})`,
        );
      }
      if (next instanceof Error) throw next;
      return next as unknown as VisionResult<T>;
    },
  };

  return {
    provider,
    calls,
    cursor,
    enqueue: (r) => responses.push(r),
    setResponses: (r) => {
      responses.length = 0;
      responses.push(...r);
      cursor.index = 0;
    },
  };
}

export function visionResult<T>(
  parsed: T,
  overrides?: Partial<VisionResult<T>>,
): VisionResult<T> {
  return {
    text: typeof parsed === "string" ? parsed : JSON.stringify(parsed),
    parsed,
    usage: { tokensIn: 100, tokensOut: 200 },
    costUsd: 0,
    latencyMs: 0,
    model: "mock-vision",
    providerId: "anthropic",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Image
// ─────────────────────────────────────────────────────────────────────────

export function mockImage(opts?: {
  id?: ProviderId;
  responses?: Array<ImageResult | Error>;
  perImageUsd?: number;
}): MockProvider<ImageProvider, ImageCallOptions, ImageResult> {
  const calls: ImageCallOptions[] = [];
  const cursor = { index: 0 };
  const responses: Array<ImageResult | Error> = [...(opts?.responses ?? [])];

  const provider: ImageProvider = {
    id: opts?.id ?? "fal",
    cost: { perImageUsd: opts?.perImageUsd ?? 0.04 },
    async healthCheck(): Promise<ProviderHealth> {
      return health(provider.id, "image");
    },
    async generate(callOpts: ImageCallOptions): Promise<ImageResult> {
      calls.push(callOpts);
      const next = responses[cursor.index++];
      if (next === undefined) {
        throw new Error(
          `mockImage: no response queued (cursor=${cursor.index - 1}, total=${responses.length})`,
        );
      }
      if (next instanceof Error) throw next;
      return next;
    },
  };

  return {
    provider,
    calls,
    cursor,
    enqueue: (r) => responses.push(r),
    setResponses: (r) => {
      responses.length = 0;
      responses.push(...r);
      cursor.index = 0;
    },
  };
}

export function imageResult(overrides?: Partial<ImageResult>): ImageResult {
  return {
    url: "https://cdn.mock/img.webp",
    width: 1024,
    height: 1024,
    costUsd: 0.04,
    latencyMs: 0,
    model: "mock-flux",
    providerId: "fal",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Scraper
// ─────────────────────────────────────────────────────────────────────────

export interface ScraperCallRecord {
  url: string;
  opts?: ScrapeOptions;
}

export function mockScraper(opts?: {
  id?: ProviderId;
  responses?: Array<ScrapeResult | Error>;
}): MockProvider<ScraperProvider, ScraperCallRecord, ScrapeResult> {
  const calls: ScraperCallRecord[] = [];
  const cursor = { index: 0 };
  const responses: Array<ScrapeResult | Error> = [...(opts?.responses ?? [])];

  const provider: ScraperProvider = {
    id: opts?.id ?? "firecrawl",
    async healthCheck(): Promise<ProviderHealth> {
      return health(provider.id, "scraper");
    },
    async fetch(url: string, fetchOpts?: ScrapeOptions): Promise<ScrapeResult> {
      calls.push({ url, opts: fetchOpts });
      const next = responses[cursor.index++];
      if (next === undefined) {
        throw new Error(
          `mockScraper: no response queued (cursor=${cursor.index - 1}, total=${responses.length})`,
        );
      }
      if (next instanceof Error) throw next;
      return next;
    },
  };

  return {
    provider,
    calls,
    cursor,
    enqueue: (r) => responses.push(r),
    setResponses: (r) => {
      responses.length = 0;
      responses.push(...r);
      cursor.index = 0;
    },
  };
}

export function scrapeResult(overrides?: Partial<ScrapeResult>): ScrapeResult {
  return {
    url: "https://supplier.example/product/123",
    title: "Mock Product",
    description: "A mock product description.",
    markdown: "# Mock Product\n\nNice product.",
    images: [
      { src: "https://supplier.example/img/1.jpg", alt: "front", width: 800, height: 800 },
    ],
    links: [],
    language: "en",
    fetchedAt: "2026-01-01T00:00:00.000Z",
    durationMs: 0,
    providerId: "firecrawl",
    costUsd: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Embedding
// ─────────────────────────────────────────────────────────────────────────

export interface EmbeddingCallRecord {
  opts: EmbeddingCallOptions;
}

export function mockEmbedding(opts?: {
  id?: ProviderId;
  responses?: Array<number[] | Error>;
  dimensions?: number;
}): MockProvider<EmbeddingProvider, EmbeddingCallRecord, number[]> {
  const calls: EmbeddingCallRecord[] = [];
  const cursor = { index: 0 };
  const responses: Array<number[] | Error> = [...(opts?.responses ?? [])];

  const provider: EmbeddingProvider = {
    id: opts?.id ?? "openai",
    dimensions: opts?.dimensions ?? 1536,
    async healthCheck(): Promise<ProviderHealth> {
      return health(provider.id, "embedding");
    },
    async embed(callOpts: EmbeddingCallOptions): Promise<number[]> {
      calls.push({ opts: callOpts });
      const next = responses[cursor.index++];
      if (next === undefined) {
        throw new Error(
          `mockEmbedding: no response queued (cursor=${cursor.index - 1}, total=${responses.length})`,
        );
      }
      if (next instanceof Error) throw next;
      return next;
    },
  };

  return {
    provider,
    calls,
    cursor,
    enqueue: (r) => responses.push(r),
    setResponses: (r) => {
      responses.length = 0;
      responses.push(...r);
      cursor.index = 0;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Internal: dummy health response
// ─────────────────────────────────────────────────────────────────────────

function health(
  providerId: ProviderId,
  capability: ProviderCapability,
): ProviderHealth {
  return {
    ok: true,
    providerId,
    capability,
    latencyMs: 0,
    costUsd: 0,
  };
}
