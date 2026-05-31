import type { SectionKind } from "@platform/catalog-schema";
import { StructureOutputSchema } from "../schemas/structure";
import { PipelineError } from "./types";
import type { StageContext } from "./types";
import type { StructureInput, StructureOutput } from "./types-structure";
import { planSectionOrder } from "./awareness-ordering";

/**
 * Stage 05 — Section structure (PLATFORM.md §11; Step 4 §4.3 / ADR-S4-2).
 *
 * DETERMINISTIC as of Step 4. Section ordering is a CRO policy decision driven
 * by the Eugene Schwartz awareness model + market sophistication, not a
 * creative generation task — so it is computed by `planSectionOrder` rather
 * than an LLM. This makes the structure reproducible (the success criterion
 * "different awareness ⇒ different structure" is only testable if it's
 * deterministic), removes a per-draft LLM round-trip, and eliminates the
 * "model returned an invalid ordering" failure surface entirely.
 *
 * Inputs:
 *   • `targeting.awarenessLevel` / `sophisticationLevel` drive the ordering.
 *   • The store's `templates.sectionLibrary` constrains which kinds may appear.
 *   • The store's `templates.orderings[defaultPdp]` is the no-targeting default.
 *
 * `usedFallback` is reserved for the genuine precondition failure (a store with
 * no usable default ordering). A missing awareness signal is NOT a fallback —
 * it's the documented "use the store default" path (`basis: "default"`).
 */
export function structure(
  opts: {
    input: StructureInput;
  } & StageContext,
): StructureOutput {
  const { templates } = opts.storeConfig;
  const defaultOrdering = templates.orderings[templates.defaultPdp];

  if (!defaultOrdering || defaultOrdering.length === 0) {
    throw new PipelineError({
      kind: "precondition_failed",
      stage: "structure",
      message: `store '${opts.storeConfig.id}' has no usable templates.orderings['${templates.defaultPdp}']`,
    });
  }

  const plan = planSectionOrder({
    targeting: opts.input.targeting,
    sectionLibrary: templates.sectionLibrary as SectionKind[],
    defaultOrdering,
  });

  const output: StructureOutput = {
    templateId:
      plan.basis === "awareness"
        ? `awareness:${opts.input.targeting?.awarenessLevel ?? "unknown"}`
        : templates.defaultPdp,
    sections: plan.sections,
    custom: plan.basis === "awareness",
    rationale: plan.rationale,
    usedFallback: false,
  };
  return StructureOutputSchema.parse(output);
}
