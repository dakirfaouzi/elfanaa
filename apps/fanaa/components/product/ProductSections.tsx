import type { ComponentType } from "react";
import type { Product } from "@/lib/types";
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
type Props = { product: Product };

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

export function ProductSections({ product }: Props) {
  const order = resolveOrder(product);
  return (
    <>
      {order.map((key) => {
        const Section = KEY_TO_COMPONENT[key];
        if (!Section) return null;
        return <Section key={key} product={product} />;
      })}
    </>
  );
}
