import type {
  EmbeddingCallOptions,
  EmbeddingProvider,
  ImageCallOptions,
  ImageProvider,
  ImageResult,
  ProviderHealth,
  ScrapeOptions,
  ScrapeResult,
  ScraperProvider,
  TextCallOptions,
  TextProvider,
  TextResult,
  VisionCallOptions,
  VisionProvider,
  VisionResult,
} from "@platform/ai-engine/providers";
import type { ResolvedProviders } from "../../provider-wiring";
import {
  fixtureCopy,
  fixtureCreativePrompts,
  fixtureImageResults,
  fixtureScrapeResult,
  fixtureSectionContent,
  fixtureSocialProof,
  fixtureStrategy,
  fixtureStructureModelResponse,
  fixtureVisionModelResponse,
  textResult,
  visionResult,
} from "./fixtures";

/**
 * Build a happy-path `ResolvedProviders` bundle pre-loaded with the
 * canned responses every M5 stage expects, in the order the
 * orchestrator dispatches them:
 *
 *   research        → scraper.fetch() ×1
 *   vision          → vision.analyze() ×1
 *   strategy        → text.generate() ×1
 *   structure       → text.generate() ×1
 *   copy            → text.generate() ×1
 *   creativePrompts → text.generate() ×1
 *   imageGen        → image.generate() ×N (N = hero + lifestyle.length)
 *   imagePost       → (no provider)
 *   socialProof     → text.generate() ×1
 *   sectionContent  → text.generate() ×1
 *   upsellMatch     → (embedding optional — we omit it so the stage
 *                       falls through to best-sellers, then `empty`)
 *   assemble        → (no provider)
 *
 * Total: 6 text calls, 1 vision, 1 scraper, 2 image, 0 embedding.
 *
 * # Returning the buffers
 *
 * Each provider exposes a `calls` array recording every invocation, so
 * tests can assert on call counts (e.g. "stage retried twice ⇒ 2 calls
 * to text"). The `enqueue*` helpers let tests inject failure responses
 * to exercise retry paths.
 */
export interface MockBundle {
  providers: ResolvedProviders;
  text: MockProviderState<TextCallOptions<unknown>, TextResult<unknown>>;
  vision: MockProviderState<VisionCallOptions<unknown>, VisionResult<unknown>>;
  image: MockProviderState<ImageCallOptions, ImageResult>;
  scraper: MockProviderState<
    { url: string; opts?: ScrapeOptions },
    ScrapeResult
  >;
  embedding: MockProviderState<EmbeddingCallOptions, number[]> | undefined;
}

export interface MockProviderState<TCall, TResult> {
  /** Records every invocation in dispatch order. */
  calls: TCall[];
  /** Inject an extra response on top of the existing queue. */
  enqueue(response: TResult | Error): void;
  /** Replace the response queue wholesale. */
  setResponses(responses: Array<TResult | Error>): void;
}

export interface MockBundleOptions {
  /** When true, includes an embedding mock pre-loaded with a stub vector. */
  withEmbedding?: boolean;
  /** Per-image cost (default $0.04, matches fal.ai pricing). */
  perImageUsd?: number;
}

export function createMockBundle(opts?: MockBundleOptions): MockBundle {
  const text = mockText({
    responses: [
      textResult(fixtureStrategy),
      textResult(fixtureStructureModelResponse),
      textResult(fixtureCopy),
      textResult(fixtureCreativePrompts),
      textResult(fixtureSocialProof),
      textResult(fixtureSectionContent),
    ],
  });
  const vision = mockVision({
    responses: [visionResult(fixtureVisionModelResponse)],
  });
  const scraper = mockScraper({
    responses: [fixtureScrapeResult],
  });
  const image = mockImage({
    responses: fixtureImageResults(),
    perImageUsd: opts?.perImageUsd,
  });
  const embedding = opts?.withEmbedding
    ? mockEmbedding({
        responses: [Array.from({ length: 1536 }, (_, i) => i / 1536)],
      })
    : undefined;

  return {
    providers: {
      text: text.provider,
      vision: vision.provider,
      image: image.provider,
      scraper: scraper.provider,
      embedding: embedding?.provider,
    },
    text: text.state,
    vision: vision.state,
    image: image.state,
    scraper: scraper.state,
    embedding: embedding?.state,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Internal mock provider factories
// ─────────────────────────────────────────────────────────────────────────

function makeState<TCall, TResult>(
  responses: Array<TResult | Error>,
  cursor: { i: number },
  calls: TCall[],
): MockProviderState<TCall, TResult> {
  return {
    calls,
    enqueue(r) {
      responses.push(r);
    },
    setResponses(r) {
      responses.length = 0;
      responses.push(...r);
      cursor.i = 0;
    },
  };
}

interface MockText {
  provider: TextProvider;
  state: MockProviderState<TextCallOptions<unknown>, TextResult<unknown>>;
}

function mockText(opts: {
  responses: Array<TextResult<unknown> | Error>;
}): MockText {
  const responses = [...opts.responses];
  const cursor = { i: 0 };
  const calls: TextCallOptions<unknown>[] = [];
  const provider: TextProvider = {
    id: "anthropic",
    healthCheck: () => Promise.resolve(okHealth("text")),
    async generate<T>(callOpts: TextCallOptions<T>): Promise<TextResult<T>> {
      calls.push(callOpts as TextCallOptions<unknown>);
      const next = responses[cursor.i++];
      if (next === undefined)
        throw new Error(
          `mockText: queue exhausted at cursor ${cursor.i - 1} (total ${responses.length})`,
        );
      if (next instanceof Error) throw next;
      return next as unknown as TextResult<T>;
    },
  };
  return { provider, state: makeState(responses, cursor, calls) };
}

interface MockVision {
  provider: VisionProvider;
  state: MockProviderState<VisionCallOptions<unknown>, VisionResult<unknown>>;
}

function mockVision(opts: {
  responses: Array<VisionResult<unknown> | Error>;
}): MockVision {
  const responses = [...opts.responses];
  const cursor = { i: 0 };
  const calls: VisionCallOptions<unknown>[] = [];
  const provider: VisionProvider = {
    id: "anthropic",
    healthCheck: () => Promise.resolve(okHealth("vision")),
    async analyze<T>(callOpts: VisionCallOptions<T>): Promise<VisionResult<T>> {
      calls.push(callOpts as VisionCallOptions<unknown>);
      const next = responses[cursor.i++];
      if (next === undefined)
        throw new Error(
          `mockVision: queue exhausted at cursor ${cursor.i - 1}`,
        );
      if (next instanceof Error) throw next;
      return next as unknown as VisionResult<T>;
    },
  };
  return { provider, state: makeState(responses, cursor, calls) };
}

interface MockImage {
  provider: ImageProvider;
  state: MockProviderState<ImageCallOptions, ImageResult>;
}

function mockImage(opts: {
  responses: Array<ImageResult | Error>;
  perImageUsd?: number;
}): MockImage {
  const responses = [...opts.responses];
  const cursor = { i: 0 };
  const calls: ImageCallOptions[] = [];
  const provider: ImageProvider = {
    id: "fal",
    cost: { perImageUsd: opts.perImageUsd ?? 0.04 },
    healthCheck: () => Promise.resolve(okHealth("image")),
    async generate(callOpts: ImageCallOptions): Promise<ImageResult> {
      calls.push(callOpts);
      const next = responses[cursor.i++];
      if (next === undefined)
        throw new Error(`mockImage: queue exhausted at cursor ${cursor.i - 1}`);
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return { provider, state: makeState(responses, cursor, calls) };
}

interface MockScraper {
  provider: ScraperProvider;
  state: MockProviderState<
    { url: string; opts?: ScrapeOptions },
    ScrapeResult
  >;
}

function mockScraper(opts: {
  responses: Array<ScrapeResult | Error>;
}): MockScraper {
  const responses = [...opts.responses];
  const cursor = { i: 0 };
  const calls: { url: string; opts?: ScrapeOptions }[] = [];
  const provider: ScraperProvider = {
    id: "firecrawl",
    healthCheck: () => Promise.resolve(okHealth("scraper")),
    async fetch(url: string, fetchOpts?: ScrapeOptions): Promise<ScrapeResult> {
      calls.push({ url, opts: fetchOpts });
      const next = responses[cursor.i++];
      if (next === undefined)
        throw new Error(
          `mockScraper: queue exhausted at cursor ${cursor.i - 1}`,
        );
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return { provider, state: makeState(responses, cursor, calls) };
}

interface MockEmbedding {
  provider: EmbeddingProvider;
  state: MockProviderState<EmbeddingCallOptions, number[]>;
}

function mockEmbedding(opts: {
  responses: Array<number[] | Error>;
}): MockEmbedding {
  const responses = [...opts.responses];
  const cursor = { i: 0 };
  const calls: EmbeddingCallOptions[] = [];
  const provider: EmbeddingProvider = {
    id: "openai",
    dimensions: 1536,
    healthCheck: () => Promise.resolve(okHealth("embedding")),
    async embed(callOpts: EmbeddingCallOptions): Promise<number[]> {
      calls.push(callOpts);
      const next = responses[cursor.i++];
      if (next === undefined)
        throw new Error(
          `mockEmbedding: queue exhausted at cursor ${cursor.i - 1}`,
        );
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return { provider, state: makeState(responses, cursor, calls) };
}

function okHealth(
  capability: ProviderHealth["capability"],
): ProviderHealth {
  return {
    ok: true,
    providerId: "anthropic",
    capability,
    latencyMs: 0,
    costUsd: 0,
  };
}
