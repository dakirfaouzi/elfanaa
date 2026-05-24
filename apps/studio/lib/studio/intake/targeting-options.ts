import type {
  AwarenessValue,
  EmotionalAngleValue,
  GenderValue,
  PrimaryLanguageValue,
  SophisticationValue,
  ToneStyleValue,
} from "@platform/ingest";

/**
 * UI label dictionaries for the structured targeting controls.
 *
 * Lives in the studio app (not the contracts package) because
 * these are PRESENTATION strings, not part of the canonical
 * contract. If product copy changes ("Beginner" → "Newbie"),
 * we don't want to bump a contracts package version.
 *
 * Every dictionary's KEY set MUST match the corresponding
 * `XYZ_VALUES` const in `@platform/ingest`. Missing a key here
 * causes a TypeScript error at the option-list construction
 * sites, which is the intended failure mode (so adding a new
 * value in the contract forces a deliberate label addition
 * here).
 */

export const GENDER_LABELS: Record<GenderValue, string> = {
  female: "Women",
  male: "Men",
  any: "Any gender",
};

export const PRIMARY_LANGUAGE_LABELS: Record<PrimaryLanguageValue, string> = {
  ar: "Arabic",
  en: "English",
  mixed: "Arabic + English",
};

export const AWARENESS_LABELS: Record<AwarenessValue, string> = {
  unaware: "Unaware (doesn't know they have the problem)",
  "problem-aware": "Problem-aware (knows the pain, not the solution)",
  "solution-aware": "Solution-aware (knows solutions exist, not the brand)",
  "product-aware": "Product-aware (knows the brand, comparing options)",
  "most-aware": "Most-aware (ready to buy, needs the offer)",
};

export const SOPHISTICATION_LABELS: Record<SophisticationValue, string> = {
  beginner: "Beginner (new to the category)",
  intermediate: "Intermediate (tried a few products)",
  advanced: "Advanced (knows the field well)",
  expert: "Expert (deep knowledge)",
};

export const EMOTIONAL_ANGLE_LABELS: Record<EmotionalAngleValue, string> = {
  fear: "Fear / loss aversion",
  desire: "Desire / aspiration",
  curiosity: "Curiosity / discovery",
  belonging: "Belonging / community",
  status: "Status / prestige",
  transformation: "Transformation / change",
};

export const TONE_STYLE_LABELS: Record<ToneStyleValue, string> = {
  clinical: "Clinical (evidence-led)",
  luxurious: "Luxurious (premium, refined)",
  playful: "Playful (warm, conversational)",
  authoritative: "Authoritative (expert, directive)",
  intimate: "Intimate (one-to-one, personal)",
  energetic: "Energetic (high-octane, urgent)",
};

/**
 * Curated GCC + adjacent markets the Fanaa operator audience
 * actually targets. Free-text fallback supported by the schema
 * — this is just the dropdown shortlist.
 */
export const MARKET_LABELS: Record<string, string> = {
  SA: "Saudi Arabia",
  AE: "United Arab Emirates",
  KW: "Kuwait",
  QA: "Qatar",
  BH: "Bahrain",
  OM: "Oman",
  EG: "Egypt",
  JO: "Jordan",
  MA: "Morocco",
  US: "United States",
};
