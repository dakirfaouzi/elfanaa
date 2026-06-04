/**
 * Image-QA review state keys (Sprint 3).
 *
 * Review state ("which section images has the operator eyeballed?") must
 * persist with the draft but the top-level `DraftDocumentSchema` is a
 * non-strict `z.object` that STRIPS unknown keys on parse. The only field
 * that preserves arbitrary keys through `safeParse` (autosave + publish) is
 * the opaque `croContent` record (`z.record(z.string(), z.unknown())`).
 *
 * So review state lives at `croContent[IMAGE_REVIEW_BAG][IMAGE_REVIEWED_KEYS_FIELD]`
 * — an array of the same stable item keys the SectionImagesPanel uses
 * (`hero:<id>` / `scene:<index>`). Shared here so the reducer and the Studio
 * helpers can never drift on the key names.
 */
export const IMAGE_REVIEW_BAG = "__review";
export const IMAGE_REVIEWED_KEYS_FIELD = "reviewedKeys";
