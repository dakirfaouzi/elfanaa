import { z } from "zod";
import type { VisionProvider } from "../providers/contracts";

/**
 * Image QA — Phase 4.6.4d (PLATFORM.md §26.4.11.9).
 *
 * A vision-backed gate that inspects each GENERATED image and decides whether to
 * accept it, regenerate it (with corrective feedback), or drop it. This is the
 * deterministic enforcement layer that prompt/negative pressure (4.6.4b) could
 * only *reduce* but never *guarantee*: correct asset TYPE per section, believable
 * product scale + placement, realistic anatomy, and — as a final net — no black
 * frames or wrong/absent product.
 *
 * Design rules:
 *   • FAIL-OPEN. QA must NEVER break a run. If the vision call errors or returns
 *     nothing parseable, we treat the image as a PASS (the upstream fal
 *     safety-filter guard + prompt constraints remain the floor).
 *   • SEVERITY-gated. HARD failures (black/blank, product absent, wrong product)
 *     must never be published; SOFT failures (off-type, scale/placement/anatomy)
 *     are regenerated when budget allows but tolerated over an empty section.
 *   • BUDGET-bounded. One vision assessment per image + a small regen cap keeps
 *     QA inside the §17 cost ceiling.
 */

/** Raw per-criterion booleans the vision model returns. */
export const ImageQaResponseSchema = z.object({
  /** The image is entirely/!mostly black or blank (a failed/filtered render). */
  blackOrBlank: z.boolean(),
  /** The product is clearly visible and recognisable in the frame. */
  productVisible: z.boolean(),
  /**
   * The product matches the reference product (identity preserved). Only
   * meaningful when a reference image was supplied; omitted otherwise.
   */
  productMatchesReference: z.boolean().optional(),
  /** The composition matches what its section needs (see the intent contract). */
  assetTypeCorrect: z.boolean(),
  /** The product is at a believable real-world scale (not oversized/giant). */
  productScaleRealistic: z.boolean(),
  /** No floating product, no product intersecting/merging with the face/body. */
  placementRealistic: z.boolean(),
  /** Hands/fingers/faces look real (no obvious-AI anatomy artefacts). */
  anatomyRealistic: z.boolean(),
  /** ≤1 short sentence telling the generator what to fix on a retry. */
  feedback: z.string().max(300).optional(),
});
export type ImageQaResponse = z.infer<typeof ImageQaResponseSchema>;

export type QaSeverity = "none" | "soft" | "hard";

export interface ImageQaVerdict {
  verdict: "pass" | "regenerate";
  severity: QaSeverity;
  /** Corrective guidance to append to the regeneration prompt. */
  feedback?: string;
  costUsd: number;
}

/**
 * Map the per-criterion booleans to a verdict + severity.
 *
 * HARD (never publish): black/blank, product absent, or — when a reference was
 * supplied — the product doesn't match (wrong/substituted product).
 * SOFT (regenerate if budget, else tolerate): off-type, unrealistic scale,
 * unrealistic placement, or anatomy artefacts.
 */
export function classifyQa(
  r: ImageQaResponse,
  hasReference: boolean,
): { verdict: "pass" | "regenerate"; severity: QaSeverity } {
  const hard =
    r.blackOrBlank ||
    !r.productVisible ||
    (hasReference && r.productMatchesReference === false);
  if (hard) return { verdict: "regenerate", severity: "hard" };

  const soft =
    !r.assetTypeCorrect ||
    !r.productScaleRealistic ||
    !r.placementRealistic ||
    !r.anatomyRealistic;
  if (soft) return { verdict: "regenerate", severity: "soft" };

  return { verdict: "pass", severity: "none" };
}

/** Per-intent description of what the asset MUST depict (the QA contract). */
function assetTypeExpectation(intent?: string, role?: "hero" | "lifestyle"): string {
  const i = intent ?? "";
  if (role === "hero") {
    return "a premium, luxury ad-campaign hero: the exact product as the clear hero, art-directed (editorial lighting, aspirational set), optionally with an audience-matched person — NOT a casual snapshot.";
  }
  if (/ingredient|detail|texture|swatch|macro/i.test(i)) {
    return "an INGREDIENT MACRO still-life: the product with its texture / raw ingredient (oil, cream, botanical, powder). There must be NO model/face/portrait.";
  }
  if (/mechanism|apply|applicat|step|usage|how/i.test(i)) {
    return "an APPLICATION close-up: a hand applying/dispensing the product onto the relevant target area, cropped tight — NOT a full-body posed portrait.";
  }
  if (/result|outcome|after|transform/i.test(i)) {
    return "an OUTCOME shot: the visibly improved target area / result is the focus, with the product SECONDARY — NOT a model posing while holding the product.";
  }
  if (/benefit|problem|solution|concern|relief/i.test(i)) {
    return "a PROBLEM→SOLUTION shot focused on the target body area being improved, product supportive — NOT a generic lifestyle portrait.";
  }
  if (/proof|testimonial|portrait|customer|review/i.test(i)) {
    return "a TESTIMONIAL PORTRAIT: a confident, audience-matched customer holding/using the product, direct eye contact.";
  }
  if (/context|lifestyle|home/i.test(i)) {
    return "a LIFESTYLE scene: the product in an aspirational home setting with a person.";
  }
  return "a premium commercial advertising photograph in which the product is clearly visible and on-brand.";
}

/** Build the QA instructions for the vision provider. */
export function buildImageQaInstructions(opts: {
  intent?: string;
  role: "hero" | "lifestyle";
  hasReference: boolean;
}): string {
  const lines: string[] = [
    "You are a strict commercial-advertising QA reviewer for a premium GCC e-commerce store.",
    opts.hasReference
      ? "IMAGE 1 is a GENERATED marketing image. IMAGE 2 is the REAL product (the single source of truth). Judge IMAGE 1."
      : "Judge the GENERATED marketing image.",
    "",
    `This image is meant to be ${assetTypeExpectation(opts.intent, opts.role)}`,
    "",
    "Return STRICT JSON with these booleans (true = good):",
    "  blackOrBlank — true ONLY if the image is mostly black/blank/corrupt.",
    "  productVisible — the product is clearly present and recognisable.",
    ...(opts.hasReference
      ? ["  productMatchesReference — the product in IMAGE 1 is the SAME product as IMAGE 2 (shape, label, colours); false if redesigned/substituted."]
      : []),
    "  assetTypeCorrect — the composition matches the intended asset described above.",
    "  productScaleRealistic — the product is a believable real-world size (NOT oversized/giant).",
    "  placementRealistic — the product is NOT floating and does NOT intersect/merge with a face/body; it has real contact with a surface or hand.",
    "  anatomyRealistic — any hands/fingers/faces look real (no extra/fused fingers, no waxy/uncanny faces).",
    "  feedback — one short sentence on the single most important thing to fix (empty if all good).",
    "Be honest and strict: a model holding the product when an ingredient macro / outcome / application was required is assetTypeCorrect=false.",
  ];
  return lines.join("\n");
}

/**
 * Assess one generated image. Never throws — on any error/empty parse it returns
 * a PASS verdict so QA can never block or fail a run.
 */
export async function assessImage(opts: {
  provider: VisionProvider;
  imageUrl: string;
  referenceUrl?: string;
  intent?: string;
  role: "hero" | "lifestyle";
  storeId: string;
  runId: string;
}): Promise<ImageQaVerdict> {
  const hasReference = Boolean(opts.referenceUrl);
  const images = hasReference
    ? [{ src: opts.imageUrl }, { src: opts.referenceUrl as string }]
    : [{ src: opts.imageUrl }];

  try {
    const res = await opts.provider.analyze({
      images,
      instructions: buildImageQaInstructions({
        intent: opts.intent,
        role: opts.role,
        hasReference,
      }),
      schema: ImageQaResponseSchema,
      temperature: 0,
      storeId: opts.storeId,
      runId: opts.runId,
    });

    if (!res.parsed) {
      return { verdict: "pass", severity: "none", costUsd: res.costUsd };
    }
    const { verdict, severity } = classifyQa(res.parsed, hasReference);
    return { verdict, severity, feedback: res.parsed.feedback, costUsd: res.costUsd };
  } catch {
    // Fail-open: QA infrastructure must never break image generation.
    return { verdict: "pass", severity: "none", costUsd: 0 };
  }
}
