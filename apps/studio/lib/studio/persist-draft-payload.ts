import type { UniversalProduct } from "@platform/catalog-schema";
import { DraftDocumentSchema } from "@platform/builder-schema";
import { PersistenceError, type StudioDraftRow } from "@platform/persistence";
import type { StudioPersistence } from "./persistence";
import { runIdToSlug } from "./persistence";
import { persistGeneratedImages } from "./persist-generated-images";
import { productToDraftDocument } from "./product-to-draft";

/**
 * Hydrate the `studio_draft` row that backs a run with the assembled
 * UniversalProduct.
 *
 * # Where this fires
 *
 *   1. End of `runIntakePipeline` — converts the pipeline's freshly
 *      generated UniversalProduct into the canvas's DraftDocument
 *      shape so the operator sees populated sections in `/studio/drafts/<id>`.
 *   2. End of `runReplayAction` — re-runs also need to refresh the
 *      draft, otherwise a fixed-then-replayed pipeline leaves a stale
 *      empty payload behind.
 *
 * # Why this isn't done by the worker itself
 *
 * The `@platform/worker` package is the cross-store orchestrator —
 * Fanaa, future Shopify, future TikTokShop, all share it. The
 * studio_draft table and the DraftDocument shape are Studio-specific:
 * a TikTokShop drop wouldn't have a builder canvas at all. Keeping
 * the draft write in the Studio layer preserves that store/UX
 * boundary; the worker just returns the UniversalProduct and lets
 * each store-facing layer decide what to do with it.
 *
 * # Optimistic concurrency
 *
 * `savePayload({ expectedPayloadVersion: 0 })` writes ONLY when the
 * draft has never been edited (Prisma default `payloadVersion = 0`).
 * If the operator has touched the draft between dispatch and pipeline
 * completion (`payloadVersion > 0`), the save throws
 * `PersistenceError{conflict}` and we LOG-AND-SKIP rather than
 * clobber operator work. The status transition still fires so the
 * UI banner correctly flips to "ready".
 *
 * # Self-heal for stale-invalid payloads
 *
 * There's one nasty case the pure version check can't see: a
 * payload that was written BEFORE the schema validation gate
 * existed (commits before ba02b8b), or a payload written with a
 * since-tightened constraint. `payloadVersion` is >0 (so the lock
 * fires) but the payload itself can't even be parsed (so the GET
 * route silently falls back to a blank canvas and the operator
 * sees an empty editor). The optimistic lock then traps the draft
 * in a permanent broken state — every replay logs
 * "preserving operator edits" while the operator stares at a
 * payload they never actually edited.
 *
 * Fix: before honoring the lock, parse the existing payload
 * against `DraftDocumentSchema`. If it fails, there are no real
 * edits to preserve — the editor can't even render this row — so
 * we force-overwrite with `expectedPayloadVersion: -1` (the same
 * escape hatch the seed-write uses) and log the repair distinctly
 * so an operator scanning the journal can tell "AI replaced a
 * broken payload" from "AI clobbered my edits". Genuine valid
 * edits (the common case) are still preserved.
 *
 * # Failure semantics
 *
 * Every step is independently try/catch'd and routes failures through
 * the same `logSecondaryFail` pattern as dispatch-action.ts:
 *
 *   • Look-up failure   → log + return `{ status: "draft_not_found" }`
 *   • Save conflict     → log + still attempt status update
 *   • Save other error  → log + skip status update
 *   • Status / event    → log + return whatever progress was made
 *
 * The caller (pipeline-runner / replay-action) is expected to call
 * this helper inside its own try/catch as defense in depth — a
 * persistence write failure here MUST NOT cascade and abort the run.
 */
export type PersistDraftResult =
  | { status: "ok"; draftId: string; updated: boolean }
  | { status: "draft_not_found"; reason: string }
  | { status: "no_persistence"; reason: string }
  | { status: "skipped_conflict"; draftId: string }
  | { status: "invalid_payload"; draftId: string; reason: string }
  | { status: "error"; reason: string };

export interface PersistDraftOptions {
  runId: string;
  storeId: string;
  product: UniversalProduct;
  persistence: StudioPersistence;
  actor?: string;
}

export async function persistDraftFromProduct(
  opts: PersistDraftOptions,
): Promise<PersistDraftResult> {
  if (!opts.persistence.repositories) {
    return {
      status: "no_persistence",
      reason: "studio persistence has no repositories (file-only mode)",
    };
  }
  const repos = opts.persistence.repositories;
  const actor = opts.actor ?? "pipeline";
  const slug = runIdToSlug(opts.runId);

  let draft;
  try {
    draft = await repos.draft.findBySlug({
      storeId: opts.storeId,
      slug,
    });
  } catch (err) {
    return {
      status: "error",
      reason: `draft_lookup_failed:${errMessage(err)}`,
    };
  }

  if (!draft) {
    return {
      status: "draft_not_found",
      reason: `no studio_draft for storeId=${opts.storeId} slug=${slug}`,
    };
  }

  // ── Re-host AI-generated images to durable R2 storage ───────────
  //
  // The pipeline leaves `product.images[].src` as ephemeral vendor
  // URLs that expire (and never reach fanaa). Re-host them now — this
  // is the first point with BOTH the assembled product AND a draftId
  // AND the resolved MediaStore. Best-effort: any failure (or R2 not
  // configured) returns the product unchanged so the pipeline can
  // never regress. The rewritten `src` flows into the draft document
  // below and, on publish, into `storefront_catalog_product`.
  let product = opts.product;
  try {
    product = await persistGeneratedImages({
      product: opts.product,
      draftId: draft.id,
      storeId: opts.storeId,
      persistence: opts.persistence,
    });
  } catch (err) {
    console.warn(
      `[persist-draft-payload] persist_generated_images_failed draftId=${draft.id} runId=${opts.runId} error=${errMessage(err)} — proceeding with vendor URLs`,
    );
  }

  // Build the canvas payload. Section ids generated by a closure-local
  // counter — collision-free within this build since the canvas doesn't
  // share ids with other drafts.
  let counter = 0;
  const newId = (): string =>
    `sec_${Date.now().toString(36)}${(++counter).toString(36)}`;
  const document = productToDraftDocument(product, { slug, newId });
  const title = pickPreferredTitle(opts.product);

  // ── Validate payload BEFORE write ────────────────────────────────
  //
  // If the mapper produces a payload that doesn't pass
  // `DraftDocumentSchema`, the GET route's `coerceDocument` would
  // silently swap it for `makeBlankDraft()` — operator opens the
  // draft and sees an empty canvas with no indication anything went
  // wrong. We catch the problem here, write nothing, log the schema
  // issues, and return a typed result so the caller (pipeline-runner
  // / replay-action) can decide what to do.
  //
  // Status transition is intentionally skipped on invalid payload —
  // a "ready" badge with empty content is worse than the operator
  // staying in "intake/generating" until we ship a fixed mapper.
  const validation = DraftDocumentSchema.safeParse(document);
  if (!validation.success) {
    const issues = validation.error.issues
      .slice(0, 8)
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join(" | ");
    // eslint-disable-next-line no-console
    console.warn(
      `[persist-draft-payload] mapper_produced_invalid_payload draftId=${draft.id} runId=${opts.runId} productId=${opts.product.id} issues=${issues}`,
    );
    return {
      status: "invalid_payload",
      draftId: draft.id,
      reason: `schema_validation_failed: ${issues}`,
    };
  }

  // ── Decide write strategy: lock-respecting OR self-heal ──
  //
  // Default: optimistic lock at version 0 (safe — only writes if
  // the row has never been touched).
  //
  // Override: if the row IS touched (version > 0) BUT the stored
  // payload doesn't parse as a DraftDocument, that "version bump"
  // was a buggy historical write, not an operator edit. Bypass the
  // lock (`-1`) so the user isn't permanently stuck with a payload
  // that can't even be loaded into the editor.
  const expectedVersion = decideExpectedVersion(draft, opts.runId);

  // ── Payload write — respects operator edits via optimistic lock ──
  let payloadUpdated = false;
  try {
    await repos.draft.savePayload({
      id: draft.id,
      payload: document,
      expectedPayloadVersion: expectedVersion,
      title,
    });
    payloadUpdated = true;
  } catch (err) {
    if (err instanceof PersistenceError && err.kind === "conflict") {
      // eslint-disable-next-line no-console
      console.warn(
        `[persist-draft-payload] draft ${draft.id} has been edited (payloadVersion > 0) — preserving operator edits and skipping AI overwrite for runId=${opts.runId}`,
      );
      // Fall through to status update + event log so the UI still
      // transitions correctly even though the payload isn't refreshed.
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        `[persist-draft-payload] save_payload_failed draftId=${draft.id} runId=${opts.runId} error=${errMessage(err)}`,
      );
      return {
        status: "error",
        reason: `save_payload_failed:${errMessage(err)}`,
      };
    }
  }

  // ── Status transition — best-effort ──
  try {
    await repos.draft.updateStatus({ id: draft.id, status: "ready" });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[persist-draft-payload] update_status_failed draftId=${draft.id} runId=${opts.runId} error=${errMessage(err)}`,
    );
  }

  // ── Event log — pure audit; never blocks the result ──
  try {
    await repos.event.append({
      storeId: opts.storeId,
      draftId: draft.id,
      kind: "draft.ready",
      actor,
      payload: {
        runId: opts.runId,
        productId: opts.product.id,
        payloadUpdated,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[persist-draft-payload] append_event_failed draftId=${draft.id} runId=${opts.runId} error=${errMessage(err)}`,
    );
  }

  return {
    status: payloadUpdated ? "ok" : "skipped_conflict",
    draftId: draft.id,
    updated: payloadUpdated,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Pick the human-readable title written to `studio_draft.title`.
 *
 * Preference: AR > EN > existing intake-derived title (fallback).
 * Arabic-first because the GCC-buyer audience is the Studio's
 * primary persona; the operator reads the title in the drafts
 * browser and the Arabic register reads more naturally there.
 */
function pickPreferredTitle(product: UniversalProduct): string | undefined {
  return product.title.ar ?? product.title.en ?? undefined;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Pick the `expectedPayloadVersion` to pass to `savePayload`.
 *
 * Three branches:
 *
 *   1. `payloadVersion === 0` (never persisted) → write at `0`. Normal
 *      first-save case; lock is moot.
 *   2. `payloadVersion > 0` AND existing payload parses cleanly →
 *      treat as a real operator edit, write at `0` so the lock
 *      throws `conflict` and we skip the overwrite.
 *   3. `payloadVersion > 0` AND existing payload FAILS schema
 *      validation → treat as a stale-broken historical write,
 *      bypass the lock with `-1` and log the repair distinctly
 *      so it's auditable in the journal.
 *
 * Branch 3 is the self-heal path documented in the helper's JSDoc.
 * Without it, a single bad write from a pre-validation-gate era
 * (or any future tightening of `DraftDocumentSchema`) traps the
 * draft in a permanent dead state.
 */
function decideExpectedVersion(
  draft: StudioDraftRow,
  runId: string,
): number {
  if (draft.payloadVersion === 0) return 0;

  // Payload exists and version is bumped. Is it actually loadable?
  const existingValid = DraftDocumentSchema.safeParse(draft.payload).success;
  if (existingValid) return 0;

  // eslint-disable-next-line no-console
  console.warn(
    `[persist-draft-payload] self_heal_stale_invalid_payload draftId=${draft.id} runId=${runId} payloadVersion=${draft.payloadVersion} — existing payload fails schema, force-overwriting (no operator edits to preserve)`,
  );
  return -1;
}
