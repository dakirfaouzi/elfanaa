import { describe, expect, it, vi } from "vitest";
import { PrismaRunStore } from "../prisma-run-store";
import { PersistenceError } from "../contracts";
import {
  makeIngestJob,
  makeStepRecord,
  makeStudioRunRow,
  makeStudioStepRow,
} from "./_helpers/fixtures";
import { dbErr, makeMockPrisma } from "./_helpers/mock-prisma";

/**
 * Tests for `PrismaRunStore` — the M6 RunStore contract implemented
 * against `PrismaLike`. We exercise:
 *
 *   1. createRun       — calls upsert, resolves draftId, fails when
 *                        draft missing.
 *   2. markRunStarted  — sets status=running + startedAt.
 *   3. appendStep      — looks up parent run, calls studioStep.create.
 *   4. appendCosts     — increments costCents on the run row.
 *   5. markRunComplete / markRunFailed — terminal updates.
 *   6. getRun / listRuns — read materialisation.
 *   7. Prisma error codes (P2025, P2002) → PersistenceError.kind.
 */

function makeStore(opts: { draftId?: string | null } = {}) {
  const { prisma, spies } = makeMockPrisma();
  // Honour an explicit `null` (means "draft not found") vs. an
  // omitted key (default to the test draft).
  const resolved =
    "draftId" in opts ? opts.draftId : "draft_pk_001";
  const store = new PrismaRunStore({
    prisma,
    draftIdResolver: vi.fn(async () => resolved ?? null),
  });
  return { store, prisma, spies };
}

describe("PrismaRunStore.createRun", () => {
  it("upserts a run row keyed by runId", async () => {
    const { store, spies } = makeStore();
    spies.studioRun.upsert.mockResolvedValueOnce(makeStudioRunRow());
    const job = makeIngestJob({ runId: "run_xyz" });
    const result = await store.createRun({
      runId: "run_xyz",
      job,
      createdAt: "2026-05-22T10:00:00.000Z",
    });
    expect(spies.studioRun.upsert).toHaveBeenCalledOnce();
    const args = spies.studioRun.upsert.mock.calls[0]![0] as {
      where: { runId: string };
      create: { runId: string; draftId: string };
    };
    expect(args.where.runId).toBe("run_xyz");
    expect(args.create.runId).toBe("run_xyz");
    expect(args.create.draftId).toBe("draft_pk_001");
    expect(result.runId).toBe("run_xyz");
    expect(result.status).toBe("pending");
  });

  it("throws PersistenceError{not_found} when draft resolution returns null", async () => {
    const { store } = makeStore({ draftId: null });
    await expect(
      store.createRun({
        runId: "run_xyz",
        job: makeIngestJob(),
        createdAt: "2026-05-22T10:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(PersistenceError);
    try {
      await store.createRun({
        runId: "run_xyz",
        job: makeIngestJob(),
        createdAt: "2026-05-22T10:00:00.000Z",
      });
    } catch (err) {
      expect((err as PersistenceError).kind).toBe("not_found");
    }
  });

  it("maps Prisma P2002 → PersistenceError{conflict}", async () => {
    const { store, spies } = makeStore();
    spies.studioRun.upsert.mockRejectedValueOnce(
      dbErr("P2002", "unique_violation"),
    );
    try {
      await store.createRun({
        runId: "run_xyz",
        job: makeIngestJob(),
        createdAt: "2026-05-22T10:00:00.000Z",
      });
      expect.fail("expected throw");
    } catch (err) {
      expect((err as PersistenceError).kind).toBe("conflict");
    }
  });
});

describe("PrismaRunStore.markRunStarted", () => {
  it("updates status=running + startedAt", async () => {
    const { store, spies } = makeStore();
    spies.studioRun.update.mockResolvedValueOnce(makeStudioRunRow());
    await store.markRunStarted("run_xyz");
    const args = spies.studioRun.update.mock.calls[0]![0] as {
      where: { runId: string };
      data: { status: string; startedAt: Date };
    };
    expect(args.where.runId).toBe("run_xyz");
    expect(args.data.status).toBe("running");
    expect(args.data.startedAt).toBeInstanceOf(Date);
  });

  it("maps P2025 → PersistenceError{not_found}", async () => {
    const { store, spies } = makeStore();
    spies.studioRun.update.mockRejectedValueOnce(
      dbErr("P2025", "record_not_found"),
    );
    try {
      await store.markRunStarted("run_xyz");
      expect.fail("expected throw");
    } catch (err) {
      expect((err as PersistenceError).kind).toBe("not_found");
    }
  });
});

describe("PrismaRunStore.appendStep", () => {
  it("looks up the parent run + writes the step with prisma run PK", async () => {
    const { store, spies } = makeStore();
    spies.studioRun.findUnique.mockResolvedValueOnce(
      makeStudioRunRow({ id: "run_pk_xyz" }),
    );
    spies.studioStep.create.mockResolvedValueOnce(makeStudioStepRow());
    await store.appendStep("run_xyz", makeStepRecord());
    expect(spies.studioStep.create).toHaveBeenCalledOnce();
    const args = spies.studioStep.create.mock.calls[0]![0] as {
      data: { runId: string; kind: string; status: string };
    };
    expect(args.data.runId).toBe("run_pk_xyz");
    expect(args.data.kind).toBe("research");
    expect(args.data.status).toBe("succeeded");
  });

  it("throws not_found when the run row is absent", async () => {
    const { store, spies } = makeStore();
    spies.studioRun.findUnique.mockResolvedValueOnce(null);
    try {
      await store.appendStep("run_xyz", makeStepRecord());
      expect.fail("expected throw");
    } catch (err) {
      expect((err as PersistenceError).kind).toBe("not_found");
    }
  });
});

describe("PrismaRunStore.appendCosts", () => {
  it("increments costCents on the run row by the sum of all cost rows", async () => {
    const { store, spies } = makeStore();
    spies.studioRun.findUnique.mockResolvedValueOnce(
      makeStudioRunRow({ costCents: 25 }),
    );
    spies.studioRun.update.mockResolvedValueOnce(makeStudioRunRow());
    await store.appendCosts("run_xyz", [
      {
        runId: "run_xyz",
        stage: "research",
        capability: "text",
        providerId: "anthropic",
        costUsd: 0.12,
        latencyMs: 100,
        timestamp: "2026-05-22T10:00:00.000Z",
      },
      {
        runId: "run_xyz",
        stage: "research",
        capability: "text",
        providerId: "anthropic",
        costUsd: 0.05,
        latencyMs: 90,
        timestamp: "2026-05-22T10:00:01.000Z",
      },
    ]);
    const args = spies.studioRun.update.mock.calls[0]![0] as {
      where: { runId: string };
      data: { costCents: number };
    };
    expect(args.where.runId).toBe("run_xyz");
    // 25 + 12 + 5 = 42 cents
    expect(args.data.costCents).toBe(42);
  });

  it("is a no-op when costs[] is empty", async () => {
    const { store, spies } = makeStore();
    await store.appendCosts("run_xyz", []);
    expect(spies.studioRun.update).not.toHaveBeenCalled();
  });
});

describe("PrismaRunStore.markRunComplete / markRunFailed", () => {
  it("markRunComplete sets succeeded + finishedAt", async () => {
    const { store, spies } = makeStore();
    spies.studioRun.update.mockResolvedValueOnce(makeStudioRunRow());
    // markRunComplete uses a UniversalProduct param but doesn't
    // persist it in M10 (publisher writes JSON). We pass a minimal
    // object so the test compiles.
    await store.markRunComplete("run_xyz", {} as never);
    const args = spies.studioRun.update.mock.calls[0]![0] as {
      data: { status: string; finishedAt: Date };
    };
    expect(args.data.status).toBe("succeeded");
    expect(args.data.finishedAt).toBeInstanceOf(Date);
  });

  it("markRunFailed sets failed + finishedAt + errorMessage", async () => {
    const { store, spies } = makeStore();
    spies.studioRun.update.mockResolvedValueOnce(makeStudioRunRow());
    await store.markRunFailed("run_xyz", "boom");
    const args = spies.studioRun.update.mock.calls[0]![0] as {
      data: { status: string; errorMessage: string };
    };
    expect(args.data.status).toBe("failed");
    expect(args.data.errorMessage).toBe("boom");
  });
});

describe("PrismaRunStore.getRun + listRuns", () => {
  it("getRun materialises a RunRecord with joined steps", async () => {
    const { store, spies } = makeStore();
    spies.studioRun.findUnique.mockResolvedValueOnce(
      makeStudioRunRow({
        status: "succeeded",
        costCents: 75,
        steps: [makeStudioStepRow()],
      }),
    );
    const record = await store.getRun("run_xyz");
    expect(record).not.toBeNull();
    expect(record?.status).toBe("completed");
    expect(record?.totalCostUsd).toBe(0.75);
    expect(record?.steps).toHaveLength(1);
  });

  it("getRun returns null when the row is missing", async () => {
    const { store, spies } = makeStore();
    spies.studioRun.findUnique.mockResolvedValueOnce(null);
    await expect(store.getRun("missing")).resolves.toBeNull();
  });

  it("listRuns applies storeId + status filters after fetch", async () => {
    const { store, spies } = makeStore();
    const rowA = makeStudioRunRow({
      id: "pk_A",
      runId: "run_A",
      status: "succeeded",
      inputSnapshot: makeIngestJob({ runId: "run_A", storeId: "fanaa" }),
    });
    const rowB = makeStudioRunRow({
      id: "pk_B",
      runId: "run_B",
      status: "failed",
      inputSnapshot: makeIngestJob({ runId: "run_B", storeId: "trendora" }),
    });
    spies.studioRun.findMany.mockResolvedValueOnce([rowA, rowB]);
    const filtered = await store.listRuns({ storeId: "fanaa", limit: 10 });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.storeId).toBe("fanaa");
  });
});
