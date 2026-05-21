import type {
  LocalizedString,
  Locale,
  NicheId,
  PublisherId,
  StoreId,
  StoreStatus,
  SectionKind,
  ProductExtensionKind,
} from "@platform/catalog-schema";

/**
 * Store-configuration contracts (PLATFORM.md §8).
 *
 * Everything in this file is a TYPE. Concrete StoreConfig instances live
 * in `../stores/<store>.ts`. NicheProfile instances live in
 * `../niches/<niche>.ts`. The registry (`../registry.ts`) wires the two
 * together with a pure-function lookup.
 *
 * The Studio NEVER hardcodes a store. Every pipeline stage, every
 * publisher, every UI surface that needs to know "what kind of store
 * am I generating for?" reads a `StoreConfig` and adapts accordingly.
 *
 * # M3 disclaimer
 *
 * Nothing in `apps/fanaa/`, `apps/studio/`, or `services/api/` consumes
 * these contracts yet. They are types-and-data only, ready to be used
 * by the M4 provider registry, M5 pipeline stages, and M7 FanaaPublisher.
 */

// ─────────────────────────────────────────────────────────────────────────
// Brand
// ─────────────────────────────────────────────────────────────────────────

/**
 * Visual + tonal brand attributes. Drives:
 *   • Studio UI accents per store (Studio uses the store's palette when
 *     previewing drafts)
 *   • Prompt context (the copy stage receives `voice` directly)
 *   • Image-generation prompts (palette hints to fal.ai)
 *
 * `palette` values are CSS hex strings (`"#1F1815"`). The storefront
 * already exposes its palette as RGB triplets in `styles/tokens.css`;
 * the publisher mapping converts between formats — the contract here
 * stays publisher-agnostic.
 */
export interface BrandProfile {
  name: LocalizedString;
  tagline: LocalizedString;
  palette: {
    bg: string;
    surface: string;
    ink: string;
    accent: string;
    accentSoft: string;
    success: string;
  };
  typography: {
    sans: string;
    display: string;
    arabic: string;
    arabicDisplay: string;
  };
  voice: {
    register:
      | "luxury"
      | "playful"
      | "clinical"
      | "youthful"
      | "premium-utility";
    dialect: "MSA" | "Saudi" | "Khaleeji" | "Egyptian" | "Levantine";
    /** Words the copy stage MUST avoid. Drives a guardrail prompt fragment. */
    forbidden_words: string[];
    /** Free-text "always do / never do" — appended to the system prompt. */
    house_style_notes: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Niche
// ─────────────────────────────────────────────────────────────────────────

/**
 * Realistic expectation timeline. The "Results / Expectations" PDP
 * section uses this to set honest customer expectations for the niche
 * (beauty/wellness: "first effects 1–2 weeks, full results 4–8 weeks";
 * electronics: "out of the box, no warm-up").
 *
 * Strings are bilingual but kept short — they render as labelled
 * timeline rungs.
 */
export interface ExpectationsModel {
  immediate?: LocalizedString;
  shortTerm?: LocalizedString;
  fullResults?: LocalizedString;
  /** Compliance disclaimers ("results may vary", regulatory text). */
  disclaimers?: LocalizedString[];
}

/**
 * Niche-level tuning (PLATFORM.md §8). One instance per niche, shared
 * across all stores in that niche. Stores override only what's truly
 * store-specific in their own `StoreConfig.brand`/`templates`.
 */
export interface NicheProfile {
  id: NicheId;
  /** Section taxonomy this niche supports. */
  sections: SectionKind[];
  /** Niche-specific UniversalProduct extensions this niche populates. */
  productExtensions: ProductExtensionKind[];
  /** Claims/legal guardrails — appended to the system prompt. */
  legalGuardrails: string;
  /** Realistic results-window — drives the "Results" PDP section. */
  expectationsModel: ExpectationsModel;
  /** Default ad-hook angles for this niche. */
  defaultAngles: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────

/**
 * Per-store template catalogue. A "template" is a named layout (e.g.
 * "fanaa.generic_pdp" = generic PDP route, "fanaa.bespoke_landing"
 * = CRO landing). The section-structure pipeline stage picks an
 * ordering from `orderings` based on the chosen template.
 */
export interface StoreTemplates {
  /** Default template ID for new drafts in this store. */
  defaultPdp: string;
  /** Which sections may appear in any template for this store. */
  sectionLibrary: SectionKind[];
  /** Section ordering per template ID. */
  orderings: Record<string, SectionKind[]>;
}

// ─────────────────────────────────────────────────────────────────────────
// Provider allowlist
// ─────────────────────────────────────────────────────────────────────────

/**
 * Per-store override of which AI providers are approved.
 *
 * Concrete provider IDs ("anthropic.claude-3-5-sonnet", "fal.flux-1.1-pro")
 * live in `@platform/ai-engine` (M4). The contract here keeps the surface
 * loose — string-typed model IDs so the StoreConfig doesn't need to
 * import from ai-engine.
 *
 * `undefined` capability = inherit the platform default.
 * Empty array     = block this capability for this store entirely.
 */
export interface ProviderAllowlist {
  /** Approved text-generation provider/model combos. */
  text?: string[];
  /** Approved image-generation provider/model combos. */
  image?: string[];
  /** Approved vision provider/model combos. */
  vision?: string[];
  /** Approved scrape provider IDs ("firecrawl", "browserless"). */
  scrape?: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────

/**
 * Single canonical description of a store. The Studio reads this. The
 * pipeline reads this. The publisher reads this. The storefront reads
 * NOTHING from here at runtime — it only ingests its own published
 * `data/products.ts`.
 *
 * Required fields cover everything the pipeline needs to run end-to-end.
 * Optional fields override platform defaults where the store needs
 * special-casing.
 */
export interface StoreConfig {
  id: StoreId;
  displayName: LocalizedString;

  status: StoreStatus;

  // Catalog character
  niche: NicheId;
  defaultLocale: Locale;
  supportedLocales: Locale[];
  currency: string;
  market: string;

  // Branding + tone
  brand: BrandProfile;
  nicheProfile: NicheProfile;

  // Generation templates available for this store
  templates: StoreTemplates;

  // Publisher binding
  publisher: PublisherId;

  // Storage scope
  r2Bucket: string;
  r2PublicBaseUrl: string;

  // Routing
  domains: string[];
  /** Workspace path inside the monorepo (e.g. "apps/fanaa"). */
  appWorkspace: string;

  // Operational
  /** Soft cap on AI provider spend per draft. Workers refuse to dispatch
   *  the next stage when this is exceeded. Default 5 USD. */
  costCeilingPerDraftUsd: number;

  /** Optional per-store provider override. Inherits platform defaults
   *  when unset. */
  approvedProviders?: ProviderAllowlist;
}
