import { fanaaStore } from "@platform/stores";
import { PersistenceError } from "@platform/persistence";
import type { StudioPersistence } from "./persistence";
import {
  getStudioPersistence,
  runIdToSlug,
  storeConfigHash,
} from "./persistence";
import { validateIntake } from "./intake-validator";
import { platformDataRoot } from "./paths";
import { runIntakePipeline } from "./pipeline-runner";

/**
 * Intake dispatch — the server-side entry point that turns a validated
 * form into a running pipeline.
 *
 * # Background execution
 *
 * The pipeline is invoked WITHOUT awaiting. The dispatch function
 * returns the runId synchronously so the route can respond 202 and
 * the UI can navigate to `/runs/<id>` immediately. The pipeline's
 * progress is observed via the SSE endpoint, which tails the
 * RunRecord file the orchestrator writes.
 *
 * # Initial RunRecord
 *
 * We deliberately CREATE the RunRecord here, BEFORE handing off to
 * the pipeline runner. This guarantees the SSE watcher finds the
 * file even if the runner takes a few hundred ms to spin up the
 * provider chain. Without this seed, the watcher would hit
 * `not_found` for the first second or two and the UI would flash
 * an empty timeline.
 *
 * # M10 — draft seed + composite store
 *
 * When dual-write is enabled (`STUDIO_PERSISTENCE_MODE=dual`), the
 * dispatcher also:
 *
 *   1. Upserts the `studio_store` row (so the FK chain is satisfied).
 *   2. Creates the `studio_draft` row that the pipeline run will
 *      attach to. The slug is derived from `runId` for determinism.
 *   3. Appends a `draft.created` event for the audit log.
 *
 * If any DB write fails, dual-write is silently DEGRADED for this
 * one run — the file-backed RunStore is still used. Operators see
 * the failure in the warnings array logged at boot.
 *
 * # Why the background promise's rejection is caught silently
 *
 * Any failure inside the pipeline writes a `failed` RunRecord; the
 * SSE watcher surfaces it to the operator. An unhandled rejection
 * here would crash the Next.js dev server's worker, so we attach a
 * `.catch()` that records the error to the RunRecord as a last-resort
 * safety net.
 */
export type DispatchActionResult =
  | { status: "ok"; runId: string; draftId?: string }
  | { status: "invalid"; issues: Array<{ path: string; message: string }> };

export interface DispatchActionOptions {
  /** Override runtime config — tests pass a temp dataRoot. */
  dataRoot?: string;
  /** Inject a resolved persistence snapshot (tests). */
  persistence?: StudioPersistence;
  /** Actor email — defaults to "system" if no auth context available. */
  actor?: string;
}

export async function dispatchIntake(
  rawForm: unknown,
  opts: DispatchActionOptions = {},
): Promise<DispatchActionResult> {
  const validation = validateIntake(rawForm);
  if (validation.status !== "ok") {
    return { status: "invalid", issues: validation.issues };
  }

  const dataRoot = opts.dataRoot ?? platformDataRoot();
  const persistence =
    opts.persistence ?? getStudioPersistence({ dataRoot });
  const actor = opts.actor ?? "system";

  // ── DB seed: store + draft + event ─────────────────────────────
  let draftId: string | undefined;
  if (persistence.repositories) {
    const repos = persistence.repositories;
    try {
      // Idempotent — multiple intakes for the same store update
      // the configHash but don't conflict.
      await repos.store.upsert({
        id: validation.job.storeId,
        displayName: storeDisplayNameFor(validation.job.storeId),
        configHash: storeConfigHash(validation.job.storeId),
      });
    } catch (err) {
      logSecondaryFail("store_upsert", err);
    }
    try {
      const slug = runIdToSlug(validation.job.runId);
      const draft = await repos.draft.create({
        storeId: validation.job.storeId,
        slug,
        title: deriveTitleFromJob(validation.job.supplierUrl, slug),
        template: "default",
        supplierUrl: validation.job.supplierUrl,
        notes: validation.job.operatorNotes,
        positioning: validation.job.marginNotes,
        createdBy: actor,
      });
      draftId = draft.id;
      await repos.event.append({
        storeId: validation.job.storeId,
        draftId: draft.id,
        kind: "draft.created",
        actor,
        payload: { runId: validation.job.runId, slug },
      });
    } catch (err) {
      if (err instanceof PersistenceError && err.kind === "conflict") {
        // Slug collision — extremely unlikely (ULID-suffixed runId)
        // but possible if the operator hits "submit" twice in quick
        // succession. Fail soft; the pipeline still proceeds.
        logSecondaryFail("draft_create_conflict", err);
      } else {
        logSecondaryFail("draft_create", err);
      }
    }
  }

  // ── Run seed for SSE watcher ───────────────────────────────────
  // Always seeds via the resolved RunStore (composite when dual,
  // file otherwise). The SSE watcher tails the file primary so the
  // M9 behaviour is preserved end-to-end.
  await persistence.runStore.createRun({
    runId: validation.job.runId,
    job: validation.job,
    createdAt: validation.job.createdAt,
  });

  if (persistence.repositories) {
    try {
      await persistence.repositories.event.append({
        storeId: validation.job.storeId,
        draftId,
        kind: "run.dispatched",
        actor,
        payload: { runId: validation.job.runId },
      });
    } catch (err) {
      logSecondaryFail("run_dispatched_event", err);
    }
  }

  // ── Background pipeline ────────────────────────────────────────
  void runIntakePipeline({
    job: validation.job,
    dataRoot,
    runStore: persistence.runStore,
  }).catch(async (err) => {
    const message =
      err instanceof Error ? err.message : "intake_dispatch_unhandled_error";
    try {
      await persistence.runStore.markRunFailed(
        validation.job.runId,
        `dispatch_error:${message}`,
      );
    } catch {
      // best-effort
    }
  });

  return { status: "ok", runId: validation.job.runId, draftId };
}

// ─────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────

function storeDisplayNameFor(storeId: string): string {
  if (storeId === fanaaStore.id) return fanaaStore.displayName.en ?? storeId;
  return storeId;
}

function deriveTitleFromJob(supplierUrl: string, slug: string): string {
  // Best-effort title from the supplier URL. The strategy stage
  // produces a far better one; this is only the intake placeholder.
  try {
    const u = new URL(supplierUrl);
    const seg = u.pathname.split("/").filter(Boolean).pop() ?? slug;
    return decodeURIComponent(seg).slice(0, 200);
  } catch {
    return slug;
  }
}

function logSecondaryFail(op: string, err: unknown): void {
  if (typeof console === "undefined") return;
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.warn(`[dispatch_intake] secondary_op_failed op=${op} error=${message}`);
}
