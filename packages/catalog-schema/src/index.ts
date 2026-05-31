/**
 * @platform/catalog-schema — barrel.
 *
 * Public surface of the package. Schemas live under `./schemas` and are
 * deliberately NOT re-exported from this root so a consumer that wants
 * types only doesn't drag Zod into its bundle.
 *
 * Subpath imports also work and are encouraged for tree-shakable
 * consumption:
 *
 *   import type { UniversalProduct } from "@platform/catalog-schema";
 *   import { UniversalProductSchema } from "@platform/catalog-schema/schemas";
 *   import type { FanaaProductExtension } from "@platform/catalog-schema/extensions/fanaa";
 *   import type { BeautyWellnessExtension } from "@platform/catalog-schema/niches/beauty-wellness";
 */

// Core primitives
export type { Locale, LocalizedString, Money } from "./locales";
export type { StoreId, NicheId, PublisherId, StoreStatus } from "./ids";
export type { SectionKind, ProductExtensionKind } from "./sections";

// Product primitives
export type {
  ProductImage,
  ProductBenefit,
  ProductFeature,
  ProductIngredient,
  ProductSpec,
  ProductCert,
  ProductReview,
  ProductFaq,
  AdHook,
} from "./primitives";

// Canonical shape
export type { UniversalProduct } from "./universal";

// Rich section content (Step 4)
export type {
  SectionContent,
  HowItWorksContent,
  MechanismStep,
  ResultsContent,
  ResultMilestone,
  GuaranteeContent,
  ComparisonContent,
  ObjectionsContent,
  ObjectionItem,
} from "./section-content";

// Niche extensions
export type {
  BeautyWellnessExtension,
  SkinType,
  SkinConcern,
  RoutineStep,
} from "./niches";

// Publisher / store extensions
export type {
  FanaaProductExtension,
  FanaaOfferTier,
  FanaaProductType,
  FanaaProductTarget,
  FanaaProductProblem,
} from "./extensions";
