import { z } from "zod";
import type {
  CreativePromptsOutput,
  CreativePrompt,
} from "../pipeline/types-creative-prompts";

/**
 * Zod schema for the creative-prompts stage output (stage 07).
 *
 * Always emits exactly one `hero` prompt; lifestyle prompts are optional
 * (per PLATFORM.md §11 stage 07 failure mode).
 */
const aspectRatio = z.enum(["1:1", "4:5", "9:16", "16:9", "3:4", "2:3"]);

const CreativePromptSchema: z.ZodType<CreativePrompt> = z.object({
  prompt: z.string().min(20),
  negative: z.string().optional(),
  aspectRatio: aspectRatio,
  intent: z.string().optional(),
});

export const CreativePromptsOutputSchema: z.ZodType<CreativePromptsOutput> =
  z.object({
    hero: CreativePromptSchema,
    lifestyle: z.array(CreativePromptSchema).max(6),
  });
