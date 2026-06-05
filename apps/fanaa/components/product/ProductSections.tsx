import { Fragment, type ComponentType } from "react";
import type { Product, ProductImage } from "@/lib/types";
import { ProductBenefits } from "./ProductBenefits";
import { ProductHowItWorks } from "./ProductHowItWorks";
import { ProductIngredients } from "./ProductIngredients";
import { ProductResults } from "./ProductResults";
import { ProductFoundersNote } from "./ProductFoundersNote";
import { ProductComparison } from "./ProductComparison";
import { ProductLifestyle } from "./ProductLifestyle";
import { ProductObjections } from "./ProductObjections";
import { ProductReviews } from "./ProductReviews";
import { ProductGuarantee } from "./ProductGuarantee";
import { ProductFAQ } from "./ProductFAQ";
import { PdpCtaAnchor } from "./PdpCtaAnchor";

/**
 * ProductSections — the dynamic, AI-orderable "story" stack of the PDP
 * (Step 4 §4.2 / ADR-S4-1).
 *
 * This replaces the previously-hardcoded section list between the commerce
 * shell (gallery + buy box, above) and related products (below). It is the
 * single renderer for both curated and AI-published products:
 *
 *   • AI products carry `sectionOrder` (catalog SectionKind strings chosen by
 *     the pipeline's structure stage) + grounded `sectionContent`. We render
 *     in that order, then append any remaining content-bearing sections in the
 *     default position so nothing the pipeline grounded is ever dropped.
 *   • Curated / legacy products carry neither. They fall through to
 *     DEFAULT_ORDER, whose effective output (the new mechanism/results/etc.
 *     sections self-render to null without content) is byte-identical to the
 *     pre-Step-4 fixed layout: benefits → ingredients → lifestyle → reviews →
 *     FAQ. No curated page regresses.
 *
 * Every child section is self-guarding (returns null when its content is
 * absent), so this orchestrator only decides ORDER, never visibility.
 */
type Props = { product: Product; image?: ProductImage };

/**
 * Multiple catalog SectionKinds can map to the same physical fanaa section
 * (e.g. `results_expectation` and `transformation` both render the results
 * timeline; `testimonials`/`reviews`/`social_proof` all mean the reviews
 * block). Collapsing to a stable render-key lets us dedupe cleanly.
 */
const KIND_TO_KEY: Record<string, string> = {
  benefits: "benefits",
  how_it_works: "how_it_works",
  ingredients: "ingredients",
  results_expectation: "results",
  transformation: "results",
  founders_note: "founders_note",
  comparison: "comparison",
  lifestyle: "lifestyle",
  objections: "objections",
  social_proof: "social_proof",
  testimonials: "social_proof",
  reviews: "social_proof",
  guarantee: "guarantee",
  faq: "faq",
};

const KEY_TO_COMPONENT: Record<string, ComponentType<Props>> = {
  benefits: ProductBenefits,
  how_it_works: ProductHowItWorks,
  ingredients: ProductIngredients,
  results: ProductResults,
  founders_note: ProductFoundersNote,
  comparison: ProductComparison,
  lifestyle: ProductLifestyle,
  objections: ProductObjections,
  social_proof: ProductReviews,
  guarantee: ProductGuarantee,
  faq: ProductFAQ,
};

/**
 * Curated-safe default. The first five non-null sections for a curated product
 * are benefits → ingredients → lifestyle → reviews → faq, matching the legacy
 * fixed layout exactly. New AI sections slot into conversion-optimal positions
 * for products that carry their content.
 */
const DEFAULT_ORDER: string[] = [
  "benefits",
  "how_it_works",
  "ingredients",
  "results",
  "founders_note",
  "comparison",
  "lifestyle",
  "objections",
  "social_proof",
  "guarantee",
  "faq",
];

/**
 * Image-led distribution (Phase 4.6.2) — which render-keys can host a generated
 * scene, in PRIORITY order (highest-converting visual moments first). The scene
 * pool is assigned down this list so that, when there are fewer scenes than
 * sections, the marquee moments (lifestyle, mechanism, results, comparison,
 * social proof) get the images and lower-priority blocks degrade to text-only.
 * FAQ is intentionally excluded — it stays text.
 */
const IMAGE_PRIORITY: string[] = [
  "lifestyle",
  "how_it_works",
  "results",
  "ingredients",
  "benefits",
  "comparison",
  "social_proof",
  "founders_note",
  "guarantee",
  "objections",
];

/**
 * Phase 4.6.3 — SEMANTIC matching. Each generated scene carries an `intent`
 * (mechanism / result / ingredient / proof / context / trust / detail / …). We
 * map a section render-key to the intents that belong on it so the RIGHT scene
 * lands on the right section (a "result" scene → results, an "ingredient" scene
 * → ingredients) instead of a positional guess.
 *
 * Matching is deliberately TOLERANT (substring / synonym regex) because `intent`
 * is a soft contract — the model may emit "before-after", "transformation", or
 * "result" for the same idea. Sections not listed here only receive scenes via
 * the positional fallback.
 */
const SECTION_INTENT_PATTERNS: Record<string, RegExp> = {
  lifestyle: /context|lifestyle|home|aspiration|vanity|bathroom|morning|evening|ritual|routine/i,
  how_it_works: /mechanis|process|\bhow\b|apply|applicat|step|absorb|science|works/i,
  results: /result|transform|before|after|outcome|glow|progress|reveal|journey/i,
  comparison: /compar|versus|\bvs\b|side[- ]?by|alternative|switch/i,
  social_proof: /proof|testimonial|review|customer|happy|confiden|smile|satisfied|community/i,
  founders_note: /founder|story|brand|maker|origin|craft/i,
  guarantee: /trust|guarantee|premium|reassur|pack|unbox|gift|hold/i,
  objections: /proof|context|confiden|reassur|honest/i,
  ingredients: /ingredient|texture|formula|swatch|\bdrop|serum|close|detail|natural|botanic/i,
  benefits: /benefit|problem|solution|concern|pain|relief/i,
};

function intentMatchesSection(intent: string | undefined, key: string): boolean {
  if (!intent) return false;
  const pattern = SECTION_INTENT_PATTERNS[key];
  return pattern ? pattern.test(intent) : false;
}

/**
 * Assign the generated scene pool to image-capable sections so the page becomes
 * image-led AND each section gets the most semantically-appropriate scene
 * (Phase 4.6.3). Two passes:
 *
 *   1. SEMANTIC — walk image-capable sections in priority order; give each the
 *      first unused scene whose `intent` matches that section.
 *   2. POSITIONAL fallback — fill any still-empty image-capable section with the
 *      next leftover scene, so the page stays image-led even when intents don't
 *      cover every section (preserves the 4.6.2 behaviour as the floor).
 *
 * Distinct scene per section (no cheap repetition); once the pool is exhausted
 * the remaining sections render text-only (curated-safe). Only keys actually in
 * the render order are eligible; FAQ/benefits are never imaged.
 */
export function assignSectionImages(
  product: Product,
  order: string[],
): Record<string, ProductImage> {
  const pool =
    product.lifestyleImages && product.lifestyleImages.length > 0
      ? product.lifestyleImages
      : (product.images ?? []).slice(1); // gallery minus hero, as a fallback pool
  if (pool.length === 0) return {};

  const present = new Set(order);
  const eligible = IMAGE_PRIORITY.filter((key) => present.has(key));
  const assignment: Record<string, ProductImage> = {};
  const used = new Set<number>();

  // Pass 1 — semantic: the right scene for the right section.
  for (const key of eligible) {
    const idx = pool.findIndex(
      (img, i) => !used.has(i) && intentMatchesSection(img.intent, key),
    );
    if (idx >= 0) {
      assignment[key] = pool[idx]!;
      used.add(idx);
    }
  }

  // Pass 2 — positional fallback: keep the page image-led.
  const leftover = pool
    .map((_, i) => i)
    .filter((i) => !used.has(i));
  let next = 0;
  for (const key of eligible) {
    if (assignment[key]) continue;
    if (next >= leftover.length) break;
    const idx = leftover[next]!;
    assignment[key] = pool[idx]!;
    used.add(idx);
    next += 1;
  }

  return assignment;
}

function resolveOrder(product: Product): string[] {
  const aiKeys = (product.sectionOrder ?? [])
    .map((kind) => KIND_TO_KEY[kind])
    .filter((key): key is string => Boolean(key));

  // AI order leads; the default order backfills any grounded section the
  // structure stage didn't explicitly place. Dedupe preserves first position.
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const key of [...aiKeys, ...DEFAULT_ORDER]) {
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }
  return ordered;
}

/**
 * Will the `results` section actually render content? Mirrors
 * `ProductResults`'s self-guard so we only drop a mid-scroll CTA anchor after
 * it when there is a real section above the anchor (no stray CTA over a
 * null-rendered block). Kept narrow — only the keys we anchor after need a
 * predicate; everything else relies on the end-of-narrative climax CTA.
 */
function resultsWillRender(product: Product): boolean {
  return Boolean(product.sectionContent?.results?.timeline?.length);
}

export function ProductSections({ product }: Props) {
  const order = resolveOrder(product);
  const sectionImages = assignSectionImages(product, order);

  // Sprint A #3 — repeated CTA anchors. The narrative is otherwise CTA-less
  // below the buy box. We place a mid-scroll anchor right after the high-intent
  // `results` moment (only when it renders) and a climax anchor at the end of
  // the story. Anchors are presentation-only (scroll-to buy box) — no commerce.
  return (
    <>
      {order.map((key) => {
        const Section = KEY_TO_COMPONENT[key];
        if (!Section) return null;
        if (key === "results" && resultsWillRender(product)) {
          return (
            <Fragment key={key}>
              <Section product={product} image={sectionImages[key]} />
              <PdpCtaAnchor />
            </Fragment>
          );
        }
        return <Section key={key} product={product} image={sectionImages[key]} />;
      })}
      {/* Climax CTA — re-ask for the order after the full story. */}
      <PdpCtaAnchor />
    </>
  );
}
