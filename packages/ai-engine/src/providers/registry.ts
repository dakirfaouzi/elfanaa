import type { StoreConfig } from "@platform/stores";
import { providerEnv, parseChain } from "./env";
import type {
  Adapter,
  ProviderChain,
  ProviderCapability,
  ProviderId,
} from "./types";
import type {
  EmbeddingProvider,
  ImageProvider,
  ScraperProvider,
  TextProvider,
  VisionProvider,
} from "./contracts";
import { createAnthropicAdapter } from "./adapters/anthropic";
import { createOpenAIAdapter } from "./adapters/openai";
import { createFalAdapter } from "./adapters/fal";
import { createFirecrawlAdapter } from "./adapters/firecrawl";

/**
 * Env-driven provider registry (PLATFORM.md §12 "Registry").
 *
 * # Resolution model
 *
 *   1. The capability's env chain (STUDIO_TEXT_PROVIDERS etc.) — or
 *      the capability default if unset — is parsed into an array of
 *      provider IDs.
 *   2. Each ID resolves to a multi-capability `Adapter` via the factory
 *      table below. Factories are MEMOISED — repeated lookups of the
 *      same ID return the same instance, so vendor SDK clients aren't
 *      re-instantiated for every chain resolution.
 *   3. The requested capability is pulled from each adapter. Adapters
 *      missing the capability are dropped silently (e.g. "fal" in a
 *      text chain).
 *   4. The first remaining provider becomes `primary`; the rest become
 *      `fallbacks`.
 *   5. If the entire chain produces zero providers, `primary` is
 *      `null` — callers must handle this (typically by surfacing a
 *      503-style error to the operator).
 *
 * # Store-scoped resolution
 *
 *   resolveTextForStore(storeConfig) takes the global chain and
 *   intersects it with `storeConfig.approvedProviders?.text` when
 *   set. This is how per-store provider allowlists land
 *   (PLATFORM.md §8 StoreConfig.approvedProviders).
 *
 * # No vendor SDK imports outside `./adapters/`
 *
 * This file imports adapter FACTORIES, never vendor SDKs directly. That
 * is the seam preserved by M4: anyone wanting to add a fifth vendor
 * adds a file under `./adapters/` and a line below — no edits to
 * contracts, no edits to types, no other code change.
 */

// ─────────────────────────────────────────────────────────────────────────
// Factory table
// ─────────────────────────────────────────────────────────────────────────

type AdapterFactory = () => Adapter;

const FACTORIES: Record<string, AdapterFactory> = {
  anthropic: createAnthropicAdapter,
  openai: createOpenAIAdapter,
  fal: createFalAdapter,
  firecrawl: createFirecrawlAdapter,
};

// Memoise — vendor SDK clients are expensive to instantiate and we
// resolve chains repeatedly across capabilities (Anthropic appears in
// both text + vision chains).
const ADAPTER_CACHE = new Map<string, Adapter>();

function getAdapter(id: string): Adapter | undefined {
  const cached = ADAPTER_CACHE.get(id);
  if (cached) return cached;
  const factory = FACTORIES[id];
  if (!factory) return undefined;
  const adapter = factory();
  ADAPTER_CACHE.set(id, adapter);
  return adapter;
}

/**
 * Test-only: drop the memoised adapters so a follow-up `resolve*()` call
 * re-reads `process.env`. Used by Vitest in M5+ to verify env-driven
 * behaviour without restarting the process.
 */
export function clearProviderCache(): void {
  ADAPTER_CACHE.clear();
}

// ─────────────────────────────────────────────────────────────────────────
// Resolution
// ─────────────────────────────────────────────────────────────────────────

function resolveChain<T>(
  capability: ProviderCapability,
  raw: string | undefined,
  pick: (a: Adapter) => T | undefined
): ProviderChain<T> {
  const ids = parseChain(raw, capability);
  const candidates = ids
    .map((id) => getAdapter(id))
    .filter((a): a is Adapter => !!a)
    .map(pick)
    .filter((p): p is T => !!p);
  return {
    primary: candidates[0] ?? null,
    fallbacks: candidates.slice(1),
  };
}

export function resolveText(): ProviderChain<TextProvider> {
  return resolveChain<TextProvider>("text", providerEnv.textChain(), (a) => a.text);
}

export function resolveVision(): ProviderChain<VisionProvider> {
  return resolveChain<VisionProvider>(
    "vision",
    providerEnv.visionChain(),
    (a) => a.vision
  );
}

export function resolveImage(): ProviderChain<ImageProvider> {
  return resolveChain<ImageProvider>(
    "image",
    providerEnv.imageChain(),
    (a) => a.image
  );
}

export function resolveScraper(): ProviderChain<ScraperProvider> {
  return resolveChain<ScraperProvider>(
    "scraper",
    providerEnv.scraperChain(),
    (a) => a.scraper
  );
}

export function resolveEmbedding(): ProviderChain<EmbeddingProvider> {
  return resolveChain<EmbeddingProvider>(
    "embedding",
    providerEnv.embeddingChain(),
    (a) => a.embedding
  );
}

/**
 * `registry` — convenience aggregate of every capability's current chain.
 *
 * Lazily computed: each property getter re-resolves so a runtime env
 * mutation (e.g. Inngest middleware injecting per-request overrides)
 * takes effect on next access without restarting the process.
 *
 * # Usage
 *
 *   const { primary, fallbacks } = registry.text;
 *   if (!primary) throw new Error("no text provider configured");
 *   const result = await primary.generate({...});
 */
export const registry = {
  get text(): ProviderChain<TextProvider> {
    return resolveText();
  },
  get vision(): ProviderChain<VisionProvider> {
    return resolveVision();
  },
  get image(): ProviderChain<ImageProvider> {
    return resolveImage();
  },
  get scraper(): ProviderChain<ScraperProvider> {
    return resolveScraper();
  },
  get embedding(): ProviderChain<EmbeddingProvider> {
    return resolveEmbedding();
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Store-scoped resolution (PLATFORM.md §8 StoreConfig.approvedProviders)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Intersect a global chain with a per-store allowlist. `allowlist` keys
 * map to provider IDs (NOT vendor models — those are picked at call
 * time via `opts.model`). Order from the global chain is preserved;
 * only providers absent from the allowlist are filtered out.
 *
 * `undefined` allowlist → identity (return the global chain unchanged).
 * Empty allowlist        → empty chain (`primary: null, fallbacks: []`).
 */
function intersectAllowlist<T extends { id: ProviderId }>(
  chain: ProviderChain<T>,
  allowlist: readonly string[] | undefined
): ProviderChain<T> {
  if (!allowlist) return chain;
  if (allowlist.length === 0) {
    return { primary: null, fallbacks: [] };
  }
  const allow = new Set(allowlist);
  const all = (chain.primary ? [chain.primary, ...chain.fallbacks] : [
    ...chain.fallbacks,
  ]).filter((p) => allow.has(p.id));
  return { primary: all[0] ?? null, fallbacks: all.slice(1) };
}

/** Per-store text-provider chain. Intersects global chain with
 *  `storeConfig.approvedProviders.text` when set. */
export function resolveTextForStore(
  storeConfig: StoreConfig
): ProviderChain<TextProvider> {
  return intersectAllowlist(resolveText(), storeConfig.approvedProviders?.text);
}

export function resolveVisionForStore(
  storeConfig: StoreConfig
): ProviderChain<VisionProvider> {
  return intersectAllowlist(
    resolveVision(),
    storeConfig.approvedProviders?.vision
  );
}

export function resolveImageForStore(
  storeConfig: StoreConfig
): ProviderChain<ImageProvider> {
  return intersectAllowlist(
    resolveImage(),
    storeConfig.approvedProviders?.image
  );
}

export function resolveScraperForStore(
  storeConfig: StoreConfig
): ProviderChain<ScraperProvider> {
  return intersectAllowlist(
    resolveScraper(),
    storeConfig.approvedProviders?.scrape
  );
}
