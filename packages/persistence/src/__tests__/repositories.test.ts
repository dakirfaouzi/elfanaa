import { describe, expect, it } from "vitest";
import {
  StudioAssetRepository,
  StudioDraftRepository,
  StudioEventRepository,
  StudioRunRepository,
  StudioStoreRepository,
} from "../repositories";
import { PersistenceError } from "../contracts";
import {
  makeStudioDraftRow,
  makeStudioRunRow,
  makeStudioStepRow,
} from "./_helpers/fixtures";
import { dbErr, makeMockPrisma } from "./_helpers/mock-prisma";

describe("StudioStoreRepository.upsert", () => {
  it("calls prisma.studioStore.upsert with the right where/create/update", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioStore.upsert.mockResolvedValueOnce({
      id: "fanaa",
      displayName: "Fanaa",
      configHash: "h1",
      status: "live",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const repo = new StudioStoreRepository({ prisma });
    await repo.upsert({ id: "fanaa", displayName: "Fanaa", configHash: "h1" });
    const args = spies.studioStore.upsert.mock.calls[0]![0] as {
      where: { id: string };
      create: { id: string };
      update: { configHash: string };
    };
    expect(args.where.id).toBe("fanaa");
    expect(args.create.id).toBe("fanaa");
    expect(args.update.configHash).toBe("h1");
  });
});

describe("StudioDraftRepository", () => {
  it("create maps a DraftSeed into a Prisma create input", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioDraft.create.mockResolvedValueOnce(makeStudioDraftRow());
    const repo = new StudioDraftRepository({ prisma });
    await repo.create({
      storeId: "fanaa",
      slug: "test-product",
      title: "Test product",
      template: "default",
      supplierUrl: "https://example.com/x",
      createdBy: "admin@fanaa.com",
    });
    const args = spies.studioDraft.create.mock.calls[0]![0] as {
      data: { storeId: string; slug: string; supplierUrl: string; status: string };
    };
    expect(args.data.storeId).toBe("fanaa");
    expect(args.data.slug).toBe("test-product");
    expect(args.data.supplierUrl).toBe("https://example.com/x");
    expect(args.data.status).toBe("intake");
  });

  it("create maps P2002 to conflict error", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioDraft.create.mockRejectedValueOnce(
      dbErr("P2002", "unique_violation"),
    );
    const repo = new StudioDraftRepository({ prisma });
    try {
      await repo.create({
        storeId: "fanaa",
        slug: "dup",
        title: "x",
        template: "default",
      });
      expect.fail("expected throw");
    } catch (err) {
      expect((err as PersistenceError).kind).toBe("conflict");
    }
  });

  it("incrementCost reads then writes the new sum", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioDraft.findUnique.mockResolvedValueOnce(
      makeStudioDraftRow({ costCents: 25 }),
    );
    spies.studioDraft.update.mockResolvedValueOnce(makeStudioDraftRow());
    const repo = new StudioDraftRepository({ prisma });
    await repo.incrementCost({ id: "draft_x", deltaCents: 17 });
    const args = spies.studioDraft.update.mock.calls[0]![0] as {
      data: { costCents: number };
    };
    expect(args.data.costCents).toBe(42);
  });

  it("incrementCost throws not_found when draft is missing", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioDraft.findUnique.mockResolvedValueOnce(null);
    const repo = new StudioDraftRepository({ prisma });
    try {
      await repo.incrementCost({ id: "missing", deltaCents: 1 });
      expect.fail("expected throw");
    } catch (err) {
      expect((err as PersistenceError).kind).toBe("not_found");
    }
  });
});

describe("StudioAssetRepository", () => {
  it("create maps an AssetSeed to a Prisma create input", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioAsset.create.mockResolvedValueOnce({
      id: "a",
      draftId: "d",
      source: "upload",
      r2Bucket: "fanaa-assets",
      r2Key: "k",
      contentType: "image/png",
      bytes: 1,
      width: null,
      height: null,
      altAr: null,
      altEn: null,
      createdAt: new Date(),
    });
    const repo = new StudioAssetRepository({ prisma });
    await repo.create({
      draftId: "d",
      source: "upload",
      bucket: "fanaa-assets",
      key: "k",
      contentType: "image/png",
      bytes: 1,
    });
    const args = spies.studioAsset.create.mock.calls[0]![0] as {
      data: { r2Bucket: string; r2Key: string };
    };
    expect(args.data.r2Bucket).toBe("fanaa-assets");
    expect(args.data.r2Key).toBe("k");
  });

  it("listForDraft applies the source filter when provided", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioAsset.findMany.mockResolvedValueOnce([]);
    const repo = new StudioAssetRepository({ prisma });
    await repo.listForDraft({ draftId: "d", source: "generated" });
    const args = spies.studioAsset.findMany.mock.calls[0]![0] as {
      where: { draftId: string; source?: string };
    };
    expect(args.where.draftId).toBe("d");
    expect(args.where.source).toBe("generated");
  });
});

describe("StudioRunRepository.loadForReplay", () => {
  it("materialises a RunRecord from a row + joined steps", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioRun.findUnique.mockResolvedValueOnce(
      makeStudioRunRow({
        status: "succeeded",
        costCents: 75,
        steps: [makeStudioStepRow()],
      }),
    );
    const repo = new StudioRunRepository({ prisma });
    const record = await repo.loadForReplay("run_test_001");
    expect(record).not.toBeNull();
    expect(record?.status).toBe("completed");
    expect(record?.totalCostUsd).toBe(0.75);
    expect(record?.steps).toHaveLength(1);
  });

  it("returns null when the run is missing", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioRun.findUnique.mockResolvedValueOnce(null);
    const repo = new StudioRunRepository({ prisma });
    await expect(repo.loadForReplay("missing")).resolves.toBeNull();
  });
});

describe("StudioEventRepository", () => {
  it("append writes a row with null storeId/draftId when not supplied", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioEvent.create.mockResolvedValueOnce({
      id: "e",
      storeId: null,
      draftId: null,
      kind: "system.boot",
      actor: "system",
      payload: null,
      createdAt: new Date(),
    });
    const repo = new StudioEventRepository({ prisma });
    await repo.append({ kind: "system.boot", actor: "system" });
    const args = spies.studioEvent.create.mock.calls[0]![0] as {
      data: { storeId: string | null; draftId: string | null };
    };
    expect(args.data.storeId).toBeNull();
    expect(args.data.draftId).toBeNull();
  });
});
