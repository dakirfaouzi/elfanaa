import type { DraftDocument, Section } from "@platform/builder-schema";
import type { BuilderAction } from "./actions";
import type { BuilderState } from "./state";
import { HISTORY_LIMIT, initialState } from "./state";

/**
 * The Studio builder reducer.
 *
 * # Semantics
 *
 * - Pure function: `(prev, action) => next`. No I/O, no Date.now
 *   except in the explicit `MARK_*` actions where the caller
 *   supplies the timestamp.
 *
 * - History recording happens INSIDE the reducer for content
 *   mutations, but NOT for `MARK_*` save lifecycle actions.
 *   Recording on UNDO/REDO is also skipped — those just swap
 *   between stacks.
 *
 * - `documentVersion` increments only when the document JSON
 *   actually changes. This avoids spurious autosave triggers
 *   when the operator opens a panel but doesn't edit anything.
 *
 * - Unknown action `type` is a TypeScript compile error; at
 *   runtime an unknown action returns the previous state
 *   unchanged.
 *
 * # Section mutation rule
 *
 *   • All `UPDATE_SECTION` mutations are SHALLOW merges of the
 *     patch into the section. Nested arrays (items, pairs) must
 *     be passed wholesale in the patch — the reducer does not
 *     dive into them.
 *
 *   • This matches how the section editor forms work: each form
 *     holds the full section in local state, and on every
 *     keystroke dispatches `UPDATE_SECTION { patch: { items: ... } }`.
 */

function pushHistory(
  past: DraftDocument[],
  snapshot: DraftDocument,
): DraftDocument[] {
  const next = past.length >= HISTORY_LIMIT ? past.slice(1) : past.slice();
  next.push(snapshot);
  return next;
}

function withDocument(
  state: BuilderState,
  next: DraftDocument,
): BuilderState {
  if (next === state.document) return state;
  return {
    ...state,
    document: next,
    documentVersion: state.documentVersion + 1,
    past: pushHistory(state.past, state.document),
    future: [],
  };
}

function indexById(sections: Section[], id: string): number {
  return sections.findIndex((s) => s.id === id);
}

export function reducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    // ── Hydration ──────────────────────────────────────────────────────
    case "SET_DRAFT": {
      const fresh = initialState(action.document);
      fresh.savedAt = state.savedAt;
      return fresh;
    }

    case "UPDATE_META": {
      const next: DraftDocument = {
        ...state.document,
        meta: { ...state.document.meta, ...action.meta },
      };
      return withDocument(state, next);
    }

    case "SET_SLUG": {
      if (state.document.meta.slug === action.slug) return state;
      const next: DraftDocument = {
        ...state.document,
        meta: { ...state.document.meta, slug: action.slug },
      };
      return withDocument(state, next);
    }

    // ── Section list ────────────────────────────────────────────────────
    case "ADD_SECTION": {
      const sections = state.document.sections.slice();
      if (action.afterId) {
        const idx = indexById(sections, action.afterId);
        if (idx >= 0) {
          sections.splice(idx + 1, 0, action.section);
        } else {
          sections.push(action.section);
        }
      } else {
        sections.push(action.section);
      }
      return withDocument(state, { ...state.document, sections });
    }

    case "DELETE_SECTION": {
      const idx = indexById(state.document.sections, action.sectionId);
      if (idx < 0) return state;
      const sections = state.document.sections.slice();
      sections.splice(idx, 1);
      return withDocument(state, { ...state.document, sections });
    }

    case "DUPLICATE_SECTION": {
      const idx = indexById(state.document.sections, action.sectionId);
      if (idx < 0) return state;
      const sections = state.document.sections.slice();
      sections.splice(idx + 1, 0, action.newSection);
      return withDocument(state, { ...state.document, sections });
    }

    case "MOVE_SECTION": {
      const idx = indexById(state.document.sections, action.sectionId);
      if (idx < 0) return state;
      const dest = action.direction === "up" ? idx - 1 : idx + 1;
      if (dest < 0 || dest >= state.document.sections.length) return state;
      const sections = state.document.sections.slice();
      const [moved] = sections.splice(idx, 1);
      sections.splice(dest, 0, moved);
      return withDocument(state, { ...state.document, sections });
    }

    case "REORDER_SECTIONS": {
      const byId = new Map(state.document.sections.map((s) => [s.id, s]));
      const ordered: Section[] = [];
      for (const id of action.orderedIds) {
        const s = byId.get(id);
        if (s) ordered.push(s);
      }
      for (const s of state.document.sections) {
        if (!action.orderedIds.includes(s.id)) ordered.push(s);
      }
      if (ordered.length === 0) return state;
      const same =
        ordered.length === state.document.sections.length &&
        ordered.every((s, i) => s === state.document.sections[i]);
      if (same) return state;
      return withDocument(state, { ...state.document, sections: ordered });
    }

    case "TOGGLE_SECTION": {
      const idx = indexById(state.document.sections, action.sectionId);
      if (idx < 0) return state;
      const target = state.document.sections[idx];
      const nextEnabled =
        action.enabled !== undefined ? action.enabled : !target.enabled;
      if (target.enabled === nextEnabled) return state;
      const sections = state.document.sections.slice();
      sections[idx] = { ...target, enabled: nextEnabled };
      return withDocument(state, { ...state.document, sections });
    }

    case "UPDATE_SECTION": {
      const idx = indexById(state.document.sections, action.sectionId);
      if (idx < 0) return state;
      const target = state.document.sections[idx];
      const merged = { ...target, ...action.patch } as Section;
      if (merged.kind !== target.kind) {
        return state;
      }
      const sections = state.document.sections.slice();
      sections[idx] = merged;
      return withDocument(state, { ...state.document, sections });
    }

    case "SET_SECTION_MEDIA": {
      const idx = indexById(state.document.sections, action.sectionId);
      if (idx < 0) return state;
      const target = state.document.sections[idx];
      const sections = state.document.sections.slice();
      sections[idx] = {
        ...target,
        [action.slot]: action.media,
      } as Section;
      return withDocument(state, { ...state.document, sections });
    }

    // ── History ────────────────────────────────────────────────────────
    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const past = state.past.slice(0, -1);
      const future = [state.document, ...state.future];
      return {
        ...state,
        document: previous,
        documentVersion: state.documentVersion + 1,
        past,
        future,
      };
    }

    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const future = state.future.slice(1);
      const past = pushHistory(state.past, state.document);
      return {
        ...state,
        document: next,
        documentVersion: state.documentVersion + 1,
        past,
        future,
      };
    }

    // ── Save lifecycle ─────────────────────────────────────────────────
    case "MARK_SAVING":
      return { ...state, saveState: "saving", lastError: null };

    case "MARK_SAVED":
      return {
        ...state,
        saveState: "saved",
        savedAt: action.savedAt,
        savedDocumentVersion: action.savedDocumentVersion,
        lastError: null,
      };

    case "MARK_SAVE_ERROR":
      return {
        ...state,
        saveState: "error",
        lastError: action.message,
      };

    default: {
      const exhaustive: never = action;
      void exhaustive;
      return state;
    }
  }
}
