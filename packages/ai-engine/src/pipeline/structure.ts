import { z } from "zod";
import type { SectionKind } from "@platform/catalog-schema";
import type { TextProvider } from "../providers/contracts";
import { StructureOutputSchema } from "../schemas/structure";
import {
  buildStructureSystemPrompt,
  buildStructureUserPrompt,
} from "../prompts/structure";
import { runTextStage } from "./_helpers/run-text-stage";
import { PipelineError } from "./types";
import type { StageContext } from "./types";
import type { StructureInput, StructureOutput } from "./types-structure";

/**
 * Stage 05 — Section structure (PLATFORM.md §11).
 *
 * Failure mode: "Fallback to `StoreConfig.templates.orderings` default."
 * The fallback path is what makes this stage interesting: even if the
 * model returns an invalid structure twice, we recover by emitting the
 * store's `defaultPdp` ordering with `usedFallback: true` so the worker
 * can mark this run as "structure: defaulted" without aborting.
 */

const StructureModelResponseSchema = z.object({
  templateId: z.string().nullable().optional(),
  customOrdering: z.array(z.string()).optional(),
  rationale: z.string().optional(),
});

export async function structure(
  opts: {
    input: StructureInput;
    providers: { text: TextProvider };
  } & StageContext,
): Promise<StructureOutput> {
  const system = buildStructureSystemPrompt({ storeConfig: opts.storeConfig });
  const user = buildStructureUserPrompt({
    storeConfig: opts.storeConfig,
    heroPromise: opts.input.strategy.heroPromise.en,
    benefitLabels: opts.input.strategy.benefitAngles.map((a) => a.label),
  });

  const orderings = opts.storeConfig.templates.orderings;
  const sectionLibrary = new Set(opts.storeConfig.templates.sectionLibrary);

  try {
    const parsed = await runTextStage({
      provider: opts.providers.text,
      stage: "structure",
      system,
      user,
      schema: StructureModelResponseSchema,
      storeId: opts.storeConfig.id,
      runId: opts.runId,
      temperature: 0.4,
      maxTokens: 600,
    });

    const resolved = resolveOrdering({
      templateId: parsed.templateId ?? null,
      customOrdering: parsed.customOrdering ?? [],
      orderings,
      sectionLibrary,
    });

    if (resolved) {
      const output: StructureOutput = {
        templateId: resolved.templateId,
        sections: resolved.sections,
        custom: resolved.custom,
        rationale: parsed.rationale,
        usedFallback: false,
      };
      return StructureOutputSchema.parse(output);
    }
  } catch (err) {
    if (
      err instanceof PipelineError &&
      err.kind !== "validation_failed" &&
      err.kind !== "provider_error"
    ) {
      throw err;
    }
    // fall through to default fallback path
  }

  return fallbackToDefault(opts.storeConfig);
}

function resolveOrdering(opts: {
  templateId: string | null;
  customOrdering: string[];
  orderings: Record<string, SectionKind[]>;
  sectionLibrary: Set<string>;
}):
  | { templateId: string; sections: SectionKind[]; custom: boolean }
  | undefined {
  if (opts.templateId && opts.orderings[opts.templateId]) {
    return {
      templateId: opts.templateId,
      sections: opts.orderings[opts.templateId],
      custom: false,
    };
  }

  if (opts.customOrdering.length >= 2) {
    const validSections = opts.customOrdering.filter((s) =>
      opts.sectionLibrary.has(s),
    );
    if (
      validSections.length === opts.customOrdering.length &&
      validSections[0] === "hero"
    ) {
      return {
        templateId: "<custom>",
        sections: validSections as SectionKind[],
        custom: true,
      };
    }
  }

  return undefined;
}

function fallbackToDefault(
  storeConfig: StageContext["storeConfig"],
): StructureOutput {
  const defaultId = storeConfig.templates.defaultPdp;
  const defaultSections = storeConfig.templates.orderings[defaultId];
  if (!defaultSections || defaultSections.length === 0) {
    throw new PipelineError({
      kind: "precondition_failed",
      stage: "structure",
      message: `store '${storeConfig.id}' has no usable templates.orderings['${defaultId}']`,
    });
  }
  const output: StructureOutput = {
    templateId: defaultId,
    sections: defaultSections,
    custom: false,
    rationale: "fallback_to_store_default_pdp",
    usedFallback: true,
  };
  return StructureOutputSchema.parse(output);
}
