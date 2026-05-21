import { z } from "zod";
import type { VisionProvider } from "../providers/contracts";
import { VisionOutputSchema } from "../schemas/vision";
import {
  buildVisionSystemPrompt,
  buildVisionUserPrompt,
} from "../prompts/vision";
import type { StageContext } from "./types";
import type { VisionInput, VisionOutput } from "./types-vision";

/**
 * Stage 03 — Vision analysis (PLATFORM.md §11).
 *
 * Failure mode: "retry-once-higher-temp; skip on second fail." This is
 * implemented inline (not via the shared `runTextStage` helper) because
 * the retry strategy differs — temperature bumps, not "fix JSON"
 * reprompts.
 *
 * On total failure the stage returns `{ skipped: true }` so the M6
 * worker can still complete the run with only the research signal.
 */

/**
 * Zod shape for the model's raw response. The pipeline-facing
 * `VisionOutputSchema` extends this with stage-controlled fields
 * (`skipped`, `costUsd`) that are NOT model-emitted.
 */
const VisionModelResponseSchema = z.object({
  productCategory: z.string().optional(),
  formFactor: z.string().optional(),
  visibleColors: z.array(z.string()).optional(),
  packagingMaterial: z.string().optional(),
  visibleText: z.string().optional(),
  labelLanguages: z.array(z.string()).optional(),
  approximateSize: z.string().optional(),
  visualHooks: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
});

export async function vision(
  opts: {
    input: VisionInput;
    providers: { vision: VisionProvider };
  } & StageContext,
): Promise<VisionOutput> {
  if (opts.input.images.length === 0) {
    const skipped: VisionOutput = {
      skipped: true,
      skipReason: "no_images_provided",
      costUsd: 0,
    };
    return VisionOutputSchema.parse(skipped);
  }

  const system = buildVisionSystemPrompt({ storeConfig: opts.storeConfig });
  const user = buildVisionUserPrompt();

  const temperatures = [0.2, 0.6] as const;
  let lastError: unknown;
  let totalCost = 0;

  for (let attempt = 0; attempt < temperatures.length; attempt++) {
    try {
      const res = await opts.providers.vision.analyze({
        images: opts.input.images,
        instructions: `${system}\n\n${user}`,
        schema: VisionModelResponseSchema,
        temperature: temperatures[attempt],
        storeId: opts.storeConfig.id,
        runId: opts.runId,
      });

      totalCost += res.costUsd;

      if (res.parsed) {
        const output: VisionOutput = {
          skipped: false,
          productCategory: res.parsed.productCategory,
          formFactor: res.parsed.formFactor,
          visibleColors: res.parsed.visibleColors,
          packagingMaterial: res.parsed.packagingMaterial,
          visibleText: res.parsed.visibleText,
          labelLanguages: res.parsed.labelLanguages,
          approximateSize: res.parsed.approximateSize,
          visualHooks: res.parsed.visualHooks,
          confidence: res.parsed.confidence,
          notes: res.parsed.notes,
          costUsd: totalCost,
        };
        return VisionOutputSchema.parse(output);
      }

      lastError = new Error("vision_parsed_missing");
    } catch (err) {
      lastError = err;
    }
  }

  const skipped: VisionOutput = {
    skipped: true,
    skipReason:
      lastError instanceof Error
        ? `vision_failed: ${lastError.message}`
        : "vision_failed: unknown",
    costUsd: totalCost,
  };
  return VisionOutputSchema.parse(skipped);
}
