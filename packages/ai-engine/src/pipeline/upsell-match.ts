import type { EmbeddingProvider } from "../providers/contracts";
import { UpsellMatchOutputSchema } from "../schemas/upsell-match";
import type { StageContext } from "./types";
import type {
  UpsellMatchInput,
  UpsellMatchOutput,
} from "./types-upsell-match";

/**
 * Stage 11 — Upsell match (PLATFORM.md §11).
 *
 * Failure mode: "Fallback to store best-sellers." This stage is the
 * only one in M5 with an OPTIONAL provider — embedding generation is
 * non-essential because every store has best-sellers to fall back on.
 *
 * # Why a port object instead of a real DB call?
 *
 * The stage is pure: it accepts a `catalog` port (see
 * `types-upsell-match.ts`) that the M6 worker fills with a pgvector
 * adapter and tests fill with an in-memory fixture. This keeps M5
 * tests DB-free per the user's strict scope.
 *
 * # Source labelling
 *
 * The output's `source` field tells the publisher whether to weight
 * these suggestions ("vector" = high-confidence semantic match,
 * "best_sellers" = generic fallback, "empty" = catalog can't help).
 */
export async function upsellMatch(
  opts: {
    input: UpsellMatchInput;
    providers: { embedding?: EmbeddingProvider };
  } & StageContext,
): Promise<UpsellMatchOutput> {
  const startedAt = Date.now();
  const limit = opts.input.limit ?? 4;
  const seed = buildEmbeddingSeed(opts.input);

  if (opts.providers.embedding) {
    try {
      const embedding = await opts.providers.embedding.embed({
        input: seed,
        storeId: opts.storeConfig.id,
        runId: opts.runId,
      });

      const matches = await opts.input.catalog.searchByEmbedding({
        embedding,
        limit,
      });

      if (matches.length > 0) {
        const output: UpsellMatchOutput = {
          suggestedProductIds: matches.map((m) => m.id),
          source: "vector",
          durationMs: Date.now() - startedAt,
        };
        return UpsellMatchOutputSchema.parse(output);
      }
    } catch {
      // Fall through to best-sellers.
    }
  }

  const best = await opts.input.catalog.topBestSellers({ limit });
  const output: UpsellMatchOutput = {
    suggestedProductIds: best.map((p) => p.id),
    source: best.length > 0 ? "best_sellers" : "empty",
    durationMs: Date.now() - startedAt,
  };
  return UpsellMatchOutputSchema.parse(output);
}

/**
 * Builds the text the embedding provider hashes into a vector. We
 * concatenate the hero promise + benefit titles + product description
 * — enough semantic surface for cosine similarity to find aligned
 * products without bloating the input.
 */
function buildEmbeddingSeed(input: UpsellMatchInput): string {
  const parts: string[] = [];
  parts.push(input.strategy.heroPromise.en, input.strategy.heroPromise.ar);
  parts.push(input.copy.title.en, input.copy.title.ar);
  parts.push(input.copy.description.en, input.copy.description.ar);
  for (const angle of input.strategy.benefitAngles) {
    parts.push(angle.title.en, angle.title.ar);
  }
  return parts.filter((s) => s.trim().length > 0).join(" ");
}
