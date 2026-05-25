import type { StudioDraftStatusValue } from "@platform/persistence";

/**
 * Operator-facing labels + tag tone for the seven draft statuses.
 *
 * # Why both label and tone live here
 *
 * The drafts list (`/drafts/page.tsx`) and the builder header
 * (`/drafts/[draftId]/page.tsx`) both render the same status, and
 * the choice of label + tag tone must stay consistent between them.
 * Centralising both as pure data makes a divergence physically
 * impossible — and lets a schema-guard test re-import the Prisma
 * enum and assert every value has both fields.
 *
 * # Why the labels are not the raw enum
 *
 * The Prisma enum names are precise but read like internal jargon —
 * `intake`, `generating`, `publishing`. An operator scanning the
 * drafts list shouldn't have to mentally translate "what does
 * 'intake' mean here vs the Intake form?" The labels below are
 * tightly scoped to the operator's mental model:
 *
 *   • intake      → "Pipeline" — pending the AI pipeline output.
 *   • generating  → "Generating" — pipeline currently running.
 *   • ready       → "Draft" — generated, awaiting operator review.
 *   • publishing  → "Publishing" — publish in flight.
 *   • published   → "Published" — live on the storefront.
 *   • archived    → "Archived" — operator retired the draft.
 *   • failed      → "Failed" — pipeline or publish errored.
 *
 * # Tag tone palette
 *
 * Maps to the existing `.tag-*` utility classes in `globals.css`,
 * so consumers don't need to know the colour tokens — just import
 * `statusTagClass(status)` and apply to the `<span>`.
 */

export type DraftStatusTone = "accent" | "info" | "success" | "warning" | "danger";

export const DRAFT_STATUS_LABEL: Record<StudioDraftStatusValue, string> = {
  intake: "Pipeline",
  generating: "Generating",
  ready: "Draft",
  publishing: "Publishing",
  published: "Published",
  archived: "Archived",
  failed: "Failed",
};

export const DRAFT_STATUS_TONE: Record<StudioDraftStatusValue, DraftStatusTone> = {
  intake: "info",
  generating: "info",
  ready: "accent",
  publishing: "info",
  published: "success",
  archived: "warning",
  failed: "danger",
};

/** Convenience accessor — returns the full `tag tag-<tone>` class
 *  string ready to drop onto a `<span>`. */
export function statusTagClass(status: StudioDraftStatusValue): string {
  return `tag tag-${DRAFT_STATUS_TONE[status]}`;
}

/** Convenience accessor — returns the operator-facing label. */
export function statusLabel(status: StudioDraftStatusValue): string {
  return DRAFT_STATUS_LABEL[status];
}

/**
 * Group draft statuses for the "counts strip" on the drafts list.
 *
 *   • In progress: intake, generating, publishing
 *   • Drafts:      ready
 *   • Published:   published
 *   • Archived:    archived
 *   • Failed:      failed
 *
 * Returns a stable order so consumers can `.map()` without sorting.
 */
export function bucketStatus(
  status: StudioDraftStatusValue,
): "in_progress" | "drafts" | "published" | "archived" | "failed" {
  switch (status) {
    case "intake":
    case "generating":
    case "publishing":
      return "in_progress";
    case "ready":
      return "drafts";
    case "published":
      return "published";
    case "archived":
      return "archived";
    case "failed":
      return "failed";
  }
}
