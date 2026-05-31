import { z } from "zod";
import { LocalizedStringSchema } from "./locales";
import type {
  ComparisonContent,
  GuaranteeContent,
  HowItWorksContent,
  ObjectionsContent,
  ResultsContent,
  SectionContent,
} from "../section-content";

export const HowItWorksContentSchema: z.ZodType<HowItWorksContent> = z.object({
  summary: LocalizedStringSchema,
  steps: z
    .array(
      z.object({
        title: LocalizedStringSchema,
        body: LocalizedStringSchema,
      }),
    )
    .min(2)
    .max(5),
});

export const ResultsContentSchema: z.ZodType<ResultsContent> = z.object({
  intro: LocalizedStringSchema.optional(),
  timeline: z
    .array(
      z.object({
        when: LocalizedStringSchema,
        outcome: LocalizedStringSchema,
      }),
    )
    .min(2)
    .max(5),
});

export const GuaranteeContentSchema: z.ZodType<GuaranteeContent> = z.object({
  title: LocalizedStringSchema,
  body: LocalizedStringSchema,
});

export const ComparisonContentSchema: z.ZodType<ComparisonContent> = z.object({
  intro: LocalizedStringSchema.optional(),
  ours: z.array(LocalizedStringSchema).min(2).max(6),
  usual: z.array(LocalizedStringSchema).min(2).max(6),
});

export const ObjectionsContentSchema: z.ZodType<ObjectionsContent> = z.object({
  items: z
    .array(
      z.object({
        objection: LocalizedStringSchema,
        response: LocalizedStringSchema,
      }),
    )
    .min(2)
    .max(6),
});

export const SectionContentSchema: z.ZodType<SectionContent> = z.object({
  howItWorks: HowItWorksContentSchema.optional(),
  results: ResultsContentSchema.optional(),
  guarantee: GuaranteeContentSchema.optional(),
  comparison: ComparisonContentSchema.optional(),
  objections: ObjectionsContentSchema.optional(),
});
