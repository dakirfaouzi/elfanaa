import type { ImageProvider, VisionProvider } from "../providers/contracts";
import { ImageGenOutputSchema } from "../schemas/image-gen";
import { assessImage, type ImageQaVerdict } from "./image-qa";
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
    providers: { image: ImageProvider; vision?: VisionProvider };
  } & StageContext,
): Promise<ImageGenOutput> {
  const maxAttempts = opts.input.maxAttemptsPerPrompt ?? 3;

  // Phase 4.6.4d — vision QA gate. Active only when a vision provider is wired
  // and not explicitly disabled. `maxRegens` bounds the added cost.
  const qa: QaContext | undefined =
    opts.providers.vision && opts.input.qa?.enabled !== false
      ? {
          provider: opts.providers.vision,
          maxRegens: Math.max(0, opts.input.qa?.maxRegens ?? 1),
          referenceUrl: undefined, // set below once resolved
          storeId: opts.storeConfig.id,
          runId: opts.runId,
        }
      : undefined;

  const storeId = opts.storeConfig.id;
  const runId = opts.runId;
  const img2imgModel = opts.input.img2imgModel ?? DEFAULT_IMG2IMG_MODEL;

  // Step 3 (ADR-S3-3): when a servable reference photo is supplied, generate
  // image-to-image (Kontext) so it preserves the real product's identity, with a
  // hard fallback to text-to-image. Phase 4.6.4d wraps each producer in a vision
  // QA loop that regenerates off-type / unrealistic / black frames.
  const referenceUrl = resolveServableReference(opts.input.referenceImage?.src);
  if (qa) qa.referenceUrl = referenceUrl;

  const heroJob = produceWithQa({
    qa,
    role: "hero",
    intent: opts.input.prompts.hero.intent,
    referenceUrl,
    produce: (correction) =>
      referenceUrl
        ? runHeroWithIdentity({
            creative: opts.input.prompts.hero,
            referenceUrl,
            img2imgModel,
            provider: opts.providers.image,
            maxAttempts,
            storeId,
            runId,
            correction,
          })
        : runOnePrompt({
            role: "hero",
            creative: appendCorrection(opts.input.prompts.hero, correction),
            provider: opts.providers.image,
            maxAttempts,
            storeId,
            runId,
          }),
    // Hero hard-fail is identity-safe: pass the operator's real product photo
    // through rather than publish a black / wrong-product hero.
    onHardFail: (last) =>
      referenceUrl
        ? referencePassthroughHero(opts.input.prompts.hero, referenceUrl)
        : last,
  });

  // Step 4 Phase 4.6 — lifestyle/section scenes are ALSO grounded image-to-image
  // on the real product reference (when one is servable). Each scene keeps the
  // text-to-image fallback AND the QA loop.
  const lifestyleJobs = opts.input.prompts.lifestyle.map((cp) =>
    produceWithQa({
      qa,
      role: "lifestyle",
      intent: cp.intent,
      referenceUrl,
      produce: (correction) =>
        referenceUrl
          ? runSceneWithIdentity({
              creative: cp,
              referenceUrl,
              img2imgModel,
              provider: opts.providers.image,
              maxAttempts,
              storeId,
              runId,
              correction,
            })
          : runOnePrompt({
              role: "lifestyle",
              creative: appendCorrection(cp, correction),
              provider: opts.providers.image,
              maxAttempts,
              storeId,
              runId,
            }),
      // A scene that can't clear a HARD failure (black / product absent / wrong
      // product) is DROPPED — the section renders text-only rather than show a
      // broken image. SOFT failures are tolerated (better than an empty band).
      onHardFail: () => dropScene(cp),
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

/** Phase 4.6.4d — resolved QA context shared across producers. */
interface QaContext {
  provider: VisionProvider;
  maxRegens: number;
  referenceUrl?: string;
  storeId: string;
  runId: string;
}

/** Append corrective QA feedback to a raw prompt string. */
function appendCorrectionStr(prompt: string, correction?: string): string {
  if (!correction || correction.trim().length === 0) return prompt;
  return `${prompt} CORRECTION (fix this from the previous attempt): ${correction.trim()}`;
}

/** Append corrective QA feedback to a CreativePrompt's prompt field. */
function appendCorrection(
  creative: CreativePrompt,
  correction?: string,
): CreativePrompt {
  if (!correction || correction.trim().length === 0) return creative;
  return { ...creative, prompt: appendCorrectionStr(creative.prompt, correction) };
}

/** Fold extra cost (QA calls, discarded regen images) into a successful result. */
function withExtraCost(o: RunOutcome, add: number): RunOutcome {
  if (!o.ok || add <= 0) return o;
  return { ok: true, result: { ...o.result, costUsd: o.result.costUsd + add } };
}

/** Convert a QA hard-failed scene into a dropped (failed) outcome. */
function dropScene(cp: CreativePrompt): RunOutcome {
  return {
    ok: false,
    failure: {
      role: "lifestyle",
      intent: cp.intent,
      prompt: cp.prompt,
      errorMessage:
        "qa_hard_fail: black/absent/wrong-product after regeneration — scene dropped (section renders text-only)",
      attempts: 1,
    },
  };
}

/**
 * Phase 4.6.4d — generate an image, then run the vision QA gate, regenerating
 * with corrective feedback up to `qa.maxRegens` times. HARD failures that can't
 * be cleared call `onHardFail` (hero → identity passthrough, scene → drop); SOFT
 * failures are tolerated once the regen budget is spent (an imperfect on-section
 * image beats an empty band). QA never throws (assessImage fails open), and all
 * QA + discarded-regen cost is folded into the returned result.
 */
async function produceWithQa(opts: {
  produce: (correction?: string) => Promise<RunOutcome>;
  qa?: QaContext;
  role: "hero" | "lifestyle";
  intent?: string;
  referenceUrl?: string;
  onHardFail: (last: RunOutcome) => RunOutcome;
}): Promise<RunOutcome> {
  let outcome = await opts.produce();
  // No QA, generation failed, or identity-safe passthrough (the real product
  // photo needs no review) → return as-is.
  if (
    !opts.qa ||
    !outcome.ok ||
    outcome.result.providerId === "reference_passthrough"
  ) {
    return outcome;
  }

  let extraCost = 0;
  const assess = (url: string): Promise<ImageQaVerdict> =>
    assessImage({
      provider: opts.qa!.provider,
      imageUrl: url,
      referenceUrl: opts.referenceUrl,
      intent: opts.intent,
      role: opts.role,
      storeId: opts.qa!.storeId,
      runId: opts.qa!.runId,
    });

  let verdict = await assess(outcome.result.url);
  extraCost += verdict.costUsd;

  let regens = 0;
  while (verdict.verdict === "regenerate" && regens < opts.qa.maxRegens) {
    regens++;
    const retry = await opts.produce(verdict.feedback);
    if (!retry.ok) break; // keep the prior (passing-ish) outcome
    // The discarded prior image's cost stays counted via extraCost.
    extraCost += outcome.ok ? outcome.result.costUsd : 0;
    outcome = retry;
    verdict = await assess(retry.result.url);
    extraCost += verdict.costUsd;
    if (verdict.verdict === "pass") break;
  }

  if (verdict.verdict === "regenerate" && verdict.severity === "hard") {
    return opts.onHardFail(withExtraCost(outcome, extraCost));
  }
  return withExtraCost(outcome, extraCost);
}

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
  /** Phase 4.6.4d — corrective QA feedback appended on a regeneration. */
  correction?: string;
}): Promise<RunOutcome> {
  const img2img = await runOnePrompt({
    role: "hero",
    creative: {
      ...opts.creative,
      prompt: appendCorrectionStr(
        buildIdentityPrompt(opts.creative.prompt),
        opts.correction,
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
  /** Phase 4.6.4d — corrective QA feedback appended on a regeneration. */
  correction?: string;
}): Promise<RunOutcome> {
  const img2img = await runOnePrompt({
    role: "lifestyle",
    creative: {
      ...opts.creative,
      prompt: appendCorrectionStr(
        buildSceneIdentityPrompt(opts.creative.prompt, opts.creative.intent),
        opts.correction,
      ),
      negative: mergeNegative(
        mergeNegative(opts.creative.negative, SCENE_REALISM_NEGATIVE),
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

  // Text-to-image fallback — still asset-aware (same composition direction +
  // realism negatives) so a Kontext miss degrades to the right TYPE of image,
  // not a generic lifestyle shot. Identity is weaker here (no reference), but
  // the per-asset framing keeps it on-section.
  return runOnePrompt({
    role: "lifestyle",
    creative: {
      ...opts.creative,
      prompt: appendCorrectionStr(
        buildSceneIdentityPrompt(opts.creative.prompt, opts.creative.intent),
        opts.correction,
      ),
      negative: mergeNegative(
        mergeNegative(opts.creative.negative, SCENE_REALISM_NEGATIVE),
        assetNegativeFor(opts.creative.intent),
      ),
    },
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
 * Phase 4.6.4b round 3 — SCALE + PLACEMENT realism. img2img Kontext anchors on a
 * large product-on-white reference, so its failure mode is an OVERSIZED / FLOATING
 * product pasted into the scene, or a product that intersects the face/body. This
 * clause is appended to every composite wrapper to force believable scale and a
 * physically-real placement.
 */
const PLACEMENT_REALISM =
  " Keep the product at a TRUE real-world scale (a 30–60ml bottle/jar/tube is " +
  "small in a hand and small within a wider scene) — never oversized or giant. " +
  "The product must sit on a real surface or be held in a natural grip; it must " +
  "NOT float, must NOT intersect or merge with the face, skin, or body, and must " +
  "cast believable contact shadows. Composite it like a real photograph, not a " +
  "pasted cut-out.";

/**
 * Phase 4.6.4b round 3 — the per-scene negative floor. Merged into EVERY scene's
 * negative so the recurring compositing/anatomy artefacts are suppressed
 * regardless of what the creative-prompts stage emitted.
 */
const SCENE_REALISM_NEGATIVE =
  "oversized product, giant product, product larger than the head, floating " +
  "product, product intersecting face, product merged with skin, duplicated " +
  "product, pasted cut-out, deformed hands, extra fingers, fused fingers, " +
  "missing fingers, mangled hands, waxy plastic skin, uncanny face, blurry, " +
  "lowres, jpeg artefacts, watermark, text overlay";

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
    " Natural skin texture and believable hands/anatomy; no obvious-AI face." +
    PLACEMENT_REALISM
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
  return sceneIdentityCore(scenePrompt, intent) + PLACEMENT_REALISM;
}

function sceneIdentityCore(scenePrompt: string, intent?: string): string {
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
