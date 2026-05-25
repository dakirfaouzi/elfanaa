import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetStudioPersistenceCache,
  getStudioPersistence,
} from "../lib/studio/persistence";
import {
  createDraft,
  getDraft,
  listDrafts,
  listPublishedProducts,
  normaliseSlug,
  publishDraft,
  rowToListItem,
  updateDraftDocument,
} from "../lib/studio/drafts-service";
import { makeBlankDraft } from "@platform/builder-schema";

/**
 * Drafts-service tests against an injected fake PrismaClient.
 *
 * We exercise the dual-write path end-to-end (sans real Postgres)
 * to prove:
 *   • Draft creation seeds the payload + emits the event.
 *   • Update enforces optimistic concurrency.
 *   • Publish rejects invalid drafts.
 *   • Publish succeeds when validation passes.
 *
 * The fake PrismaClient is an in-memory implementation that satisfies
 * the `PrismaLike` shape. It mirrors only the operations exercised
 * here — see packages/persistence/__tests__/ for full coverage of
 * the persistence layer.
 */

let idCounter = 0;
function id() {
  idCounter += 1;
  return `sec_${idCounter}`;
}

beforeEach(() => {
  __resetStudioPersistenceCache();
  idCounter = 0;
});
afterEach(() => {
  __resetStudioPersistenceCache();
});

function makeFakePrisma(): NonNullable<
  Parameters<typeof getStudioPersistence>[0]
>["prismaClient"] {
  type Row = { [k: string]: unknown };
  const tables = {
    studioStore: new Map<string, Row>(),
    studioDraft: new Map<string, Row>(),
    studioRun: new Map<string, Row>(),
    studioStep: new Map<string, Row>(),
    studioAsset: new Map<string, Row>(),
    studioEvent: new Map<string, Row>(),
    studioPublishedProduct: new Map<string, Row>(),
    studioArtifact: new Map<string, Row>(),
  };

  function clone<T extends Row>(r: T): T {
    const out: Row = {};
    for (const [k, v] of Object.entries(r)) {
      if (v instanceof Date) out[k] = new Date(v.getTime());
      else if (v && typeof v === "object") out[k] = JSON.parse(JSON.stringify(v));
      else out[k] = v;
    }
    return out as T;
  }

  let pk = 1;
  function nextPk(prefix: string) {
    return `${prefix}_${pk++}`;
  }

  function applyDefaults(name: keyof typeof tables, data: Row): Row {
    if (name === "studioDraft") {
      return {
        payloadVersion: 0,
        costCents: 0,
        publishedAt: null,
        publishedRef: null,
        supplierUrl: null,
        notes: null,
        positioning: null,
        payload: null,
        ...data,
      };
    }
    if (name === "studioPublishedProduct") {
      return { isCurrent: false, publishedAt: new Date(), ...data };
    }
    return data;
  }

  function makeDelegate(name: keyof typeof tables, prefix: string) {
    const map = tables[name];
    return {
      async create(args: { data: Row }) {
        const id = (args.data.id as string) ?? nextPk(prefix);
        const row = {
          ...applyDefaults(name, args.data),
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Row;
        map.set(id, row);
        return clone(row);
      },
      async update(args: { where: { id?: string }; data: Row }) {
        const id = args.where.id!;
        const existing = map.get(id);
        if (!existing) throw withCode("P2025");
        const next = { ...existing, ...args.data, updatedAt: new Date() };
        map.set(id, next);
        return clone(next);
      },
      async upsert(args: {
        where: { id?: string; storeId_slug_version?: { storeId: string; slug: string; version: number } };
        create: Row;
        update: Row;
      }) {
        let key: string | undefined = args.where.id;
        if (!key && args.where.storeId_slug_version) {
          const k = args.where.storeId_slug_version;
          for (const [id, row] of map) {
            if (
              row.storeId === k.storeId &&
              row.slug === k.slug &&
              row.version === k.version
            ) {
              key = id;
              break;
            }
          }
        }
        if (key && map.has(key)) {
          const existing = map.get(key)!;
          const next = { ...existing, ...args.update, updatedAt: new Date() };
          map.set(key, next);
          return clone(next);
        }
        const id = (args.create.id as string) ?? nextPk(prefix);
        const row = {
          ...args.create,
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        map.set(id, row);
        return clone(row);
      },
      async findUnique(args: {
        where: { id?: string; storeId_slug?: { storeId: string; slug: string }; r2Key?: string };
      }) {
        if (args.where.id) {
          const r = map.get(args.where.id);
          return r ? clone(r) : null;
        }
        if (args.where.storeId_slug) {
          const k = args.where.storeId_slug;
          for (const r of map.values()) {
            if (r.storeId === k.storeId && r.slug === k.slug) return clone(r);
          }
          return null;
        }
        if (args.where.r2Key) {
          for (const r of map.values()) {
            if (r.r2Key === args.where.r2Key) return clone(r);
          }
          return null;
        }
        return null;
      },
      async findFirst(args: { where: Row; orderBy?: Row }) {
        const where = args.where ?? {};
        const matches = [...map.values()].filter((r) =>
          Object.entries(where).every(([k, v]) => r[k] === v),
        );
        return matches.length ? clone(matches[0]!) : null;
      },
      async findMany(args: { where?: Row; orderBy?: Row; take?: number } = {}) {
        const where = (args.where ?? {}) as Record<string, unknown>;
        const result = [...map.values()].filter((r) =>
          Object.entries(where).every(([k, v]) => {
            if (v && typeof v === "object" && "lt" in (v as Row)) {
              const lt = (v as { lt: Date }).lt;
              return (r[k] as Date) < lt;
            }
            return r[k] === v;
          }),
        );
        return result.slice(0, args.take ?? result.length).map(clone);
      },
      async count(args: { where?: Row } = {}) {
        return [...map.values()].length;
      },
      async delete(args: { where: { id: string } }) {
        const r = map.get(args.where.id);
        if (!r) throw withCode("P2025");
        map.delete(args.where.id);
        return clone(r);
      },
      async deleteMany(args: { where?: Row } = {}) {
        const where = args.where ?? {};
        let count = 0;
        for (const [id, r] of [...map.entries()]) {
          if (Object.entries(where).every(([k, v]) => r[k] === v)) {
            map.delete(id);
            count += 1;
          }
        }
        return { count };
      },
    };
  }

  const client = {
    studioStore: makeDelegate("studioStore", "store"),
    studioDraft: makeDelegate("studioDraft", "draft"),
    studioRun: makeDelegate("studioRun", "run"),
    studioStep: makeDelegate("studioStep", "step"),
    studioAsset: makeDelegate("studioAsset", "asset"),
    studioEvent: makeDelegate("studioEvent", "event"),
    studioPublishedProduct: makeDelegate("studioPublishedProduct", "pp"),
    studioArtifact: makeDelegate("studioArtifact", "art"),
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      return fn(client);
    },
  };
  return client as unknown as NonNullable<
    Parameters<typeof getStudioPersistence>[0]
  >["prismaClient"];
}

function withCode(code: string): Error & { code: string } {
  const e = new Error(code) as Error & { code: string };
  e.code = code;
  return e;
}

function bootstrapPersistence() {
  const prisma = makeFakePrisma();
  getStudioPersistence({
    env: {
      STUDIO_PERSISTENCE_MODE: "dual",
      ADMIN_DATABASE_URL: "postgresql://u@h/d",
    },
    prismaClient: prisma,
    dataRoot: ".tmp-platform-data",
  });
  return prisma;
}

describe("drafts-service", () => {
  it("normaliseSlug enforces the canonical shape", () => {
    expect(normaliseSlug("  Glow Serum 2x  ")).toBe("glow-serum-2x");
    expect(normaliseSlug("---abc!!!def---")).toBe("abc-def");
    expect(normaliseSlug("")).toBe("");
  });

  it("create + read + list works against the fake Prisma", async () => {
    bootstrapPersistence();
    const created = await createDraft({
      slug: "glow-serum",
      title: "Glow Serum",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.slug).toBe("glow-serum");
    expect(created.value.hasPayload).toBe(true);

    const fetched = await getDraft(created.value.id);
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) return;
    expect(fetched.value.id).toBe(created.value.id);

    const list = await listDrafts();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value.some((d) => d.id === created.value.id)).toBe(true);
  });

  it("update enforces optimistic concurrency via expectedPayloadVersion", async () => {
    bootstrapPersistence();
    const created = await createDraft({ slug: "x", title: "X" });
    if (!created.ok) throw new Error("setup_failed");
    const next = makeBlankDraft({
      slug: "x",
      title: { en: "X 2" },
      newId: id,
    });
    const first = await updateDraftDocument({
      draftId: created.value.id,
      document: next,
      expectedPayloadVersion: created.value.payloadVersion,
    });
    expect(first.ok).toBe(true);
    // Same expectedPayloadVersion the second time → conflict.
    const second = await updateDraftDocument({
      draftId: created.value.id,
      document: next,
      expectedPayloadVersion: created.value.payloadVersion,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe("conflict");
    }
  });

  it("publishDraft rejects when the document fails validation", async () => {
    bootstrapPersistence();
    const created = await createDraft({ slug: "y", title: "Y" });
    if (!created.ok) throw new Error("setup_failed");
    // Replace payload with one missing hero/cta.
    const empty = makeBlankDraft({
      slug: "y",
      title: { en: "Y" },
      newId: id,
    });
    empty.sections = [];
    await updateDraftDocument({
      draftId: created.value.id,
      document: empty,
    });
    const result = await publishDraft({ draftId: created.value.id });
    expect(result.ok).toBe(false);
    if (!result.ok && result.code === "publish_blocked") {
      const codes = result.issues.map((i: { code: string }) => i.code);
      expect(codes).toContain("hero_missing");
      expect(codes).toContain("cta_missing");
    } else {
      throw new Error(`expected publish_blocked, got ${JSON.stringify(result)}`);
    }
  });

  it("publishDraft succeeds when the document validates", async () => {
    bootstrapPersistence();
    const created = await createDraft({ slug: "z", title: "Z" });
    if (!created.ok) throw new Error("setup_failed");
    const doc = createValidDocument();
    await updateDraftDocument({
      draftId: created.value.id,
      document: doc,
    });
    const result = await publishDraft({ draftId: created.value.id });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.record.version).toBe(1);
    }
  });

  // C3.1 — listPublishedProducts surfaces the DB-published catalog
  // to the products list. Before this fix the products page only
  // read FS-backed bundles, so every M11 publish was invisible.
  it("listPublishedProducts returns mode_unavailable in file-only mode", async () => {
    // No bootstrap → no Prisma client → no repositories.
    const result = await listPublishedProducts({ storeId: "fanaa" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("mode_unavailable");
    }
  });

  it("listPublishedProducts returns the rows persisted by publishDraft", async () => {
    bootstrapPersistence();
    const created = await createDraft({ slug: "zz", title: "ZZ" });
    if (!created.ok) throw new Error("setup_failed");
    await updateDraftDocument({
      draftId: created.value.id,
      document: createValidDocument(),
    });
    const publishResult = await publishDraft({ draftId: created.value.id });
    expect(publishResult.ok).toBe(true);

    const listed = await listPublishedProducts({ storeId: "fanaa" });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const slugs = listed.value.map((i) => i.row.slug);
    expect(slugs).toContain("zz");
    const item = listed.value.find((i) => i.row.slug === "zz");
    expect(item?.documentInvalid).toBe(false);
    expect(item?.document).not.toBeNull();
  });
});

describe("rowToListItem", () => {
  it("emits ISO timestamps", () => {
    const out = rowToListItem({
      id: "d1",
      storeId: "fanaa",
      slug: "x",
      title: "X",
      supplierUrl: null,
      notes: null,
      positioning: null,
      status: "intake",
      template: "default",
      costCents: 0,
      publishedAt: null,
      publishedRef: null,
      payload: null,
      payloadVersion: 0,
      createdBy: "system",
      createdAt: new Date("2026-05-22T10:00:00Z"),
      updatedAt: new Date("2026-05-22T11:00:00Z"),
    });
    expect(out.createdAt).toBe("2026-05-22T10:00:00.000Z");
    expect(out.updatedAt).toBe("2026-05-22T11:00:00.000Z");
  });
});

function createValidDocument() {
  const draft = makeBlankDraft({
    slug: "z",
    title: { en: "Z" },
    newId: id,
  });
  const hero = draft.sections[0];
  if (hero.kind === "hero") {
    hero.title = { en: "Z" };
    hero.media = {
      kind: "image",
      desktopSrc: "https://cdn.example.com/hero.jpg",
      alt: "z",
    };
  }
  const cta = draft.sections[1];
  if (cta.kind === "cta") {
    cta.title = { en: "Order" };
    cta.primaryLabel = { en: "Buy" };
    cta.primaryHref = "/order";
  }
  return draft;
}
