/**
 * Rich section content — Step 4 (PLATFORM.md §26.4).
 *
 * The pipeline's `copy` stage produces the hero/benefits/description spine.
 * This block carries the *additional* conversion sections a premium GCC
 * direct-response page needs: mechanism storytelling, a results/expectations
 * timeline, a guarantee, a comparison, and objection handling.
 *
 * Every field is OPTIONAL on purpose: the generator omits any block it cannot
 * ground in the product reality (vision + research). A publisher renders only
 * the blocks that are present — no placeholder/empty sections (the Step 4
 * "eliminate placeholder sections" goal).
 *
 * Ingredients are NOT here — they populate the existing
 * `UniversalProduct.ingredients` (`ProductIngredient[]`) field. Objections are
 * sourced from the strategy stage (`StrategyOutput.objections`) and mapped in
 * during assemble, so they do not cost an extra generation call.
 */
import type { LocalizedString } from "./locales";

/** One step in the mechanism / "how it works" explanation. */
export interface MechanismStep {
  title: LocalizedString;
  body: LocalizedString;
}

/** Mechanism-aware storytelling — WHY/HOW the product produces the result. */
export interface HowItWorksContent {
  /** One-sentence mechanism summary. */
  summary: LocalizedString;
  /** 2–5 ordered steps. */
  steps: MechanismStep[];
}

/** One milestone on the results/expectations timeline. */
export interface ResultMilestone {
  /** e.g. "First use", "Week 1", "Week 4". */
  when: LocalizedString;
  outcome: LocalizedString;
}

/** Realistic expectations the buyer can anticipate over time. */
export interface ResultsContent {
  intro?: LocalizedString;
  /** 2–5 milestones, in chronological order. */
  timeline: ResultMilestone[];
}

/** Risk-reversal / guarantee block. */
export interface GuaranteeContent {
  title: LocalizedString;
  body: LocalizedString;
}

/** "Us vs the usual way" positioning. */
export interface ComparisonContent {
  intro?: LocalizedString;
  /** Advantages of this product. */
  ours: LocalizedString[];
  /** Shortcomings of the typical alternative. */
  usual: LocalizedString[];
}

/** A single objection + its neutralising response. */
export interface ObjectionItem {
  objection: LocalizedString;
  response: LocalizedString;
}

/** Objection handling — sourced from the strategy stage. */
export interface ObjectionsContent {
  /** 2–6 objection/response pairs. */
  items: ObjectionItem[];
}

/**
 * Optional rich content blocks carried on `UniversalProduct`. Each is omitted
 * when the generator cannot ground it in the product.
 */
export interface SectionContent {
  howItWorks?: HowItWorksContent;
  results?: ResultsContent;
  guarantee?: GuaranteeContent;
  comparison?: ComparisonContent;
  objections?: ObjectionsContent;
}
