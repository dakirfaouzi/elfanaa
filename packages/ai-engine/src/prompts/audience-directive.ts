/**
 * Audience & positioning directive builder (Step 3 — intelligence layer).
 *
 * # Why this exists
 *
 * Before Step 3, the structured intake targeting (awareness, sophistication,
 * emotional angle, tone, demographics, market, language) was flattened into a
 * human-readable string and passed to ONLY the `strategy` stage as
 * `operatorNotes`. Downstream stages (`copy`, `creative_prompts`) saw nothing,
 * so the operator's choices barely shaped the output.
 *
 * This module turns the structured targeting object into a single,
 * deterministic, ENFORCED directive block that is appended to the system
 * prompt of every text stage (via `buildSystemPrompt`). Because it lives in
 * the system prompt — not buried in user-prompt prose — the model treats it as
 * a hard constraint rather than an optional hint.
 *
 * # Contract
 *
 * - Every field is optional. An empty/undefined targeting object produces
 *   `undefined` (no directive block), preserving legacy behaviour exactly.
 * - The shape is a structural mirror of `@platform/ingest`'s `Targeting`
 *   (intentionally NOT imported, to avoid a workspace dependency from
 *   `ai-engine` → `ingest`). If the canonical schema gains a field, mirror it
 *   here and add its mapping.
 *
 * See PLATFORM.md §26.5 (ADR-S3-2).
 */

/** Structural mirror of `@platform/ingest` `Targeting`. All optional. */
export interface AudienceTargeting {
  gender?: "female" | "male" | "any" | (string & {});
  /** ISO 3166-1 alpha-2 (uppercase), e.g. "SA", "AE". */
  market?: string;
  primaryLanguage?: "ar" | "en" | "mixed" | (string & {});
  ageMin?: number;
  ageMax?: number;
  awarenessLevel?:
    | "unaware"
    | "problem-aware"
    | "solution-aware"
    | "product-aware"
    | "most-aware"
    | (string & {});
  sophisticationLevel?:
    | "beginner"
    | "intermediate"
    | "advanced"
    | "expert"
    | (string & {});
  emotionalAngle?:
    | "fear"
    | "desire"
    | "curiosity"
    | "belonging"
    | "status"
    | "transformation"
    | (string & {});
  toneStyle?:
    | "clinical"
    | "luxurious"
    | "playful"
    | "authoritative"
    | "intimate"
    | "energetic"
    | (string & {});
}

const GENDER_ADDRESS: Record<string, string> = {
  female: "Address a woman directly (feminine grammatical forms in Arabic).",
  male: "Address a man directly (masculine grammatical forms in Arabic).",
  any: "Use gender-neutral address; avoid gendered grammatical assumptions.",
};

/** GCC-aware market labels. Falls back to the raw ISO code for the long tail. */
const MARKET_LABELS: Record<string, string> = {
  SA: "Saudi Arabia (KSA) — the core GCC market; Khaleeji cultural cues",
  AE: "United Arab Emirates — cosmopolitan GCC, high purchasing power",
  KW: "Kuwait — affluent Khaleeji market",
  QA: "Qatar — affluent Khaleeji market",
  BH: "Bahrain — Khaleeji market",
  OM: "Oman — Khaleeji market",
  IQ: "Iraq — Levantine/Mesopotamian Arabic context",
  MA: "Morocco — Maghrebi context (avoid heavy Khaleeji idioms)",
  US: "United States — Western, English-first context",
};

const PRIMARY_LANGUAGE_DIRECTIVE: Record<string, string> = {
  ar: "Arabic is the primary selling language; lead with the Arabic copy and make it the strongest, most native version. English is a faithful mirror.",
  en: "English is the primary selling language; lead with the English copy. Arabic remains clean and native, not a literal translation.",
  mixed: "The audience is comfortably bilingual; both locales must read as natively written and equally persuasive.",
};

/**
 * Eugene Schwartz awareness model — the single most important copy lever.
 * Each level dictates where the message must START.
 */
const AWARENESS_PLAYBOOK: Record<string, string> = {
  unaware:
    "Awareness: UNAWARE. The reader does not yet know they have the problem. OPEN with a relatable situation/feeling, not the product. Educate on the problem first, then bridge to the solution. Do NOT lead with features or price.",
  "problem-aware":
    "Awareness: PROBLEM-AWARE. The reader feels the problem but doesn't know solutions exist. Agitate the pain with empathy, then introduce this category of solution and why it works.",
  "solution-aware":
    "Awareness: SOLUTION-AWARE. The reader knows solutions exist but not this product. Differentiate hard: why THIS product beats the alternatives they're considering.",
  "product-aware":
    "Awareness: PRODUCT-AWARE. The reader knows this product. Lead with proof, specifics, and the offer; reduce risk and overcome the final objections.",
  "most-aware":
    "Awareness: MOST-AWARE. The reader is ready to buy. Lead with the offer, urgency, and a frictionless call to action. Keep persuasion tight.",
};

const SOPHISTICATION_DIRECTIVE: Record<string, string> = {
  beginner:
    "Market sophistication: LOW. The category is fresh to them — a simple, direct claim is enough. Explain mechanism plainly; avoid jargon.",
  intermediate:
    "Market sophistication: MEDIUM. They've seen basic claims — amplify with a sharper, more specific promise and a credible mechanism.",
  advanced:
    "Market sophistication: HIGH. They've heard the big claims and are skeptical — lead with a unique mechanism and concrete differentiation, not louder claims.",
  expert:
    "Market sophistication: VERY HIGH. They're jaded experts — win with identity, nuance, proof, and a distinctive point of view; avoid hype entirely.",
};

const EMOTIONAL_ANGLE_DIRECTIVE: Record<string, string> = {
  fear: "Lead emotional lever: FEAR / loss-aversion. Frame the cost of inaction and the relief the product provides (stay within the brand's legal guardrails — no medical scare claims).",
  desire: "Lead emotional lever: DESIRE / aspiration. Paint the vivid, sensory after-state of owning and using the product.",
  curiosity: "Lead emotional lever: CURIOSITY. Open an intrigue/knowledge gap the reader must close by reading on.",
  belonging: "Lead emotional lever: BELONGING. Position the product as the choice of a community/tribe the reader wants to be part of.",
  status: "Lead emotional lever: STATUS. Position the product as a marker of taste, success, and refinement.",
  transformation: "Lead emotional lever: TRANSFORMATION. Tell a before→after identity-shift story; the product is the catalyst.",
};

const TONE_STYLE_DIRECTIVE: Record<string, string> = {
  clinical: "Tone: CLINICAL. Precise, evidence-led, calm authority. Minimal adjectives.",
  luxurious: "Tone: LUXURIOUS. Elevated, sensory, unhurried; refinement over hype.",
  playful: "Tone: PLAYFUL. Warm, witty, light; conversational rhythm.",
  authoritative: "Tone: AUTHORITATIVE. Confident, expert, declarative.",
  intimate: "Tone: INTIMATE. Personal, one-to-one, like a trusted friend's recommendation.",
  energetic: "Tone: ENERGETIC. High momentum, punchy, action-forward.",
};

function ageBand(min?: number, max?: number): string | undefined {
  if (min === undefined && max === undefined) return undefined;
  if (min !== undefined && max !== undefined)
    return `Primary age range: ${min}–${max}. Calibrate cultural references and pace to this cohort.`;
  if (min !== undefined) return `Primary age range: ${min}+.`;
  return `Primary age range: up to ${max}.`;
}

function describeMarket(code?: string): string | undefined {
  if (!code) return undefined;
  const key = code.toUpperCase();
  const label = MARKET_LABELS[key] ?? key;
  return `Target market: ${label}. Make cultural references, examples, and social proof feel native to this market.`;
}

/**
 * Build the audience directive block. Returns `undefined` when no targeting
 * signal is present (legacy / empty intake) so callers can omit the block
 * entirely.
 */
export function buildAudienceDirective(
  targeting?: AudienceTargeting,
): string | undefined {
  if (!targeting) return undefined;

  const lines: string[] = [];

  const market = describeMarket(targeting.market);
  if (market) lines.push(`- ${market}`);

  if (targeting.gender) {
    const g = GENDER_ADDRESS[targeting.gender] ?? `Audience gender: ${targeting.gender}.`;
    lines.push(`- ${g}`);
  }

  const age = ageBand(targeting.ageMin, targeting.ageMax);
  if (age) lines.push(`- ${age}`);

  if (targeting.primaryLanguage) {
    const l =
      PRIMARY_LANGUAGE_DIRECTIVE[targeting.primaryLanguage] ??
      `Primary language: ${targeting.primaryLanguage}.`;
    lines.push(`- ${l}`);
  }

  if (targeting.awarenessLevel) {
    const a = AWARENESS_PLAYBOOK[targeting.awarenessLevel];
    if (a) lines.push(`- ${a}`);
  }

  if (targeting.sophisticationLevel) {
    const s = SOPHISTICATION_DIRECTIVE[targeting.sophisticationLevel];
    if (s) lines.push(`- ${s}`);
  }

  if (targeting.emotionalAngle) {
    const e = EMOTIONAL_ANGLE_DIRECTIVE[targeting.emotionalAngle];
    if (e) lines.push(`- ${e}`);
  }

  if (targeting.toneStyle) {
    const t = TONE_STYLE_DIRECTIVE[targeting.toneStyle];
    if (t) lines.push(`- ${t}`);
  }

  if (lines.length === 0) return undefined;

  return [
    "AUDIENCE & POSITIONING DIRECTIVE (operator-selected — treat as hard constraints)",
    "--------------------------------------------------------------------------------",
    ...lines,
    "Every line above is a binding instruction. The copy, structure, and imagery",
    "MUST reflect these choices. When a directive conflicts with a generic default,",
    "the directive wins.",
  ].join("\n");
}

/**
 * Compact one-line summary of the targeting — handy for image-prompt grounding
 * and logs. Returns `undefined` when empty.
 */
export function summariseAudience(
  targeting?: AudienceTargeting,
): string | undefined {
  if (!targeting) return undefined;
  const parts: string[] = [];
  if (targeting.gender && targeting.gender !== "any")
    parts.push(targeting.gender);
  if (targeting.ageMin || targeting.ageMax)
    parts.push(`age ${targeting.ageMin ?? "?"}-${targeting.ageMax ?? "?"}`);
  if (targeting.market) parts.push(targeting.market.toUpperCase());
  if (targeting.toneStyle) parts.push(`${targeting.toneStyle} tone`);
  return parts.length > 0 ? parts.join(", ") : undefined;
}
