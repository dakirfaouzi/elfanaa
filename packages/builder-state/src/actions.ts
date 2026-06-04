import type {
  CatalogMetadata,
  DraftDocument,
  DraftMeta,
  MediaRef,
  Section,
  SectionKind,
} from "@platform/builder-schema";

/**
 * Action set for the builder reducer.
 *
 * # Design constraints
 *
 * - **Flat discriminated union** keyed by `type`. The reducer
 *   exhausts every branch — TypeScript flags any missed case.
 * - **No closures or callbacks inside actions** — actions must be
 *   serialisable so we can stream them through history and (in
 *   future) over the wire for collaborative editing.
 * - **Section mutations carry `sectionId`**, not array index.
 *   Indices change as sections move; ids don't.
 * - **`SET_DRAFT` is the only way to hydrate state from outside.**
 *   The reducer does NOT auto-merge; callers always pass the
 *   complete next-state. This makes the reducer pure and lets
 *   the autosave loop coexist with optimistic edits.
 *
 * # History
 *
 * History is recorded by a wrapper (`withHistory`) — NOT in the
 * base reducer. The base reducer is the pure transition; the
 * wrapper records snapshots before each mutation. This split
 * makes the base reducer trivially testable.
 */

export type BuilderAction =
  // Document-level
  | { type: "SET_DRAFT"; document: DraftDocument }
  | { type: "UPDATE_META"; meta: Partial<DraftMeta> }
  | { type: "SET_SLUG"; slug: string }
  /**
   * M12 / Step 2 / Phase 2.3 — catalog metadata patch.
   *
   * `patch` is a shallow merge into `document.catalogMetadata`.
   * Array/object fields (`offerTiers`, `badges`, `rating`, etc.)
   * MUST be passed wholesale — same SHALLOW-MERGE rule as
   * `UPDATE_SECTION`.
   *
   * Mutations are recorded in history so undo/redo work across the
   * catalog panel and the section list as one unit.
   */
  | { type: "UPDATE_CATALOG_METADATA"; patch: Partial<CatalogMetadata> }

  // Section list mutations
  | { type: "ADD_SECTION"; kind: SectionKind; afterId?: string; section: Section }
  | { type: "DELETE_SECTION"; sectionId: string }
  | { type: "DUPLICATE_SECTION"; sectionId: string; newSection: Section }
  | { type: "MOVE_SECTION"; sectionId: string; direction: "up" | "down" }
  | { type: "REORDER_SECTIONS"; orderedIds: string[] }
  | { type: "TOGGLE_SECTION"; sectionId: string; enabled?: boolean }

  // Per-section content mutations
  | { type: "UPDATE_SECTION"; sectionId: string; patch: Partial<Section> }
  | { type: "SET_SECTION_MEDIA"; sectionId: string; slot: string; media: MediaRef | null }

  /**
   * Step 4 / Draft Asset Review MVP — replace a generated CRO scene image with
   * an operator-uploaded one, IN PLACE inside `croContent[bag][index]`.
   *
   * The generated scenes (Ingredients / Results / How-It-Works / Benefits /
   * Social-Proof / Lifestyle) live in the opaque `croContent.lifestyleImages[]`
   * (or `images[]`) pool, not as builder sections, so they need a dedicated
   * action. The reducer SWAPS only `src` (+ optional dims) and stamps
   * `origin: "operator"`, preserving the existing `intent`/`alt` so the
   * storefront's semantic section-assignment is unchanged. Hero replacement
   * keeps using `SET_SECTION_MEDIA` (it is a builder `MediaRef`).
   */
  | {
      type: "REPLACE_CRO_IMAGE";
      bag: "lifestyleImages" | "images";
      index: number;
      src: string;
      width?: number;
      height?: number;
    }

  /**
   * Sprint 3 — Image QA Workflow. Mark a section image (hero or a CRO scene)
   * Reviewed / Not-Reviewed. State persists in the opaque
   * `croContent.__review.reviewedKeys` bag — the only schema-preserving home
   * for additive keys (the top-level document schema strips unknowns) — and is
   * recorded in history so it undoes/redoes with the rest of the draft.
   * `key` is the SAME stable key the SectionImagesPanel uses: `hero:<id>` /
   * `scene:<index>`.
   */
  | { type: "SET_IMAGE_REVIEWED"; key: string; reviewed: boolean }

  // History controls
  | { type: "UNDO" }
  | { type: "REDO" }

  // Autosave / sync controls
  | { type: "MARK_SAVED"; savedAt: number; savedDocumentVersion: number }
  | { type: "MARK_SAVING" }
  | { type: "MARK_SAVE_ERROR"; message: string };

/**
 * Result returned by reducer-wrapping helpers when an action could
 * not be applied (e.g. UNDO when history is empty). The base
 * reducer never throws.
 */
export type ApplyResult = {
  /** True if the document was mutated by this action. */
  changed: boolean;
  /** Reason for a no-op (debugging aid). */
  reason?: string;
};
