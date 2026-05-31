import type { StoreConfig } from "../contracts";
import { beautyWellnessNiche } from "../niches/beauty-wellness";

/**
 * Fanaa — the canonical reference StoreConfig.
 *
 * Mirror of the production storefront's brand DNA:
 *   • palette: warm cream × deep espresso × rose-gold (apps/fanaa/styles/tokens.css)
 *   • voice: luxury Khaleeji Arabic, GCC editorial register
 *   • niche: beauty & wellness
 *
 * # Why a second source of truth for the palette?
 *
 * The storefront's `tokens.css` is the runtime source for the rendered
 * site. This object is the source the Studio / pipeline / publisher
 * consume. They MUST stay in sync. Sync is enforced by:
 *
 *   1. M3: this file mirrors `tokens.css` verbatim — verified by eye.
 *   2. M11 (multi-store proof): a CI assertion compares this object's
 *      palette against the values in apps/fanaa/styles/tokens.css.
 *
 * Until then, treat any palette edit to `tokens.css` as a synchronised
 * edit to this file.
 *
 * # Why this isn't imported by apps/fanaa/
 *
 * The storefront still reads everything it needs from its own
 * `tokens.css`, `lib/i18n/dictionaries.ts`, `data/products.ts`. This
 * object exists for the **Studio** to know what kind of store Fanaa
 * is when generating drafts — never for the storefront to read its
 * own identity from. (PLATFORM.md §6.4.)
 */
export const fanaaStore: StoreConfig = {
  id: "fanaa",
  displayName: {
    ar: "فناء",
    en: "Fanaa",
  },

  status: "live",

  // ── Catalog character ──────────────────────────────────────────────────
  niche: "beauty_wellness",
  defaultLocale: "ar",
  supportedLocales: ["ar", "en"],
  currency: "SAR",
  market: "SA",

  // ── Branding ───────────────────────────────────────────────────────────
  brand: {
    name: { ar: "فناء", en: "Fanaa" },
    tagline: {
      ar: "جمال صادق. روتين راقٍ.",
      en: "Honest beauty. Refined ritual.",
    },
    // Hex mirrors of the RGB triplets in apps/fanaa/styles/tokens.css.
    // Keep these aligned with that file (see file-level comment above).
    palette: {
      bg: "#F4EFE6",
      surface: "#EAE1D2",
      ink: "#1F1815",
      accent: "#C7A27C",
      accentSoft: "#E0C6A5",
      success: "#5C7A58",
    },
    typography: {
      sans: "Inter, ui-sans-serif, system-ui, sans-serif",
      display: "ui-serif, Georgia, serif",
      arabic: "'IBM Plex Sans Arabic', 'Tajawal', system-ui, sans-serif",
      arabicDisplay: "'Cairo', 'IBM Plex Sans Arabic', serif",
    },
    voice: {
      register: "luxury",
      dialect: "Khaleeji",
      forbidden_words: [
        // Avoid medical / pharmaceutical claims; Fanaa is cosmetic.
        "علاج",
        "شفاء",
        "يعالج",
        "treats",
        "cures",
        "heals",
        // Avoid superlative absolutes that don't survive ad review.
        "guaranteed",
        "best ever",
        "miracle",
        "معجزة",
      ],
      house_style_notes: [
        "Lead with the feeling, not the chemistry — name the benefit before the active.",
        "Speak to the customer as a confidante, never as a clinician.",
        "Prefer concrete sensory verbs (يلمع، يهدأ، يلين) over generic ('amazing').",
        "Always pair a benefit with a small evidence cue (ingredient, ritual, time-frame).",
        "Khaleeji familiarity in tone but MSA-clean in spelling — no slang spellings.",
      ].join(" "),
    },
  },

  nicheProfile: beautyWellnessNiche,

  // ── Templates ──────────────────────────────────────────────────────────
  templates: {
    defaultPdp: "fanaa.generic_pdp",
    sectionLibrary: [
      "hero",
      "benefits",
      "how_it_works",
      "ingredients",
      "lifestyle",
      "results_expectation",
      "social_proof",
      "comparison",
      "faq",
      "guarantee",
      "cross_sell",
      "creative_strip",
      "founders_note",
      "sticky_cta",
    ],
    orderings: {
      // Mirrors today's generic PDP rhythm at app/products/[slug]/page.tsx.
      "fanaa.generic_pdp": [
        "hero",
        "benefits",
        "ingredients",
        "lifestyle",
        "social_proof",
        "results_expectation",
        "faq",
        "guarantee",
        "cross_sell",
        "sticky_cta",
      ],
      // Bespoke CRO landing rhythm — matches /sugarbear today.
      "fanaa.bespoke_landing": [
        "hero",
        "benefits",
        "creative_strip",
        "ingredients",
        "social_proof",
        "lifestyle",
        "results_expectation",
        "founders_note",
        "faq",
        "guarantee",
        "cross_sell",
        "sticky_cta",
      ],
    },
  },

  // ── Publisher binding ──────────────────────────────────────────────────
  publisher: "fanaa",

  // ── Storage ────────────────────────────────────────────────────────────
  // Provisioned in the existing Cloudflare organisation (per platform
  // decision logged in M1). Bucket creation is M5 work — declaring it
  // here is metadata only.
  r2Bucket: "fanaa-assets",
  r2PublicBaseUrl: "https://cdn.elfanaa.com",

  // ── Routing ────────────────────────────────────────────────────────────
  domains: ["elfanaa.com", "www.elfanaa.com"],
  appWorkspace: "apps/fanaa",

  // ── Operational ────────────────────────────────────────────────────────
  costCeilingPerDraftUsd: 5,

  // Provider allowlist intentionally omitted — Fanaa inherits whichever
  // platform defaults @platform/ai-engine settles on in M4.
};
