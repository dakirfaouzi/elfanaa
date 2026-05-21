import type { TextProvider } from "../providers/contracts";
import { SocialProofOutputSchema } from "../schemas/social-proof";
import {
  buildSocialProofSystemPrompt,
  buildSocialProofUserPrompt,
} from "../prompts/social-proof";
import { runTextStage } from "./_helpers/run-text-stage";
import { PipelineError } from "./types";
import type { StageContext } from "./types";
import type {
  SocialProofInput,
  SocialProofOutput,
} from "./types-social-proof";

/**
 * Stage 10 — Social proof + FAQ + hooks (PLATFORM.md §11).
 *
 * Failure mode: "Realistic-name + dialect validation; reject if
 * generic." Implemented as a post-Zod heuristic check:
 *
 *   • Reviewer names MUST be drawn from a varied pool — at least 60%
 *     unique first-name initials across the review set.
 *   • Review bodies MUST average ≥ 30 characters (rejects "Great!"
 *     style fillers).
 *   • At least 70% of reviews must use Arabic letters somewhere in the
 *     body — guards against the model emitting English-only reviews
 *     for an Arabic-dialect brand.
 *
 * On failure, one corrective retry with a "be more specific" reprompt
 * is attempted before throwing.
 */

const ARABIC_LETTER_RE = /[\u0600-\u06FF]/;

export async function socialProof(
  opts: {
    input: SocialProofInput;
    providers: { text: TextProvider };
  } & StageContext,
): Promise<SocialProofOutput> {
  const baseSystem = buildSocialProofSystemPrompt({
    storeConfig: opts.storeConfig,
  });
  const user = buildSocialProofUserPrompt({
    heroPromise: opts.input.strategy.heroPromise.en,
    benefitLabels: opts.input.strategy.benefitAngles.map((a) => a.label),
    objections: opts.input.strategy.objections.map((o) => o.objection.en),
    adAngles: opts.input.strategy.adAngles,
  });

  let lastIssues: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const system =
      attempt === 0
        ? baseSystem
        : `${baseSystem}\n\n` +
          "Your previous output failed realism checks: " +
          lastIssues.join("; ") +
          ". Rewrite the entire response with varied reviewer names, " +
          "longer review bodies, and natural Arabic phrasing.";

    const parsed = await runTextStage<SocialProofOutput>({
      provider: opts.providers.text,
      stage: "social-proof",
      system,
      user,
      schema: SocialProofOutputSchema,
      storeId: opts.storeConfig.id,
      runId: opts.runId,
      temperature: 0.85,
      maxTokens: 3_500,
      maxRetries: 0,
    });

    lastIssues = runRealismChecks(parsed);
    if (lastIssues.length === 0) return parsed;
  }

  throw new PipelineError({
    kind: "validation_failed",
    stage: "social-proof",
    message: `social_proof_realism_failed: ${lastIssues.join("; ")}`,
  });
}

function runRealismChecks(out: SocialProofOutput): string[] {
  const issues: string[] = [];

  // Unique-initial check (rejects "Ahmad / Ahmad / Ahmad" style fillers).
  const firstInitials = new Set<string>();
  for (const r of out.reviews) {
    const initial = r.name.ar.trim().charAt(0) || r.name.en.trim().charAt(0);
    if (initial) firstInitials.add(initial);
  }
  if (out.reviews.length >= 3 && firstInitials.size < out.reviews.length * 0.6) {
    issues.push(
      `reviewer names not varied (${firstInitials.size} unique initials across ${out.reviews.length} reviews)`,
    );
  }

  // Body length check.
  const avgBodyLen =
    out.reviews.reduce(
      (sum, r) => sum + (r.body.ar.length + r.body.en.length) / 2,
      0,
    ) / Math.max(1, out.reviews.length);
  if (avgBodyLen < 30) {
    issues.push(`review bodies too short (avg ${avgBodyLen.toFixed(0)} chars)`);
  }

  // Arabic presence check.
  const reviewsWithArabic = out.reviews.filter((r) =>
    ARABIC_LETTER_RE.test(r.body.ar),
  ).length;
  if (
    out.reviews.length >= 3 &&
    reviewsWithArabic / out.reviews.length < 0.7
  ) {
    issues.push(
      `review.body.ar missing Arabic letters (${reviewsWithArabic}/${out.reviews.length})`,
    );
  }

  return issues;
}
