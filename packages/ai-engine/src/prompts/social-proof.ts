import type { StoreConfig } from "@platform/stores";
import { buildSystemPrompt } from "./system";

/**
 * Social-proof stage prompts (stage 10).
 *
 * Produces realistic-looking reviews, GCC-COD-tuned FAQs, and 5 ad
 * hooks (one per angle). PLATFORM.md §11 stage 10 failure mode:
 * "Realistic-name + dialect validation; reject if generic" — enforced
 * at the stage level by inspecting the output against the brand voice
 * forbidden-words list and looking for cliché names/cities.
 */
export function buildSocialProofSystemPrompt(opts: {
  storeConfig: StoreConfig;
}): string {
  return buildSystemPrompt({
    storeConfig: opts.storeConfig,
    task:
      "Produce realistic GCC customer reviews, 5–7 COD-objection-tuned FAQs, " +
      "and 5 ad hooks (one per the niche default angles unless the strategy " +
      "specifies otherwise). Every customer-facing field is bilingual.",
    outputFormat: "json",
    stageRules: [
      "Reviewer names MUST be realistic Saudi/Khaleeji given names — varied first names, no overuse of common ones.",
      "Reviewer cities MUST be drawn from a realistic distribution across the target market.",
      "Ratings MUST follow a realistic skew: ~70% five-star, ~20% four-star, ~10% three-star. No 1- or 2-star reviews.",
      "Review bodies MUST be specific to the product — never generic 'great product!' lines.",
      "FAQ questions MUST target COD funnel objections: payment timing, return policy, shipping window, call confirmation, fake-call concerns.",
      "Hooks MUST cover the angles supplied; angle slug appears in `angle`, the body is bilingual.",
    ],
  });
}

export function buildSocialProofUserPrompt(opts: {
  heroPromise: string;
  benefitLabels: string[];
  objections: string[];
  adAngles: string[];
}): string {
  return [
    "STRATEGY",
    "--------",
    `Hero promise: ${opts.heroPromise}`,
    `Benefits: ${opts.benefitLabels.join(", ")}`,
    `Objections to address: ${opts.objections.join(", ")}`,
    `Ad angles: ${opts.adAngles.join(", ")}`,
    "",
    "OUTPUT JSON:",
    "{",
    `  "reviews": [`,
    `    {`,
    `      "name": {"ar":"","en":""},`,
    `      "city": {"ar":"","en":""},`,
    `      "rating": 5,`,
    `      "body": {"ar":"","en":""},`,
    `      "date": "YYYY-MM-DD",`,
    `      "verified": true`,
    `    }`,
    `  ],`,
    `  "faq": [`,
    `    { "q": {"ar":"","en":""}, "a": {"ar":"","en":""} }`,
    `  ],`,
    `  "hooks": [`,
    `    {`,
    `      "angle": "emotional | functional | scarcity | authority | story | <other>",`,
    `      "body": {"ar":"","en":""},`,
    `      "cta": {"ar":"","en":""}`,
    `    }`,
    `  ]`,
    "}",
    "",
    "Counts: 4–6 reviews, 5–7 FAQs, exactly 5 hooks.",
  ].join("\n");
}
