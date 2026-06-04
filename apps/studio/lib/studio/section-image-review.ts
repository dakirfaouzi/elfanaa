import type { DraftDocument } from "@platform/builder-schema";
import {
  IMAGE_REVIEW_BAG,
  IMAGE_REVIEWED_KEYS_FIELD,
} from "@platform/builder-state";

/**
 * Image-QA review helpers (Sprint 3).
 *
 * Single source of truth for the *stable item keys* and the *reviewed set*
 * that the SectionImagesPanel (per-card toggles + progress) and the
 * BuilderClient (publish-confirm warning) both read. Keeping the key scheme
 * here — identical to the reducer's `SET_IMAGE_REVIEWED` contract — means the
 * panel's progress count and the modal's warning count can never disagree.
 *
 * Review state lives in `croContent.__review.reviewedKeys` (see
 * `@platform/builder-state/review`): the only document field that survives the
 * non-strict top-level schema's key-strip on autosave + publish parse.
 */

type ReviewDoc = Pick<DraftDocument, "sections" | "croContent">;

/** Stable key for the hero (a builder MediaRef). */
export function heroReviewKey(heroId: string): string {
  return `hero:${heroId}`;
}

/** Stable key for a CRO scene at a given pool index. */
export function sceneReviewKey(index: number): string {
  return `scene:${index}`;
}

/**
 * The set of item keys the operator has marked Reviewed. Tolerant of a
 * missing/legacy bag and of non-string entries.
 */
export function getReviewedKeys(
  croContent: Record<string, unknown> | undefined,
): Set<string> {
  if (!croContent) return new Set();
  const bag = croContent[IMAGE_REVIEW_BAG];
  const raw =
    bag && typeof bag === "object"
      ? (bag as Record<string, unknown>)[IMAGE_REVIEWED_KEYS_FIELD]
      : undefined;
  const arr = Array.isArray(raw) ? raw : [];
  return new Set(arr.filter((k): k is string => typeof k === "string"));
}

/**
 * All reviewable item keys for a draft, in panel order: hero first (when a
 * hero section exists), then each `croContent.lifestyleImages[]` scene. Mirrors
 * exactly what `SectionImagesPanel` surfaces and what `collectImageStats`
 * counts, so totals line up everywhere.
 */
export function collectReviewKeys(document: ReviewDoc): string[] {
  const keys: string[] = [];
  const hero = document.sections.find((s) => s.kind === "hero");
  if (hero) keys.push(heroReviewKey(hero.id));
  const bag = document.croContent as { lifestyleImages?: unknown } | undefined;
  const pool = Array.isArray(bag?.lifestyleImages) ? bag.lifestyleImages : [];
  pool.forEach((_, i) => keys.push(sceneReviewKey(i)));
  return keys;
}

/** Reviewed / total counts for the progress indicator + publish warning. */
export function reviewProgress(document: ReviewDoc): {
  reviewed: number;
  total: number;
} {
  const keys = collectReviewKeys(document);
  const reviewed = getReviewedKeys(
    document.croContent as Record<string, unknown> | undefined,
  );
  let count = 0;
  for (const k of keys) if (reviewed.has(k)) count += 1;
  return { reviewed: count, total: keys.length };
}
