import type {
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
