import { z } from "zod";
import { LocalizedStringSchema } from "@platform/catalog-schema/schemas";
import type {
  BrandProfile,
  ExpectationsModel,
  NicheProfile,
  ProviderAllowlist,
  StoreConfig,
  StoreTemplates,
} from "../contracts";

/**
 * Runtime validators for the store-config contracts (../contracts.ts).
 *
 * Annotated with `z.ZodType<TheType>` so drift between hand-written
 * contracts and runtime validators surfaces at compile time. M3 ships
 * the validators dormant — M4 provider registry, M7 FanaaPublisher,
 * and the M8 Studio store-switcher each invoke them at the relevant
 * boundary.
 */

// ── Brand ────────────────────────────────────────────────────────────────

export const BrandProfileSchema: z.ZodType<BrandProfile> = z.object({
  name: LocalizedStringSchema,
  tagline: LocalizedStringSchema,
  palette: z.object({
    bg: z.string().min(1),
    surface: z.string().min(1),
    ink: z.string().min(1),
    accent: z.string().min(1),
    accentSoft: z.string().min(1),
    success: z.string().min(1),
  }),
  typography: z.object({
    sans: z.string().min(1),
    display: z.string().min(1),
    arabic: z.string().min(1),
    arabicDisplay: z.string().min(1),
  }),
  voice: z.object({
    register: z.enum([
      "luxury",
      "playful",
      "clinical",
      "youthful",
      "premium-utility",
    ]),
    dialect: z.enum(["MSA", "Saudi", "Khaleeji", "Egyptian", "Levantine"]),
    forbidden_words: z.array(z.string()),
    house_style_notes: z.string(),
  }),
});

// ── Niche ────────────────────────────────────────────────────────────────

export const ExpectationsModelSchema: z.ZodType<ExpectationsModel> = z.object({
  immediate: LocalizedStringSchema.optional(),
  shortTerm: LocalizedStringSchema.optional(),
  fullResults: LocalizedStringSchema.optional(),
  disclaimers: z.array(LocalizedStringSchema).optional(),
});

export const NicheProfileSchema: z.ZodType<NicheProfile> = z.object({
  id: z.string().min(1),
  sections: z.array(z.string().min(1)),
  productExtensions: z.array(z.string().min(1)),
  legalGuardrails: z.string(),
  expectationsModel: ExpectationsModelSchema,
  defaultAngles: z.array(z.string()),
});

// ── Templates ────────────────────────────────────────────────────────────

export const StoreTemplatesSchema: z.ZodType<StoreTemplates> = z.object({
  defaultPdp: z.string().min(1),
  sectionLibrary: z.array(z.string().min(1)),
  orderings: z.record(z.string(), z.array(z.string().min(1))),
});

// ── Provider allowlist ──────────────────────────────────────────────────

export const ProviderAllowlistSchema: z.ZodType<ProviderAllowlist> = z.object({
  text: z.array(z.string()).optional(),
  image: z.array(z.string()).optional(),
  vision: z.array(z.string()).optional(),
  scrape: z.array(z.string()).optional(),
});

// ── Store ────────────────────────────────────────────────────────────────

export const StoreConfigSchema: z.ZodType<StoreConfig> = z.object({
  id: z.string().min(1),
  displayName: LocalizedStringSchema,

  status: z.enum(["live", "incubating", "archived"]),

  niche: z.string().min(1),
  defaultLocale: z.enum(["ar", "en"]),
  supportedLocales: z.array(z.enum(["ar", "en"])).min(1),
  currency: z.string().length(3),
  market: z.string().min(2),

  brand: BrandProfileSchema,
  nicheProfile: NicheProfileSchema,

  templates: StoreTemplatesSchema,

  publisher: z.string().min(1),

  r2Bucket: z.string().min(1),
  r2PublicBaseUrl: z.string().url(),

  domains: z.array(z.string().min(1)).min(1),
  appWorkspace: z.string().min(1),

  costCeilingPerDraftUsd: z.number().positive(),

  approvedProviders: ProviderAllowlistSchema.optional(),
});
