/**
 * @platform/builder-state — public API.
 *
 * Pure state engine for the Studio draft builder. No React, no DOM,
 * no network. Consumed by apps/studio which wraps the reducer in
 * useReducer and the autosave scheduler in useEffect.
 */

export type { BuilderAction, ApplyResult } from "./actions";
export type { BuilderState, SaveState } from "./state";
export {
  initialState,
  isDirty,
  canUndo,
  canRedo,
  HISTORY_LIMIT,
} from "./state";
export { reducer } from "./reducer";
export type {
  AutosaveOptions,
  AutosaveScheduler,
  TimerLike,
} from "./autosave";
export { createAutosaveScheduler } from "./autosave";
