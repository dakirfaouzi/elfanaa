import { z } from "zod";
import {
  UniversalProductSchema,
  FanaaProductExtensionSchema,
  BeautyWellnessExtensionSchema,
} from "@platform/catalog-schema/schemas";
import type {
  UniversalProduct,
  FanaaProductExtension,
  BeautyWellnessExtension,
  Locale,
} from "@platform/catalog-schema";
import type { ValidationIssue } from "./contracts";

/**
 * Validation primitives shared across publishers.
 *
 * All helpers are non-throwing: they collect errors into a
 * `ValidationIssue[]` so the caller can decide whether to:
 *   • short-circuit (Publisher.validate)
 *   • throw a typed PublisherError (Publisher.publish post-materialisation)
 *   • aggregate across the whole bundle (CLI dry-run)
 *
 * No helper here mutates inputs.
 */

/* ─── Schema-level validation ──────────────────────────────────────────── */

export function validateUniversalProductSchema(
  product: unknown,
): ValidationIssue[] {
  const result = UniversalProductSchema.safeParse(product);
  if (result.success) return [];
  return zodIssuesToValidation(result.error, "universal_schema_invalid");
}

export function validateFanaaExtensionSchema(
  extension: unknown,
): ValidationIssue[] {
  const result = FanaaProductExtensionSchema.safeParse(extension);
  if (result.success) return [];
  return zodIssuesToValidation(result.error, "fanaa_extension_invalid");
}

export function validateBeautyWellnessExtensionSchema(
  extension: unknown,
): ValidationIssue[] {
  const result = BeautyWellnessExtensionSchema.safeParse(extension);
  if (result.success) return [];
  return zodIssuesToValidation(
    result.error,
    "beauty_wellness_extension_invalid",
  );
}

/* ─── Locale + content coverage ────────────────────────────────────────── */

/**
 * Walks the UniversalProduct's LocalizedString fields and reports any
 * missing locale strings (empty `ar` or `en`).
 *
 * The UniversalProductSchema already requires both locales to be
 * present as keys, but allows empty strings. This helper catches the
 * "model returned `{ ar: \"some text\", en: \"\" }`" failure mode that
 * the schema can't see.
 */
export function validateLocaleCoverage(
  product: UniversalProduct,
  required: Locale[] = ["ar", "en"],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const check = (
    path: string,
    value: { ar?: string; en?: string } | undefined,
  ) => {
    if (!value) return;
    for (const loc of required) {
      if (!value[loc] || value[loc]?.trim() === "") {
        issues.push({
          code: "input_locale_missing",
          message: `Locale "${loc}" is empty at ${path}.`,
          path,
        });
      }
    }
  };

  check("title", product.title);
  check("description", product.description);
  if (product.headline) check("headline", product.headline);
  if (product.subheadline) check("subheadline", product.subheadline);

  product.benefits.forEach((b, i) => {
    check(`benefits[${i}].title`, b.title);
    check(`benefits[${i}].body`, b.body);
  });

  product.faq.forEach((f, i) => {
    check(`faq[${i}].q`, f.q);
    check(`faq[${i}].a`, f.a);
  });

  product.reviews.forEach((r, i) => {
    check(`reviews[${i}].name`, r.name);
    check(`reviews[${i}].body`, r.body);
  });

  product.hooks.forEach((h, i) => {
    check(`hooks[${i}].body`, h.body);
    check(`hooks[${i}].cta`, h.cta);
  });

  if (product.ingredients) {
    product.ingredients.forEach((ing, i) => {
      check(`ingredients[${i}].name`, ing.name);
      check(`ingredients[${i}].role`, ing.role);
    });
  }

  return issues;
}

/* ─── Image expectations ───────────────────────────────────────────────── */

/**
 * Verifies the hero image exists and every image has both an `alt.ar`
 * and `alt.en`. The schema requires `images: min(1)`; this catches
 * accessibility-blocking missing alt text.
 */
export function validateImages(
  product: UniversalProduct,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (product.images.length === 0) {
    issues.push({
      code: "input_image_missing",
      message: "Product must have at least one (hero) image.",
      path: "images",
    });
    return issues;
  }
  product.images.forEach((img, i) => {
    if (!img.src || img.src.trim() === "") {
      issues.push({
        code: "input_image_missing",
        message: `images[${i}].src is empty.`,
        path: `images[${i}].src`,
      });
    }
    if (!img.alt?.ar || !img.alt?.en) {
      issues.push({
        code: "input_locale_missing",
        message: `images[${i}].alt is missing one locale.`,
        path: `images[${i}].alt`,
      });
    }
  });
  return issues;
}

/* ─── Store-config consistency ─────────────────────────────────────────── */

/**
 * Checks that the UniversalProduct's `storeContext` matches the
 * StoreConfig being published to, and that the niche is consistent.
 *
 * # Why
 *
 * The same UniversalProduct may be republished to multiple stores later
 * (multi-store proof, M11), so `storeContext` is informational rather
 * than a hard lock — but publishing a `niche: "fashion"` product into a
 * `niche: "beauty_wellness"` store is almost always a configuration
 * mistake, so we emit a warning.
 */
export function validateStoreConsistency(
  product: UniversalProduct,
  storeId: string,
  storeNiche: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (product.storeContext !== storeId) {
    issues.push({
      code: "store_config_mismatch",
      message: `Product was generated for store "${product.storeContext}" but is being published to "${storeId}".`,
      path: "storeContext",
    });
  }
  if (product.niche !== storeNiche) {
    issues.push({
      code: "store_config_mismatch",
      message: `Product niche "${product.niche}" does not match store niche "${storeNiche}".`,
      path: "niche",
    });
  }
  return issues;
}

/* ─── Composite (used by FanaaPublisher.validate) ──────────────────────── */

/**
 * Aggregate validator that runs all of the above against a candidate
 * publish bundle. Returns errors + warnings separated.
 *
 * # Errors vs warnings
 *
 *   • Schema mismatches            → errors  (publish blocked)
 *   • Empty locale strings         → errors
 *   • Image missing src            → errors
 *   • storeContext ≠ storeId       → warning (intentional republish ok)
 *   • niche mismatch               → error   (taxonomy can't be derived)
 */
export function validateFullBundle(args: {
  product: UniversalProduct;
  storeId: string;
  storeNiche: string;
  fanaaExtension?: FanaaProductExtension;
  beautyWellnessExtension?: BeautyWellnessExtension;
}): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  errors.push(...validateUniversalProductSchema(args.product));
  if (errors.length === 0) {
    errors.push(...validateLocaleCoverage(args.product));
    errors.push(...validateImages(args.product));
  }

  const consistency = validateStoreConsistency(
    args.product,
    args.storeId,
    args.storeNiche,
  );
  for (const issue of consistency) {
    if (issue.path === "storeContext") warnings.push(issue);
    else errors.push(issue);
  }

  if (args.fanaaExtension) {
    errors.push(...validateFanaaExtensionSchema(args.fanaaExtension));
  }
  if (args.beautyWellnessExtension) {
    errors.push(
      ...validateBeautyWellnessExtensionSchema(args.beautyWellnessExtension),
    );
  }

  return { errors, warnings };
}

/* ─── Internal: Zod → ValidationIssue mapping ──────────────────────────── */

function zodIssuesToValidation(
  error: z.ZodError,
  code: string,
): ValidationIssue[] {
  return error.issues.map((issue) => ({
    code,
    message: issue.message,
    path: issue.path.length > 0 ? issue.path.join(".") : undefined,
  }));
}
