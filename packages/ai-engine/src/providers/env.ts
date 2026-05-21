import type { ProviderCapability } from "./types";

/**
 * Provider-layer env getters.
 *
 * # Why lazy getters instead of module-load reads?
 *
 * The Studio container imports `@platform/ai-engine` at startup so the
 * registry is ready for the M5+ pipeline. If env reads happened at
 * module-load time, every undefined key would either:
 *
 *   (a) throw at process start → container restart loop, OR
 *   (b) silently freeze an empty value at boot → later env mutation
 *       (Inngest secrets injection, runtime override) has no effect.
 *
 * Lazy getters defer the read until first use of the relevant chain,
 * which gives missing-key errors a meaningful call site AND lets
 * runtime env overrides take effect mid-process if needed.
 *
 * Every getter returns `undefined` when missing — never throws.
 */
export const providerEnv = {
  // Vendor API keys
  anthropicApiKey: () => process.env.ANTHROPIC_API_KEY,
  openaiApiKey: () => process.env.OPENAI_API_KEY,
  falKey: () => process.env.FAL_KEY,
  firecrawlApiKey: () => process.env.FIRECRAWL_API_KEY,

  // Capability chain overrides — comma-separated provider IDs.
  textChain: () => process.env.STUDIO_TEXT_PROVIDERS,
  visionChain: () => process.env.STUDIO_VISION_PROVIDERS,
  imageChain: () => process.env.STUDIO_IMAGE_PROVIDERS,
  scraperChain: () => process.env.STUDIO_SCRAPER_PROVIDERS,
  embeddingChain: () => process.env.STUDIO_EMBED_PROVIDERS,
} as const;

/**
 * Default chain per capability — used by the registry when the
 * corresponding STUDIO_*_PROVIDERS env var is unset.
 *
 * Mirrors PLATFORM.md §12 "Adapter table": Anthropic primary for
 * text/vision with OpenAI as fallback; fal.ai sole provider for
 * image generation; Firecrawl sole scraper; OpenAI sole embedder.
 *
 * Stored as immutable arrays (`as const`) so a future code change
 * can't accidentally mutate the defaults.
 */
export const DEFAULT_CHAINS = {
  text: ["anthropic", "openai"],
  vision: ["anthropic", "openai"],
  image: ["fal"],
  scraper: ["firecrawl"],
  embedding: ["openai"],
} as const satisfies Record<ProviderCapability, readonly string[]>;

/**
 * Parse a comma-separated chain string into an array of IDs. Whitespace
 * around each ID is stripped; empty IDs are dropped. Returns the
 * capability default when `raw` is undefined or empty.
 *
 *   "anthropic, openai"   → ["anthropic", "openai"]
 *   "anthropic,,,openai"  → ["anthropic", "openai"]
 *   undefined             → DEFAULT_CHAINS[capability]
 *   ""                    → DEFAULT_CHAINS[capability]
 */
export function parseChain(
  raw: string | undefined,
  capability: ProviderCapability
): string[] {
  if (!raw || raw.trim() === "") {
    return [...DEFAULT_CHAINS[capability]];
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
