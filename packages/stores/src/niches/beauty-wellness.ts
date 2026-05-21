import type { NicheProfile } from "../contracts";

/**
 * Beauty & wellness niche profile.
 *
 * Shared across all beauty/wellness stores (Fanaa today, future siblings
 * tomorrow). Store-specific brand voice + filter taxonomy stay in
 * `StoreConfig.brand` / `apps/<store>/lib/types.ts`; this file holds only
 * niche-level (cross-store) tuning.
 *
 * The pipeline stages that consume this profile (PLATFORM.md §11):
 *   • stage 04 Strategy           — `defaultAngles` seeds positioning
 *   • stage 05 Section structure  — `sections` constrains the layout pick
 *   • stage 06 Arabic copywriting — `legalGuardrails` appended to system prompt
 *   • stage 07 Results expectations — `expectationsModel` drives the section
 *   • stage 09 Ad hooks            — `defaultAngles` drives the 5 angles
 */
export const beautyWellnessNiche: NicheProfile = {
  id: "beauty_wellness",

  sections: [
    "hero",
    "benefits",
    "ingredients",
    "lifestyle",
    "results_expectation",
    "social_proof",
    "faq",
    "guarantee",
    "cross_sell",
    "creative_strip",
    "founders_note",
    "sticky_cta",
  ],

  productExtensions: ["beauty_wellness"],

  // Verbatim KSA / GCC compliance posture for skincare and wellness claims.
  // The copy stage receives this as an appended system-prompt fragment.
  // Updates here propagate platform-wide on next regeneration without
  // touching prompts.
  legalGuardrails: [
    "Never claim treatment of medical conditions or imply pharmaceutical efficacy.",
    "Avoid before/after timelines that imply guaranteed results — frame outcomes as typical, not promised.",
    "Do not name competitor brands or compare against them by name.",
    "Avoid 'cure', 'heal', 'treat', 'eliminate' for cosmetic products.",
    "Respect SFDA (Saudi Food & Drug Authority) marketing posture for cosmetics: function-led claims, no therapeutic claims.",
  ].join(" "),

  expectationsModel: {
    immediate: {
      ar: "إحساس فوري بالنعومة والترطيب من أول استخدام.",
      en: "Immediate softness and hydration from the very first use.",
    },
    shortTerm: {
      ar: "خلال ١-٢ أسبوع: تحسن ملحوظ في ملمس البشرة وتوحيد لونها.",
      en: "1–2 weeks: noticeable improvement in skin texture and tone.",
    },
    fullResults: {
      ar: "بعد ٤-٨ أسابيع من الاستعمال المنتظم: نتائج كاملة وثابتة.",
      en: "4–8 weeks of consistent use: full, sustained results.",
    },
    disclaimers: [
      {
        ar: "النتائج تختلف من شخص لآخر حسب نوع البشرة ومدى الالتزام بالروتين.",
        en: "Results vary by skin type and how consistently the routine is followed.",
      },
    ],
  },

  defaultAngles: [
    "emotional_transformation",
    "ingredient_authority",
    "ritual_aesthetic",
    "saudi_authenticity",
    "scarcity_urgency",
  ],
};
