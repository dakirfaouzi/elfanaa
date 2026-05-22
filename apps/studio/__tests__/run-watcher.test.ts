import { describe, expect, it } from "vitest";
import { watchRun, type RunWatcherEvent } from "../lib/studio/run-watcher";
import type { RunRecord, StepRecord } from "@platform/ingest";
import type { RunLoadResult } from "../lib/studio/run-loader";
import { fixtureRunRecord } from "./_helpers/fixture-bundle";

/**
 * Tests for the polling run-watcher.
 *
 * The watcher is the heart of the SSE stream. We test it as a pure
 * async generator by injecting a synthetic `readFn` that returns
 * scripted RunLoadResults plus an injected `sleepFn` that resolves
 * instantly — no wall-clock waits.
 *
 * Coverage:
 *   1. First read emits `snapshot`.
 *   2. New steps emit `step` events in order.
 *   3. Terminal status (`completed`/`failed`/`cancelled`) emits a
 *      `terminal` event and the generator returns.
 *   4. Status change without a new step emits `status`.
 *   5. `not_found` after awaitMs emits `not_found` and returns.
 *   6. `corrupted` result emits `corrupted` and returns.
 *   7. AbortSignal stops the loop without emitting more events.
 */

function step(stage: string, status: StepRecord["status"] = "success"): StepRecord {
  return {
    stage,
    status,
    startedAt: "2026-05-22T10:00:00.000Z",
    finishedAt: "2026-05-22T10:00:01.000Z",
    durationMs: 1000,
    attempts: 1,
    costUsd: 0.01,
  };
}

function snapshotRun(steps: StepRecord[], status: RunRecord["status"]): RunRecord {
  const base = fixtureRunRecord();
  return {
    ...base,
    steps,
    status,
    totalCostUsd: steps.reduce((s, x) => s + x.costUsd, 0),
    finalProduct: status === "completed" ? base.finalProduct : undefined,
  };
}

async function collect(
  gen: AsyncGenerator<RunWatcherEvent, void, void>,
): Promise<RunWatcherEvent[]> {
  const out: RunWatcherEvent[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

describe("watchRun", () => {
  it("emits snapshot → step → step → terminal for a happy run", async () => {
    const sequence: RunLoadResult[] = [
      { status: "ok", run: snapshotRun([step("research")], "running"), filePath: "x" },
      {
        status: "ok",
        run: snapshotRun([step("research"), step("vision")], "running"),
        filePath: "x",
      },
      {
        status: "ok",
        run: snapshotRun(
          [step("research"), step("vision"), step("strategy")],
          "completed",
        ),
        filePath: "x",
      },
    ];
    let i = 0;
    const events = await collect(
      watchRun({
        runId: "run_test",
        readFn: async () => sequence[i++] ?? sequence[sequence.length - 1],
        sleepFn: async () => undefined,
        pollMs: 0,
        awaitMs: 0,
      }),
    );

    const types = events.map((e) => e.type);
    expect(types[0]).toBe("snapshot");
    expect(types).toContain("step");
    expect(types[types.length - 1]).toBe("terminal");
    // Two distinct new steps after the snapshot.
    expect(events.filter((e) => e.type === "step")).toHaveLength(2);
    expect(events.filter((e) => e.type === "step").map((e) => e.step!.stage)).toEqual(
      ["vision", "strategy"],
    );
  });

  it("emits `corrupted` and resolves when the read returns corrupted", async () => {
    const events = await collect(
      watchRun({
        runId: "run_test",
        readFn: async () => ({
          status: "corrupted",
          runId: "run_test",
          filePath: "x",
          reason: "invalid_json",
        }),
        sleepFn: async () => undefined,
        awaitMs: 0,
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("corrupted");
    expect(events[0].reason).toBe("invalid_json");
  });

  it("emits `not_found` after the await window expires", async () => {
    let calls = 0;
    const events = await collect(
      watchRun({
        runId: "run_test",
        readFn: async () => {
          calls++;
          return { status: "not_found", runId: "run_test" };
        },
        sleepFn: async () => undefined,
        awaitMs: 0, // immediately gives up on the FIRST miss
        pollMs: 0,
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("not_found");
    expect(calls).toBeGreaterThanOrEqual(1);
  });

  it("emits `status` when the run flips status without a new step", async () => {
    const oneStep = [step("research")];
    const sequence: RunLoadResult[] = [
      { status: "ok", run: snapshotRun(oneStep, "running"), filePath: "x" },
      { status: "ok", run: snapshotRun(oneStep, "cancelled"), filePath: "x" },
    ];
    let i = 0;
    const events = await collect(
      watchRun({
        runId: "run_test",
        readFn: async () => sequence[i++] ?? sequence[sequence.length - 1],
        sleepFn: async () => undefined,
        pollMs: 0,
        awaitMs: 0,
      }),
    );
    // snapshot + status + terminal
    const types = events.map((e) => e.type);
    expect(types).toEqual(["snapshot", "status", "terminal"]);
    expect(events[1].status).toBe("cancelled");
  });

  it("honours AbortSignal — stops without emitting more events", async () => {
    const controller = new AbortController();
    const run = snapshotRun([step("research")], "running");
    let calls = 0;
    const gen = watchRun({
      runId: "run_test",
      signal: controller.signal,
      readFn: async () => {
        calls++;
        if (calls === 2) controller.abort();
        return { status: "ok", run, filePath: "x" };
      },
      sleepFn: async () => undefined,
      pollMs: 0,
      awaitMs: 0,
    });
    const events: RunWatcherEvent[] = [];
    for await (const ev of gen) events.push(ev);
    // Snapshot fires, then abort kicks in before a non-terminal poll
    // can yield more events.
    expect(events[0].type).toBe("snapshot");
    // Must NOT contain a terminal event because we never reached one.
    expect(events.some((e) => e.type === "terminal")).toBe(false);
  });
});
