import { z } from "zod";
import {
  IngestJobSchema,
  type IngestJob,
  type IngestImageRef,
} from "@platform/ingest";

/**
 * Intake form validation (M9 deliverable 1, "Connect intake → workers
 * → publisher").
 *
 * The intake page accepts:
 *
 *   • supplierUrl       (required)         — Alibaba / AliExpress / etc.
 *   • storeId           (required, "fanaa" today)
 *   • priceHintMajor    (required, SAR)    — operator's per-unit price
 *   • uploadedImages    (optional, 0..10)  — R2 keys or absolute URLs
 *   • operatorNotes     (optional)         — positioning hints
 *   • marginNotes       (optional)         — operator-internal cost notes
 *   • skipResearch      (optional bool)    — bypass supplier-page scrape
 *
 * The validator returns either a fully-typed IngestJob (with a freshly
 * generated runId + createdAt) or a structured Zod error report. It
 * NEVER throws — the route maps the structured result to HTTP 422.
 *
 * # Why a separate schema for the form
 *
 * The form's price is expressed in MAJOR units (e.g. 199 SAR). The
 * IngestJob's `priceHint.amount` is MINOR units (e.g. 19900 SAR
 * minor). We convert here so the boundary stays tidy and the
 * downstream Money helpers never see floats.
 *
 * # Why we mint the runId here
 *
 * The runId is the file name on disk + the SSE channel key + the
 * Studio's permalink slug, so it MUST be URL-safe (per the M6
 * IngestJobSchema regex). Minting here lets the route return the id
 * synchronously so the UI can navigate to /runs/<id> immediately.
 */

const FormSchema = z.object({
  supplierUrl: z
    .string()
    .url()
    .max(2048, "supplierUrl_too_long")
    .refine((u) => /^https?:\/\//.test(u), "supplierUrl_protocol_must_be_http"),
  storeId: z.string().min(1).max(64),
  priceHintMajor: z
    .number()
    .positive("priceHintMajor_must_be_positive")
    .max(100_000, "priceHintMajor_too_large"),
  currency: z
    .string()
    .min(3)
    .max(3)
    .transform((s) => s.toUpperCase())
    .default("SAR"),
  uploadedImages: z
    .array(
      z.object({
        src: z.string().min(1).max(2048),
        alt: z.string().max(512).optional(),
      }),
    )
    .max(10, "uploadedImages_max_10")
    .default([]),
  operatorNotes: z.string().max(4000).optional(),
  marginNotes: z.string().max(4000).optional(),
  skipResearch: z.boolean().optional(),
});

export type IntakeFormInput = z.input<typeof FormSchema>;
export type IntakeFormParsed = z.output<typeof FormSchema>;

export type IntakeValidationResult =
  | { status: "ok"; job: IngestJob }
  | {
      status: "invalid";
      issues: Array<{ path: string; message: string }>;
    };

export interface ValidateIntakeOptions {
  /** Now() — injected so tests pin the timestamp. */
  now?: () => Date;
  /** RunId minter — injected so tests pin the id. */
  mintRunId?: () => string;
}

/** Default runId generator. URL-safe: `run_<ulid-ish>`. */
export function defaultMintRunId(): string {
  const r = Math.random().toString(36).slice(2, 10);
  const t = Date.now().toString(36);
  return `run_${t}_${r}`;
}

export function validateIntake(
  raw: unknown,
  opts: ValidateIntakeOptions = {},
): IntakeValidationResult {
  const parsed = FormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "invalid",
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }

  const now = opts.now ?? (() => new Date());
  const mintRunId = opts.mintRunId ?? defaultMintRunId;
  const runId = mintRunId();

  const job: IngestJob = {
    runId,
    storeId: parsed.data.storeId,
    supplierUrl: parsed.data.supplierUrl,
    uploadedImages: parsed.data.uploadedImages as IngestImageRef[],
    priceHint: {
      amount: Math.round(parsed.data.priceHintMajor * 100),
      currency: parsed.data.currency,
    },
    operatorNotes: parsed.data.operatorNotes,
    marginNotes: parsed.data.marginNotes,
    skipResearch: parsed.data.skipResearch,
    createdAt: now().toISOString(),
  };

  // Cross-check: the IngestJobSchema is the canonical boundary. If
  // our form schema permits something the worker rejects we want to
  // catch it HERE rather than after `enqueue`.
  const cross = IngestJobSchema.safeParse(job);
  if (!cross.success) {
    return {
      status: "invalid",
      issues: cross.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }

  return { status: "ok", job };
}
