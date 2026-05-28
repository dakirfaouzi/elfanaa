import type {
  CatalogMetadata,
  CatalogOfferTier,
} from "@platform/builder-schema";
import { emptyCatalogMetadata } from "@platform/builder-schema";
import type {
  FanaaOfferTier,
  FanaaProductExtension,
  UniversalProduct,
} from "@platform/catalog-schema";
import type { StoreConfig } from "@platform/stores";
import { fanaaStore } from "@platform/stores";
import { toFanaaExtension } from "@platform/publishers";

/**
 * `catalog-metadata-defaults` — derive an initial `CatalogMetadata`
 * shape from a freshly-assembled `UniversalProduct`.
 *
 * # Where this fires
 *
 *   1. `productToDraftDocument` (apps/studio/lib/studio/product-to-draft.ts)
 *      calls this when the M5 pipeline emits a UniversalProduct and the
 *      Studio writes the canvas payload. The operator opens the draft to
 *      a pre-filled catalog panel — Tier-A "auto-derive with operator
 *      override" (Phase 2.3 decision 3).
 *
 *   2. Tests + scripts that need a deterministic baseline.
 *
 * # Determinism contract
 *
 * Given identical (`product`, `storeConfig`) inputs this function
 * returns a byte-identical `CatalogMetadata`. The heuristic core is
 * `toFanaaExtension` (deterministic by design) plus a thin shape
 * adapter; no Date.now / random / fetch.
 *
 * # What we derive vs. leave blank
 *
 * Auto-derived from the pipeline (the operator can override before
 * publish):
 *
 *   • `priceMinor`     ← `product.priceHint.amount`
 *   • `priceCurrency`  ← `product.priceHint.currency`
 *   • `sku`            ← `deriveSku({ id, slug })` (via toFanaaExtension)
 *   • `offerTiers`     ← `deriveOfferTiers(priceHint)` (1/2/3-pack ladder)
 *   • `productType`    ← keyword inference
 *   • `target`         ← keyword inference
 *   • `problems`       ← keyword inference (multi-value)
 *   • `upsellIds`      ← `product.upsellSuggestions`
 *   • `rating`         ← `product.rating` when set
 *
 * Left blank — operator decides explicitly:
 *
 *   • `collection`     — taxonomy decision (where the product lives on /shop).
 *   • `badges`         — Tier-A decision 5: no auto-generation from
 *                         positioning/tagline fields, those run higher false
 *                         positives than badges can afford.
 *   • `stockLeft`      — scarcity is a merchandising lever, not a content
 *                         signal. Defaults to null so the storefront's
 *                         conservative "no scarcity hint" branch wins.
 *   • `recentBuyers`   — same rationale as `stockLeft`.
 *   • `landingPath`    — bespoke landings are bespoke. Stays null.
 *
 * # Why this lives in apps/studio
 *
 * Like `product-to-draft.ts`, this is the layer that wires the
 * pipeline's UniversalProduct INTO the builder's input shape. Pure
 * type adapter — no DB, no fetch — so it's safely importable from
 * server components, tests, and scripts.
 */
export function deriveCatalogMetadataFromProduct(args: {
  product: UniversalProduct;
  storeConfig?: StoreConfig;
}): CatalogMetadata {
  const storeConfig = args.storeConfig ?? fanaaStore;
  const ext: FanaaProductExtension = toFanaaExtension({
    product: args.product,
    storeConfig,
  });

  const empty = emptyCatalogMetadata();
  const priceMinor = sanitisePriceMinor(args.product.priceHint?.amount);
  const priceCurrency =
    sanitiseCurrency(args.product.priceHint?.currency) ?? empty.priceCurrency;

  return {
    ...empty,
    priceMinor,
    priceCurrency,
    sku: ext.sku ?? null,
    offerTiers: mapOfferTiers(ext.offerTiers, priceCurrency),
    productType: ext.productType ?? null,
    target: ext.target ?? null,
    // `problems` is a multi-value taxonomy; null becomes [] to match
    // the schema's array contract (CatalogMetadataSchema.problems
    // defaults to []).
    problems: ext.problems ? [...ext.problems] : [],
    upsellIds: dedupeStrings(args.product.upsellSuggestions ?? []),
    rating: deriveRating(args.product.rating),
  };
}

/* -------------------------------------------------------------------------- */
/*                                Type adapters                                */
/* -------------------------------------------------------------------------- */

/**
 * Convert publisher `FanaaOfferTier[]` (which is what
 * `deriveOfferTiers` emits) into the `CatalogMetadata.offerTiers`
 * shape. The shapes are structurally identical, but the publisher
 * uses the package-local `Money` and we need the builder-schema's
 * `CatalogMoney`. A defensive map prevents accidental shape drift
 * if either side adds a field.
 *
 * Filters out tiers where `total.amount <= 0` because the schema
 * requires `nonnegative` and a zero-amount tier is a derivation
 * accident (priceHint = 0) the storefront would render as "FREE" —
 * conservative behaviour is to omit it from the ladder.
 */
function mapOfferTiers(
  tiers: FanaaOfferTier[] | undefined,
  fallbackCurrency: string,
): CatalogOfferTier[] {
  if (!tiers || tiers.length === 0) return [];
  const out: CatalogOfferTier[] = [];
  for (const t of tiers) {
    if (!Number.isInteger(t.quantity) || t.quantity <= 0) continue;
    const amount = Math.max(0, Math.round(t.total.amount));
    if (amount <= 0) continue;
    const currency =
      sanitiseCurrency(t.total.currency) ?? fallbackCurrency;
    out.push({
      quantity: t.quantity,
      total: { amount, currency },
    });
  }
  return out;
}

/**
 * Convert `UniversalProduct.rating` (`{ value, count }`, both
 * optional at runtime) into the schema's stricter shape. Both
 * fields must be sane for the rating to surface — partial ratings
 * render as "—" on the PDP which is uglier than hiding the widget.
 */
function deriveRating(
  rating: UniversalProduct["rating"],
): CatalogMetadata["rating"] {
  if (!rating) return null;
  const value = Number(rating.value);
  const count = Math.round(Number(rating.count));
  if (!Number.isFinite(value) || value < 0 || value > 5) return null;
  if (!Number.isFinite(count) || count < 0) return null;
  return { value, count };
}

/* -------------------------------------------------------------------------- */
/*                                  Sanitisers                                 */
/* -------------------------------------------------------------------------- */

/**
 * Clamp to the schema's contract: integer ≥ 0, ≤ 100_000_000.
 * Pipeline outputs occasionally float (`19_900.5` after a JSON round
 * trip through a model that emitted a decimal). The schema rejects
 * non-integers; we round before handing the value over.
 */
function sanitisePriceMinor(amount: number | undefined): number {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    return 0;
  }
  return Math.min(100_000_000, Math.round(amount));
}

/**
 * Validate an ISO 4217-shaped currency code. The schema requires
 * exactly 3 chars; we uppercase and reject anything else so an
 * accidental `"sar"` or `"SAR "` doesn't trip Zod at parse time.
 * Returns `undefined` on invalid input so the caller can fall back
 * to the schema default.
 */
function sanitiseCurrency(code: string | undefined): string | undefined {
  if (typeof code !== "string") return undefined;
  const trimmed = code.trim().toUpperCase();
  return trimmed.length === 3 ? trimmed : undefined;
}

/**
 * De-duplicate a list of slug-shaped strings while preserving order.
 * Pipeline outputs occasionally include the same upsell suggestion
 * twice when the prompt's example list bleeds into the response;
 * dedupe is cheap defence.
 */
function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}
