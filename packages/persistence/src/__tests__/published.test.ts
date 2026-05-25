import { describe, expect, it } from "vitest";
import { StudioPublishedProductRepository } from "../repositories/published";
import { makeMockPrisma, dbErr } from "./_helpers/mock-prisma";
import type { StudioPublishedProductRow } from "../contracts";

function makeRow(over: Partial<StudioPublishedProductRow> = {}): StudioPublishedProductRow {
  return {
    id: "pp_1",
    draftId: "draft_1",
    storeId: "fanaa",
    slug: "glow-serum",
    version: 1,
    isCurrent: true,
    document: { version: 1, meta: {}, sections: [] },
    publishedBy: "system",
    publishedAt: new Date("2026-05-22T10:00:00Z"),
    ...over,
  };
}

describe("StudioPublishedProductRepository", () => {
  it("publishes a fresh slug as version 1", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioPublishedProduct.findMany.mockResolvedValueOnce([]);
    spies.studioPublishedProduct.create.mockResolvedValueOnce(makeRow());
    const repo = new StudioPublishedProductRepository({ prisma });
    const result = await repo.publish({
      draftId: "draft_1",
      storeId: "fanaa",
      slug: "glow-serum",
      document: { version: 1, meta: {}, sections: [] },
    });
    expect(result.prior).toBeNull();
    expect(result.row.version).toBe(1);
    expect(spies.studioPublishedProduct.create).toHaveBeenCalledTimes(1);
    const createArgs = spies.studioPublishedProduct.create.mock.calls[0][0] as {
      data: { version: number; isCurrent: boolean };
    };
    expect(createArgs.data.version).toBe(1);
    expect(createArgs.data.isCurrent).toBe(true);
  });

  it("flips prior current row to non-current and bumps version", async () => {
    const { prisma, spies } = makeMockPrisma();
    const last = makeRow({ version: 2, isCurrent: true });
    spies.studioPublishedProduct.findMany.mockResolvedValueOnce([last]);
    spies.studioPublishedProduct.deleteMany.mockResolvedValueOnce({ count: 0 });
    spies.studioPublishedProduct.upsert.mockResolvedValueOnce({
      ...last,
      isCurrent: false,
    });
    spies.studioPublishedProduct.create.mockResolvedValueOnce(
      makeRow({ version: 3 }),
    );
    const repo = new StudioPublishedProductRepository({ prisma });
    const result = await repo.publish({
      draftId: "draft_1",
      storeId: "fanaa",
      slug: "glow-serum",
      document: { version: 1, meta: {}, sections: [] },
    });
    expect(result.prior?.version).toBe(2);
    expect(result.row.version).toBe(3);
    expect(spies.studioPublishedProduct.upsert).toHaveBeenCalledTimes(1);
  });

  it("findCurrent returns the latest isCurrent row", async () => {
    const { prisma, spies } = makeMockPrisma();
    const row = makeRow();
    spies.studioPublishedProduct.findFirst.mockResolvedValueOnce(row);
    const repo = new StudioPublishedProductRepository({ prisma });
    const found = await repo.findCurrent({
      storeId: "fanaa",
      slug: "glow-serum",
    });
    expect(found?.id).toBe("pp_1");
  });

  it("findCurrent returns null when nothing is published", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioPublishedProduct.findFirst.mockResolvedValueOnce(null);
    const repo = new StudioPublishedProductRepository({ prisma });
    const found = await repo.findCurrent({ storeId: "fanaa", slug: "x" });
    expect(found).toBeNull();
  });

  it("maps P2002 conflict to PersistenceError{conflict}", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioPublishedProduct.findMany.mockResolvedValueOnce([]);
    spies.studioPublishedProduct.create.mockRejectedValueOnce(
      dbErr("P2002", "duplicate"),
    );
    const repo = new StudioPublishedProductRepository({ prisma });
    await expect(
      repo.publish({
        draftId: "draft_1",
        storeId: "fanaa",
        slug: "glow-serum",
        document: {},
      }),
    ).rejects.toMatchObject({ kind: "conflict" });
  });

  // C3.1 — listCurrent powers /products by surfacing every isCurrent
  // row for a store. The query MUST: (a) filter on isCurrent=true so
  // dethroned versions stay hidden, (b) sort by publishedAt DESC so
  // the catalog reads "newest first", (c) clamp `take` to a sane
  // ceiling to keep a runaway list bounded.
  it("listCurrent returns isCurrent rows ordered by publishedAt desc", async () => {
    const { prisma, spies } = makeMockPrisma();
    const rows = [
      makeRow({
        id: "pp_2",
        slug: "newer",
        publishedAt: new Date("2026-05-25T10:00:00Z"),
      }),
      makeRow({
        id: "pp_1",
        slug: "older",
        publishedAt: new Date("2026-05-22T10:00:00Z"),
      }),
    ];
    spies.studioPublishedProduct.findMany.mockResolvedValueOnce(rows);
    const repo = new StudioPublishedProductRepository({ prisma });
    const result = await repo.listCurrent({ storeId: "fanaa" });

    expect(result).toHaveLength(2);
    expect(result[0]?.slug).toBe("newer");
    const callArgs = spies.studioPublishedProduct.findMany.mock.calls[0][0] as {
      where: { storeId: string; isCurrent: boolean };
      orderBy: { publishedAt: string };
      take: number;
    };
    expect(callArgs.where).toEqual({ storeId: "fanaa", isCurrent: true });
    expect(callArgs.orderBy).toEqual({ publishedAt: "desc" });
    expect(callArgs.take).toBe(200);
  });

  it("listCurrent clamps `take` to 500", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioPublishedProduct.findMany.mockResolvedValueOnce([]);
    const repo = new StudioPublishedProductRepository({ prisma });
    await repo.listCurrent({ storeId: "fanaa", take: 5_000 });
    const callArgs = spies.studioPublishedProduct.findMany.mock.calls[0][0] as {
      take: number;
    };
    expect(callArgs.take).toBe(500);
  });

  it("listCurrent maps DB errors to PersistenceError{unknown}", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioPublishedProduct.findMany.mockRejectedValueOnce(
      new Error("conn lost"),
    );
    const repo = new StudioPublishedProductRepository({ prisma });
    await expect(repo.listCurrent({ storeId: "fanaa" })).rejects.toMatchObject({
      kind: "unknown",
    });
  });
});
