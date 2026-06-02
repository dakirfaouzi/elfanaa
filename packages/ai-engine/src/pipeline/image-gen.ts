import type { ImageProvider } from "../providers/contracts";
import { ImageGenOutputSchema } from "../schemas/image-gen";
import type { StageContext } from "./types";
import type {
  AspectRatio,
  CreativePrompt,
} from "./types-creative-prompts";
import {
  DEFAULT_IMG2IMG_MODEL,
  type ImageGenFailure,
  type ImageGenInput,
  type ImageGenOutput,
  type ImageGenResult,
} from "./types-image-gen";

/**
 * Stage 08 — Image generation (PLATFORM.md §11).
 *
 * Failure mode: "Per-prompt 3× retry + provider fallback; partial
 * success accepted." Provider fallback itself lives in the M4
 * registry / M6 worker — this stage retries the same provider 3×
 * and tolerates per-prompt failure.
 *
 * Parallelism: prompts are run in parallel via `Promise.all`. With a
 * typical 1 hero + 2–4 lifestyle prompts the wall-time is roughly equal
 * to the slowest single image (20–60s per PLATFORM.md latency table).
 */
export async function imageGen(
  opts: {
    input: ImageGenInput;
    providers: { image: ImageProvider };
  } & StageContext,
): Promise<ImageGenOutput> {
  const maxAttempts = opts.input.maxAttemptsPerPrompt ?? 3;

  // Step 3 (ADR-S3-3): when a servable reference photo is supplied, generate
  // the hero image-to-image (Kontext) so it preserves the real product's
  // identity, with a hard fallback to text-to-image so a Kontext failure can
  // never regress hero quality below today's working baseline.
  const referenceUrl = resolveServableReference(opts.input.referenceImage?.src);
  const heroJob = referenceUrl
    ? runHeroWithIdentity({
        creative: opts.input.prompts.hero,
        referenceUrl,
        img2imgModel: opts.input.img2imgModel ?? DEFAULT_IMG2IMG_MODEL,
        provider: opts.providers.image,
        maxAttempts,
        storeId: opts.storeConfig.id,
        runId: opts.runId,
      })
    : runOnePrompt({
        role: "hero",
        creative: opts.input.prompts.hero,
        provider: opts.providers.image,
        maxAttempts,
        storeId: opts.storeConfig.id,
        runId: opts.runId,
      });

  // Step 4 Phase 4.6 — lifestyle/section scenes are ALSO grounded image-to-image
  // on the real product reference (when one is servable) so the EXACT product
  // appears in-scene with the cast human, not just in the hero. Each scene keeps
  // the same hard text-to-image fallback, so a Kontext failure never regresses a
  // scene below the legacy "product-described" baseline.
  const lifestyleJobs = opts.input.prompts.lifestyle.map((cp) =>
    referenceUrl
      ? runSceneWithIdentity({
          creative: cp,
          referenceUrl,
          img2imgModel: opts.input.img2imgModel ?? DEFAULT_IMG2IMG_MODEL,
          provider: opts.providers.image,
          maxAttempts,
          storeId: opts.storeConfig.id,
          runId: opts.runId,
        })
      : runOnePrompt({
          role: "lifestyle",
          creative: cp,
          provider: opts.providers.image,
          maxAttempts,
          storeId: opts.storeConfig.id,
          runId: opts.runId,
        }),
  );

  const outcomes = await Promise.all([heroJob, ...lifestyleJobs]);

  const results: ImageGenResult[] = [];
  const failed: ImageGenFailure[] = [];
  let totalCostUsd = 0;
  for (const outcome of outcomes) {
    if (outcome.ok) {
      results.push(outcome.result);
      totalCostUsd += outcome.result.costUsd;
    } else {
      failed.push(outcome.failure);
    }
  }

  const output: ImageGenOutput = {
    results,
    failed,
    totalCostUsd,
  };
  return ImageGenOutputSchema.parse(output);
}

type RunOutcome =
  | { ok: true; result: ImageGenResult }
  | { ok: false; failure: ImageGenFailure };

/**
 * Generate the hero image-to-image first (identity-preserving), falling back
 * to the standard text-to-image hero if the img2img path fails. The fallback
 * guarantees we never end up worse than the legacy behaviour.
 */
async function runHeroWithIdentity(opts: {
  creative: CreativePrompt;
  referenceUrl: string;
  img2imgModel: string;
  provider: ImageProvider;
  maxAttempts: number;
  storeId: string;
  runId: string;
}): Promise<RunOutcome> {
  const img2img = await runOnePrompt({
    role: "hero",
    creative: { ...opts.creative, prompt: buildIdentityPrompt(opts.creative.prompt) },
    provider: opts.provider,
    maxAttempts: opts.maxAttempts,
    storeId: opts.storeId,
    runId: opts.runId,
    model: opts.img2imgModel,
    referenceImages: [{ src: opts.referenceUrl }],
  });
  if (img2img.ok) return img2img;

  // NO PRODUCT SUBSTITUTION (Phase 4.6.1): when the identity-preserving edit
  // fails we DO NOT invent a hero text-to-image (that would substitute a
  // different product, violating "the uploaded product is the single source of
  // truth"). Instead we pass the operator's REAL product photo through as the
  // hero. It is identity-perfect (if not premium); the persist layer re-hosts
  // it durably like any generated image. Inventing a product is worse than a
  // plain real product shot.
  return referencePassthroughHero(opts.creative, opts.referenceUrl);
}

/**
 * Build a hero result that IS the operator's uploaded product photo (no
 * generation). Used as the identity-safe fallback when img2img fails — never
 * substitute a different product. Nominal dimensions come from the requested
 * aspect ratio; the persist/re-host layer treats the URL like any other image.
 */
function referencePassthroughHero(
  creative: CreativePrompt,
  referenceUrl: string,
): RunOutcome {
  const { w, h } = aspectToPx(creative.aspectRatio);
  return {
    ok: true,
    result: {
      role: "hero",
      intent: creative.intent,
      prompt: "[identity-safe fallback] operator's uploaded product photo",
      url: referenceUrl,
      width: w,
      height: h,
      costUsd: 0,
      model: "reference_passthrough",
      providerId: "reference_passthrough",
      attempts: 1,
    },
  };
}

/**
 * Generate a lifestyle/section scene image-to-image (identity-preserving),
 * falling back to text-to-image on failure. Mirrors {@link runHeroWithIdentity}
 * but uses the scene identity wrapper so the EXACT product is composited into a
 * human + context scene (Phase 4.6). The fallback guarantees a scene is never
 * worse than the legacy text-to-image path.
 */
async function runSceneWithIdentity(opts: {
  creative: CreativePrompt;
  referenceUrl: string;
  img2imgModel: string;
  provider: ImageProvider;
  maxAttempts: number;
  storeId: string;
  runId: string;
}): Promise<RunOutcome> {
  const img2img = await runOnePrompt({
    role: "lifestyle",
    creative: {
      ...opts.creative,
      prompt: buildSceneIdentityPrompt(opts.creative.prompt, opts.creative.intent),
      negative: mergeNegative(
        opts.creative.negative,
        assetNegativeFor(opts.creative.intent),
      ),
    },
    provider: opts.provider,
    maxAttempts: opts.maxAttempts,
    storeId: opts.storeId,
    runId: opts.runId,
    model: opts.img2imgModel,
    referenceImages: [{ src: opts.referenceUrl }],
  });
  if (img2img.ok) return img2img;

  return runOnePrompt({
    role: "lifestyle",
    creative: opts.creative,
    provider: opts.provider,
    maxAttempts: opts.maxAttempts,
    storeId: opts.storeId,
    runId: opts.runId,
  });
}

/**
 * Identity-lock preamble shared by every Kontext edit (Phase 4.6.1). The
 * provided photo is the single source of truth; the model is a commercial
 * advertising photographer shooting THAT product, not a designer reinventing
 * it. Kept verbatim across hero + scenes so the constraint never weakens.
 */
const IDENTITY_LOCK =
  "The product in the provided reference photo is the SINGLE SOURCE OF TRUTH. " +
  "Keep its exact shape, container, packaging, label text, logo, branding and " +
  "colours pixel-faithful. Do NOT redesign, relabel, substitute, simplify, " +
  "duplicate, or invent a different product. You are a commercial advertising " +
  "photographer shooting this real product, not a product designer.";

/**
 * Wrap the hero prompt as an identity-preserving Kontext EDIT that composites a
 * photorealistic, audience-appropriate person USING/HOLDING the exact product
 * in a premium aspirational setting (Phase 4.6.1: product + human + context is
 * the default hero, not a product-only studio shot).
 */
function buildIdentityPrompt(heroPrompt: string): string {
  return (
    IDENTITY_LOCK +
    " Re-photograph this exact product as a LUXURY GCC e-commerce ADVERTISING " +
    "CAMPAIGN hero — art-directed like a premium beauty/fashion ad, NOT a casual " +
    "snapshot of someone holding a bottle: editorial dramatic lighting, a refined " +
    "aspirational set, intentional negative space, and the EXACT product as the " +
    "unmistakable hero, held or used by a photorealistic, audience-matched person. " +
    "Composition should create desire and feel like a high-end campaign. " +
    heroPrompt +
    " Natural skin texture and believable hands/anatomy; no obvious-AI face."
  );
}

/**
 * Wrap a scene prompt as an identity-preserving Kontext EDIT: composite the
 * EXACT reference product into a premium advertising scene while keeping the
 * product pixel-faithful (Phase 4.6.1).
 *
 * Phase 4.6.3 — intent-aware: `ingredient`/`detail` intents render a premium
 * MACRO of the exact product + its ingredient/texture (a hand may hold it, but a
 * full human is optional), since a forced full-body human weakens a close-up
 * ingredient shot. Every other intent keeps the product + human composite.
 */
export function buildSceneIdentityPrompt(scenePrompt: string, intent?: string): string {
  const i = intent ?? "";
  // Phase 4.6.4b round 2 — the wrapper is DECISIVELY asset-aware so each scene
  // DEPICTS its section's job. The #1 failure was every scene collapsing into "a
  // person holding the product"; each branch now art-directs a distinct
  // composition and the ingredient branch forbids a model outright.
  if (/ingredient|detail|texture|swatch|macro/i.test(i)) {
    return (
      IDENTITY_LOCK +
      " Re-photograph this exact product as a premium MACRO still-life that sells " +
      "the formula: the product beside its hero ingredient and a texture swatch " +
      "(oil droplets, cream smear, botanicals, powder) on a clean premium surface, " +
      "shallow depth of field, crisp tactile detail. NO model, NO face, NO person " +
      "in the frame — product + ingredient only: " +
      scenePrompt +
      " Studio-grade product photography; no obvious-AI artefacts."
    );
  }
  if (/mechanism|apply|applicat|step|usage|how/i.test(i)) {
    return (
      IDENTITY_LOCK +
      " Show a believable APPLICATION moment ON THE TARGET AREA: an audience-matched " +
      "person's hand dispensing or applying this exact product to the area it treats " +
      "(face / under-eye / scalp / hairline / midsection as relevant), cropped TIGHT " +
      "to the action — hand + product + target area only, NOT a full-body portrait: " +
      scenePrompt +
      " Product clearly visible and readable; realistic single hand, five fingers; no obvious-AI artefacts."
    );
  }
  if (/proof|testimonial|portrait|customer|review/i.test(i)) {
    return (
      IDENTITY_LOCK +
      " Shoot a confident real-customer PORTRAIT: a photorealistic, audience-matched " +
      "person holding/using this exact product with direct eye contact and an " +
      "authentic, satisfied expression (testimonial energy): " +
      scenePrompt +
      " Product clearly visible; natural skin and hands; no obvious-AI face."
    );
  }
  if (/result|outcome|after|transform/i.test(i)) {
    return (
      IDENTITY_LOCK +
      " Capture the OUTCOME — the visible 'after' the buyer wants: a close, flattering " +
      "look at the IMPROVED target area (radiant skin / fuller hair / smoother contour " +
      "as relevant) that proves the promise, with this exact product present but " +
      "SECONDARY in frame (not the focus, not squared to camera): " +
      scenePrompt +
      " Photoreal, natural skin texture; no obvious-AI face."
    );
  }
  if (/benefit|problem|solution|concern|relief/i.test(i)) {
    return (
      IDENTITY_LOCK +
      " Dramatise the PROBLEM→SOLUTION on the relevant body area: frame the concern " +
      "this product resolves and the moment of relief/improvement, the exact product " +
      "present as the solution. Focus on the target area, NOT a generic posed " +
      "portrait: " +
      scenePrompt +
      " Photoreal, believable anatomy; no obvious-AI face."
    );
  }
  return (
    IDENTITY_LOCK +
    " Composite this exact product naturally into a premium advertising scene " +
    "with a photorealistic, audience-appropriate person using or holding it in a " +
    "candid, natural pose: " +
    scenePrompt +
    " The product stays clearly visible and recognisable; believable hands and " +
    "anatomy; no obvious-AI face."
  );
}

/**
 * Asset-specific NEGATIVE additions (Phase 4.6.4b round 2). The creative-prompts
 * stage emits a base negative; here we ADD intent-specific exclusions at the
 * provider call so e.g. an `ingredient` macro hard-rejects a model/portrait
 * creeping in. Returned string is appended to the scene's base negative.
 */
export function assetNegativeFor(intent?: string): string {
  const i = intent ?? "";
  if (/ingredient|detail|texture|swatch|macro/i.test(i)) {
    return "person, model, face, portrait, full body, hands gripping, lifestyle scene";
  }
  if (/mechanism|apply|applicat|step|usage|how/i.test(i)) {
    return "full body, posed portrait, face filling frame, multiple hands, product squared to camera";
  }
  if (/result|outcome|after|transform/i.test(i)) {
    return "product as the focus, bottle squared to camera, stiff product-presentation pose";
  }
  return "";
}

/** Merge a base negative with the asset-specific additions (dedup-friendly). */
function mergeNegative(base: string | undefined, extra: string): string {
  const b = (base ?? "").trim();
  if (!extra) return b;
  return b ? `${b}, ${extra}` : extra;
}

/**
 * Only http(s) URLs are usable as fal references (fal must fetch the bytes).
 * Bare R2 keys / empty values return undefined → caller uses text-to-image.
 */
function resolveServableReference(src?: string): string | undefined {
  if (!src) return undefined;
  return /^https?:\/\//i.test(src.trim()) ? src.trim() : undefined;
}

async function runOnePrompt(opts: {
  role: "hero" | "lifestyle";
  creative: CreativePrompt;
  provider: ImageProvider;
  maxAttempts: number;
  storeId: string;
  runId: string;
  /** Optional model override (e.g. Kontext for img2img). */
  model?: string;
  /** Optional reference images for img2img / identity conditioning. */
  referenceImages?: { src: string; alt?: string }[];
}): Promise<RunOutcome> {
  const { w, h } = aspectToPx(opts.creative.aspectRatio);
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const res = await opts.provider.generate({
        prompt: opts.creative.prompt,
        negative: opts.creative.negative,
        size: { w, h },
        aspectRatio: opts.creative.aspectRatio,
        storeId: opts.storeId,
        runId: opts.runId,
        ...(opts.model ? { model: opts.model } : {}),
        ...(opts.referenceImages ? { referenceImages: opts.referenceImages } : {}),
      });
      return {
        ok: true,
        result: {
          role: opts.role,
          intent: opts.creative.intent,
          prompt: opts.creative.prompt,
          url: res.url,
          width: res.width,
          height: res.height,
          costUsd: res.costUsd,
          model: res.model,
          providerId: res.providerId,
          seed: res.seed,
          attempts: attempt,
        },
      };
    } catch (err) {
      lastError = err;
    }
  }

  return {
    ok: false,
    failure: {
      role: opts.role,
      intent: opts.creative.intent,
      prompt: opts.creative.prompt,
      errorMessage:
        lastError instanceof Error ? lastError.message : "unknown_error",
      attempts: opts.maxAttempts,
    },
  };
}

/**
 * Translate an aspect ratio label into concrete pixel dimensions for the
 * underlying image provider. Sizes are picked to match the M4 fal.ai
 * adapter's accepted resolutions (Flux Pro 1.1 supports 1024² and rectangular
 * variants).
 */
function aspectToPx(ratio: AspectRatio): { w: number; h: number } {
  switch (ratio) {
    case "1:1":
      return { w: 1024, h: 1024 };
    case "4:5":
      return { w: 1024, h: 1280 };
    case "9:16":
      return { w: 768, h: 1344 };
    case "16:9":
      return { w: 1344, h: 768 };
    case "3:4":
      return { w: 1024, h: 1365 };
    case "2:3":
      return { w: 1024, h: 1536 };
  }
}
