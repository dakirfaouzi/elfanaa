import type { DraftDocument } from "@platform/builder-schema";

/**
 * BuilderState — the in-memory model the Studio UI mounts.
 *
 * # Fields
 *
 *   • `document`       — the current draft snapshot. Always
 *                        non-null (operators land on a draft
 *                        page after the loader populates it).
 *   • `documentVersion` — monotonically increasing integer
 *                         bumped on every successful mutation.
 *                         Used as the cache-busting key for
 *                         the autosave debounce.
 *   • `past` / `future` — history stacks for undo/redo.
 *                         Plain `DraftDocument` snapshots; the
 *                         cap (`HISTORY_LIMIT`) keeps memory
 *                         bounded.
 *   • `saveState`      — externally-observed save status.
 *                        Tracked here (instead of via a separate
 *                        hook) so dirty-state guards have one
 *                        source of truth.
 *   • `lastError`      — last save error message (UI surfaces it
 *                        in the toolbar).
 *
 * # Invariants
 *
 *   • `documentVersion` >= 0 always.
 *   • `past.length` and `future.length` <= `HISTORY_LIMIT`.
 *   • When `saveState === "saved"`, `dirtySinceVersion === null`.
 *     The wrapper that owns autosave maintains this.
 */

export type SaveState = "idle" | "saving" | "saved" | "error";

export const HISTORY_LIMIT = 50;

export interface BuilderState {
  document: DraftDocument;
  documentVersion: number;

  past: DraftDocument[];
  future: DraftDocument[];

  saveState: SaveState;
  savedAt: number | null;
  savedDocumentVersion: number | null;
  lastError: string | null;
}

export function initialState(document: DraftDocument): BuilderState {
  return {
    document,
    documentVersion: 0,
    past: [],
    future: [],
    saveState: "saved",
    savedAt: Date.now(),
    savedDocumentVersion: 0,
    lastError: null,
  };
}

/** Returns true when the in-memory doc has un-saved mutations. */
export function isDirty(state: BuilderState): boolean {
  return state.savedDocumentVersion !== state.documentVersion;
}

export function canUndo(state: BuilderState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: BuilderState): boolean {
  return state.future.length > 0;
}
