import FirecrawlApp from "@mendable/firecrawl-js";
import type {
  Adapter,
  ProviderHealth,
  ProviderId,
} from "../types";
import type { ScraperProvider } from "../contracts";
import type { ScrapeOptions, ScrapeResult } from "../result-types";
import { providerEnv } from "../env";

/**
 * Firecrawl adapter — supplier-URL scraper (PLATFORM.md §11 stage 02).
 *
 * # Why Firecrawl
 *
 *   • Handles JS-heavy SPAs and supplier sites with rotating selectors
 *     (Alibaba/AliExpress) — Cheerio/Playwright-from-scratch turned out
 *     to be a maintenance hole.
 *   • Returns clean markdown by default, which is what the M5 research
 *     stage feeds into Claude.
 *   • Cheap: ~$0.001 per page on standard scrape.
 *
 * # Health-check ping
 *
 * Scrapes `https://example.com` — the canonical "always available, small,
 * stable, free to scrape" target. Total cost ~$0.001 per ping. We
 * scrape rather than calling a credit-balance endpoint because Firecrawl
 * has changed its credit/usage API surface multiple times and a real
 * scrape is the most reliable signal of "the key works end-to-end".
 */

const PROVIDER_ID: ProviderId = "firecrawl";
const HEALTH_TARGET_URL = "https://example.com";
const ESTIMATED_COST_USD = 0.001;

// ─────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────

export function createFirecrawlAdapter(): Adapter {
  const apiKey = providerEnv.firecrawlApiKey();

  if (!apiKey) {
    return { id: PROVIDER_ID, scraper: createStubScraperProvider() };
  }

  const client = new FirecrawlApp({ apiKey });

  const scraper: ScraperProvider = {
    id: PROVIDER_ID,

    async healthCheck(): Promise<ProviderHealth> {
      const startedAt = performance.now();
      try {
        const res = await client.scrapeUrl(HEALTH_TARGET_URL, {
          formats: ["markdown"],
        });
        const latencyMs = Math.round(performance.now() - startedAt);
        const ok = res.success === true;
        if (!ok) {
          return {
            ok: false,
            providerId: PROVIDER_ID,
            capability: "scraper",
            latencyMs,
            // Firecrawl's failure response carries an `error` string.
            errorMessage:
              (res as { error?: string }).error ?? "firecrawl_scrape_failed",
          };
        }
        return {
          ok: true,
          providerId: PROVIDER_ID,
          capability: "scraper",
          latencyMs,
          costUsd: ESTIMATED_COST_USD,
          detail: {
            target: HEALTH_TARGET_URL,
            markdownBytes: (res.markdown ?? "").length,
          },
        };
      } catch (err) {
        return {
          ok: false,
          providerId: PROVIDER_ID,
          capability: "scraper",
          latencyMs: Math.round(performance.now() - startedAt),
          errorMessage: errorMessage(err),
        };
      }
    },

    async fetch(url: string, opts?: ScrapeOptions): Promise<ScrapeResult> {
      const startedAt = performance.now();
      const formats = opts?.formats ?? ["markdown", "links"];
      // Firecrawl's TypeScript types accept a slightly different format
      // union than our public surface. Narrow before passing.
      const firecrawlFormats = formats.filter((f) =>
        ["markdown", "html", "links", "screenshot"].includes(f)
      ) as ("markdown" | "html" | "links" | "screenshot")[];

      const res = await client.scrapeUrl(url, {
        formats: firecrawlFormats,
        waitFor: opts?.waitFor,
      });
      const durationMs = Math.round(performance.now() - startedAt);

      if (!res.success) {
        throw new Error(
          `firecrawl_scrape_failed: ${(res as { error?: string }).error ?? "unknown"}`
        );
      }

      // Extract images from the scrape — Firecrawl's response surfaces
      // some image refs in the metadata; for richer extraction we'd
      // also walk the html (M5 vision stage will refine this).
      const meta = res.metadata ?? {};
      const ogImage = (meta as { ogImage?: string }).ogImage;
      const images = ogImage ? [{ src: ogImage }] : undefined;

      return {
        url,
        title: (meta as { title?: string }).title,
        description: (meta as { description?: string }).description,
        markdown: res.markdown,
        html: res.html,
        text: undefined,
        images,
        links: res.links,
        language: (meta as { language?: string }).language,
        fetchedAt: new Date().toISOString(),
        durationMs,
        providerId: PROVIDER_ID,
        costUsd: ESTIMATED_COST_USD,
      };
    },
  };

  return { id: PROVIDER_ID, scraper };
}

// ─────────────────────────────────────────────────────────────────────────
// Stub
// ─────────────────────────────────────────────────────────────────────────

function createStubScraperProvider(): ScraperProvider {
  return {
    id: PROVIDER_ID,
    async healthCheck() {
      return {
        ok: false,
        providerId: PROVIDER_ID,
        capability: "scraper",
        latencyMs: 0,
        errorMessage: "missing_api_key:FIRECRAWL_API_KEY",
      };
    },
    async fetch() {
      throw new Error(
        "firecrawl_scraper_unavailable: FIRECRAWL_API_KEY is not set"
      );
    },
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
