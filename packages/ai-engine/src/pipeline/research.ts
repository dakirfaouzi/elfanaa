import type { ScraperProvider } from "../providers/contracts";
import { ResearchOutputSchema } from "../schemas/research";
import type { StageContext } from "./types";
import type { ResearchInput, ResearchOutput } from "./types-research";

/**
 * Stage 02 — Research / scrape (PLATFORM.md §11).
 *
 * Wraps a `ScraperProvider` call with structural handling of the
 * documented failure mode: "If both fail, mark skipped; downstream
 * uses only vision." This stage NEVER throws on scrape failure — it
 * returns a `skipped: true` result so the M6 worker can continue the
 * run without the scrape contribution.
 *
 * Why not retry across providers here?
 * → Provider fallback is the M4 registry's job (the worker pulls a
 *   ProviderChain and feeds the primary in; if it 5xxs the worker
 *   re-invokes this stage with the next provider). Keeping retry
 *   inside the stage would double-retry and inflate cost.
 */
export async function research(
  opts: {
    input: ResearchInput;
    providers: { scraper: ScraperProvider };
  } & StageContext,
): Promise<ResearchOutput> {
  const startedAt = Date.now();
  const scrapedAtIso = new Date().toISOString();

  if (opts.input.skip) {
    const skippedOutput: ResearchOutput = {
      supplierUrl: opts.input.supplierUrl,
      scrapedAt: scrapedAtIso,
      skipped: true,
      skipReason: "operator_opt_out",
      costUsd: 0,
      durationMs: 0,
    };
    return ResearchOutputSchema.parse(skippedOutput);
  }

  try {
    const result = await opts.providers.scraper.fetch(opts.input.supplierUrl, {
      formats: ["markdown", "links"],
      waitFor: 2_000,
      followRedirects: true,
    });

    const output: ResearchOutput = {
      supplierUrl: opts.input.supplierUrl,
      scrapedAt: result.fetchedAt ?? scrapedAtIso,
      skipped: false,
      title: result.title,
      description: result.description,
      markdown: result.markdown,
      language: result.language,
      images: result.images?.map((img) => ({
        src: img.src,
        alt: img.alt,
        width: img.width,
        height: img.height,
      })),
      links: result.links,
      costUsd: result.costUsd,
      providerId: result.providerId,
      durationMs: result.durationMs ?? Date.now() - startedAt,
    };

    return ResearchOutputSchema.parse(output);
  } catch (err) {
    const skippedOutput: ResearchOutput = {
      supplierUrl: opts.input.supplierUrl,
      scrapedAt: scrapedAtIso,
      skipped: true,
      skipReason:
        err instanceof Error
          ? `scrape_failed: ${err.message}`
          : "scrape_failed: unknown",
      costUsd: 0,
      durationMs: Date.now() - startedAt,
    };
    return ResearchOutputSchema.parse(skippedOutput);
  }
}
