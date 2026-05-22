import { describe, expect, it, vi } from "vitest";
import { CompositeRunStore } from "../composite-run-store";
import type {
  CostRow,
  NewRunRecord,
  RunRecord,
  RunStore,
  StepRecord,
} from "@platform/ingest/store";
import {
  makeIngestJob,
  makeRunRecord,
  makeStepRecord,
} from "./_helpers/fixtures";

/**
 * Composite store dual-writes to two RunStore implementations.
 * We verify:
 *   • Every write reaches BOTH stores in order.
 *   • Reads come from the primary only.
 *   • Secondary failures DO NOT propagate; they're surfaced via
 *     `onSecondaryError`.
 *   • Primary failures DO propagate.
 */

function makeStoreSpy(): RunStore & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async createRun(record: NewRunRecord): Promise<RunRecord> {
      calls.push(`createRun:${record.runId}`);
      return makeRunRecord({ job: record.job, runId: record.runId });
    },
    async markRunStarted(runId: string): Promise<void> {
      calls.push(`markRunStarted:${runId}`);
    },
    async appendStep(runId: string, step: StepRecord): Promise<void> {
      calls.push(`appendStep:${runId}:${step.stage}`);
    },
    async appendCosts(runId: string, costs: CostRow[]): Promise<void> {
      calls.push(`appendCosts:${runId}:${costs.length}`);
    },
    async markRunComplete(runId: string): Promise<void> {
      calls.push(`markRunComplete:${runId}`);
    },
    async markRunFailed(runId: string, msg: string): Promise<void> {
      calls.push(`markRunFailed:${runId}:${msg}`);
    },
    async getRun(runId: string): Promise<RunRecord | null> {
      calls.push(`getRun:${runId}`);
      return makeRunRecord({ runId });
    },
    async listRuns(): Promise<RunRecord[]> {
      calls.push("listRuns");
      return [];
    },
  };
}

describe("CompositeRunStore", () => {
  it("forwards every write to BOTH primary and secondary", async () => {
    const primary = makeStoreSpy();
    const secondary = makeStoreSpy();
    const composite = new CompositeRunStore({ primary, secondary });
    const newRec: NewRunRecord = {
      runId: "run_a",
      job: makeIngestJob({ runId: "run_a" }),
      createdAt: "2026-05-22T10:00:00.000Z",
    };
    await composite.createRun(newRec);
    await composite.markRunStarted("run_a");
    await composite.appendStep("run_a", makeStepRecord());
    await composite.appendCosts("run_a", []);
    await composite.markRunComplete("run_a", {} as never);
    await composite.markRunFailed("run_a", "boom");

    // Every write should be on both stores (6 ops each).
    expect(primary.calls).toEqual([
      "createRun:run_a",
      "markRunStarted:run_a",
      "appendStep:run_a:research",
      "appendCosts:run_a:0",
      "markRunComplete:run_a",
      "markRunFailed:run_a:boom",
    ]);
    expect(secondary.calls).toEqual(primary.calls);
  });

  it("reads only from the primary store", async () => {
    const primary = makeStoreSpy();
    const secondary = makeStoreSpy();
    const composite = new CompositeRunStore({ primary, secondary });
    await composite.getRun("run_a");
    await composite.listRuns();
    expect(primary.calls).toEqual(["getRun:run_a", "listRuns"]);
    expect(secondary.calls).toEqual([]);
  });

  it("absorbs secondary failures and invokes onSecondaryError", async () => {
    const primary = makeStoreSpy();
    const secondary = makeStoreSpy();
    secondary.appendStep = async () => {
      throw new Error("secondary_db_offline");
    };
    const reporter = vi.fn();
    const composite = new CompositeRunStore({
      primary,
      secondary,
      onSecondaryError: reporter,
    });
    await composite.appendStep("run_a", makeStepRecord());
    expect(primary.calls).toEqual(["appendStep:run_a:research"]);
    expect(reporter).toHaveBeenCalledOnce();
    expect(reporter.mock.calls[0]![0]).toBe("appendStep");
    expect((reporter.mock.calls[0]![1] as Error).message).toBe(
      "secondary_db_offline",
    );
  });

  it("propagates primary failures even when secondary would succeed", async () => {
    const primary = makeStoreSpy();
    primary.appendStep = async () => {
      throw new Error("primary_full");
    };
    const secondary = makeStoreSpy();
    const composite = new CompositeRunStore({ primary, secondary });
    await expect(
      composite.appendStep("run_a", makeStepRecord()),
    ).rejects.toThrow(/primary_full/);
    // Primary failure → secondary should NOT be called.
    expect(secondary.calls).toEqual([]);
  });
});
