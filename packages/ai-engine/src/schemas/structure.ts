import { z } from "zod";
import type { StructureOutput } from "../pipeline/types-structure";

/**
 * Zod schema for the structure stage output (stage 05).
 *
 * The stage either picks one of the store's named templates OR proposes
 * a custom ordering. Either way, the resolved `sections` field is what
 * downstream consumers (copy, publisher) read.
 */
export const StructureOutputSchema: z.ZodType<StructureOutput> = z.object({
  templateId: z.string().min(1),
  sections: z.array(z.string().min(1)).min(2),
  custom: z.boolean(),
  rationale: z.string().optional(),
  /** True when this stage hit the PLATFORM.md §11 stage 05 fallback. */
  usedFallback: z.boolean(),
});
