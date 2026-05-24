import { describe, expect, it, vi } from "vitest";
import type { UniversalProduct } from "@platform/catalog-schema";
import { PersistenceError, type StudioDraftRow } from "@platform/persistence";
import { persistDraftFromProduct } from "../lib/studio/persist-draft-payload";
import type { StudioPersistence } from "../lib/studio/persistence";

/**
 * Unit tests for persistDraftFromProduct.
 *
 * Three branches under contract:
 *
 *   1. Fresh row (payloadVersion = 0)  → write at `0`, status → ready.
 *   2. Edited row with VALID payload   → conflict at `0`, skip + log.
 *   3. Edited row with INVALID payload → SELF-HEAL, force-write at `-1`.
 *
 * Branch 3 is the new behavior shipped to break the deadlock where a
 * historical broken write (pre-validation-gate) bumped payloadVersion
 * and trapped the draft in a permanently-unloadable state.
 *
 * The fake `StudioPersistence` here is minimal — only the four
 * repository methods this helper actually calls. Full Prisma coverage
 * lives in drafts-service.test.ts / packages/persistence/__tests__.
 */

// ─────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────

function makeProduct(): UniversalProduct {
  return {
    id: "up_test_001",
    slug: "glow-serum",
    niche: "beauty_wellness",
    storeContext: "fanaa",
    generationRunId: "run_test_001",
    generatedAt: "2026-01-15T10:00:00.000Z",
    title: { ar: "سيروم العناية", en: "Glow Serum" },
    description: {
      ar: "سيروم مرطب يومي للبشرة الجافة.",
      en: "Daily hydrating serum for dry skin.",
    },
    headline: { ar: "بشرة مشرقة", en: "Radiant skin" },
    subheadline: { ar: "ترطيب مكثّف.", en: "Deep hydration." },
    benefits: [
      {
        icon: "Droplets",
        title: { ar: "ترطيب عميق", en: "Deep hydration" },
        body: { ar: "ترطيب ٢٤ ساعة.", en: "24-hour hydration." },
      },
    ],
    images: [
      {
        src: "stores/fanaa/products/up_test_001/hero.webp",
        alt: { ar: "زجاجة", en: "Bottle" },
        width: 1200,
        height: 1500,
      },
    ],
    reviews: [],
    faq: [],
    priceHint: { amount: 19900, currency: "SAR" },
    hooks: [],
    sources: {
      supplierUrl: "https://example.com/serum",
      scrapedAt: "2026-01-14T18:00:00.000Z",
      uploadedImages: [],
    },
  };
}

function makeDraftRow(overrides: Partial<StudioDraftRow> = {}): StudioDraftRow {
  return {
    id: "draft_001",
    storeId: "fanaa",
    slug: "run_test_001",
    title: "Existing title",
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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface FakeRepoCalls {
  findBySlug: Array<{ storeId: string; slug: string }>;
  savePayload: Array<{
    id: string;
    payload: unknown;
    expectedPayloadVersion?: number;
    title?: string;
  }>;
  updateStatus: Array<{ id: string; status: string }>;
  eventAppend: Array<{ kind: string; payload?: unknown }>;
}

/**
 * Build a minimal StudioPersistence whose `repositories` field
 * implements only the calls persist-draft-payload makes. The
 * `savePayloadBehavior` callback lets each test tailor whether the
 * fake throws `conflict` (to simulate the optimistic-lock-fired
 * branch) or accepts the write.
 */
function makeFakePersistence(opts: {
  draftRow: StudioDraftRow | null;
  savePayloadBehavior?: (args: {
    id: string;
    expectedPayloadVersion?: number;
  }) => void;
}): { persistence: StudioPersistence; calls: FakeRepoCalls } {
  const calls: FakeRepoCalls = {
    findBySlug: [],
    savePayload: [],
    updateStatus: [],
    eventAppend: [],
  };
  // The Studio code reads `persistence.repositories.draft` and
  // `persistence.repositories.event`. The full type has many more
  // methods we never touch — `as unknown as StudioPersistence` keeps
  // the fake honest about what it actually implements without
  // forcing us to stub the entire surface.
  const persistence = {
    repositories: {
      draft: {
        async findBySlug(args: { storeId: string; slug: string }) {
          calls.findBySlug.push(args);
          return opts.draftRow;
        },
        async savePayload(args: {
          id: string;
          payload: unknown;
          expectedPayloadVersion?: number;
          title?: string;
        }) {
          calls.savePayload.push(args);
          opts.savePayloadBehavior?.({
            id: args.id,
            expectedPayloadVersion: args.expectedPayloadVersion,
          });
          return opts.draftRow!;
        },
        async updateStatus(args: { id: string; status: string }) {
          calls.updateStatus.push(args);
          return opts.draftRow!;
        },
      },
      event: {
        async append(args: { kind: string; payload?: unknown }) {
          calls.eventAppend.push(args);
        },
      },
    },
  } as unknown as StudioPersistence;
  return { persistence, calls };
}

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe("persistDraftFromProduct — write strategy", () => {
  it("writes at expectedPayloadVersion=0 when the row is fresh (payloadVersion=0)", async () => {
    const { persistence, calls } = makeFakePersistence({
      draftRow: makeDraftRow({ payloadVersion: 0, payload: null }),
    });

    const result = await persistDraftFromProduct({
      runId: "run_test_001",
      storeId: "fanaa",
      product: makeProduct(),
      persistence,
    });

    expect(result.status).toBe("ok");
    expect(calls.savePayload).toHaveLength(1);
    expect(calls.savePayload[0]?.expectedPayloadVersion).toBe(0);
    expect(calls.updateStatus[0]?.status).toBe("ready");
  });

  it("skips with conflict when the row has VALID edits (payloadVersion>0 + payload parses)", async () => {
    // Existing payload is the minimal valid DraftDocument — version 1,
    // no hero/cta required at the schema level, just well-formed JSON
    // that DraftDocumentSchema accepts.
    const editedPayload = {
      version: 1,
      meta: {
        title: { en: "Operator-edited title" },
        slug: "operator-edited",
        keywords: [],
      },
      sections: [],
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { persistence, calls } = makeFakePersistence({
      draftRow: makeDraftRow({
        payloadVersion: 3,
        payload: editedPayload,
      }),
      savePayloadBehavior: (args) => {
        // Simulate the real repo: throws conflict because version > 0
        // and the helper passed expectedPayloadVersion: 0.
        if (args.expectedPayloadVersion === 0) {
          throw new PersistenceError({
            kind: "conflict",
            message: `draft_payload_stale:${args.id}:3>0`,
          });
        }
      },
    });

    const result = await persistDraftFromProduct({
      runId: "run_test_001",
      storeId: "fanaa",
      product: makeProduct(),
      persistence,
    });

    expect(result.status).toBe("skipped_conflict");
    expect(calls.savePayload).toHaveLength(1);
    expect(calls.savePayload[0]?.expectedPayloadVersion).toBe(0);
    // Status update still fires so the UI banner flips.
    expect(calls.updateStatus[0]?.status).toBe("ready");
    // Logged as "preserving operator edits" — NOT as self-heal.
    expect(
      warn.mock.calls.some((c) =>
        String(c[0]).includes("preserving operator edits"),
      ),
    ).toBe(true);
    expect(
      warn.mock.calls.some((c) =>
        String(c[0]).includes("self_heal_stale_invalid_payload"),
      ),
    ).toBe(false);
    warn.mockRestore();
  });

  it("SELF-HEALS by force-writing at -1 when payloadVersion>0 but payload is schema-invalid", async () => {
    // This is the exact production deadlock: payloadVersion got bumped
    // by a historical broken write (slug had underscores, description
    // > 500 chars), so the row "looks edited" but the editor can't
    // even load it (DraftDocumentSchema.safeParse fails → blank
    // fallback). The helper must force-overwrite.
    const brokenPayload = {
      version: 1,
      meta: {
        title: { ar: "روتين", en: "Routine" },
        slug: "run_mpiptq9l_pligqded", // underscores — SLUG_PATTERN rejects
        description: { en: "x".repeat(700) }, // > 500 — max() rejects
        keywords: [],
      },
      sections: [],
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { persistence, calls } = makeFakePersistence({
      draftRow: makeDraftRow({
        payloadVersion: 1,
        payload: brokenPayload,
      }),
      // Behavior accepts -1 (no version check), would throw on 0.
      savePayloadBehavior: (args) => {
        if (args.expectedPayloadVersion === 0) {
          throw new PersistenceError({
            kind: "conflict",
            message: "should_not_be_called_with_0",
          });
        }
      },
    });

    const result = await persistDraftFromProduct({
      runId: "run_test_001",
      storeId: "fanaa",
      product: makeProduct(),
      persistence,
    });

    expect(result.status).toBe("ok");
    expect(calls.savePayload).toHaveLength(1);
    // Critical: bypassed the lock with -1.
    expect(calls.savePayload[0]?.expectedPayloadVersion).toBe(-1);
    expect(calls.updateStatus[0]?.status).toBe("ready");
    // Logged the self-heal distinctly so it's auditable.
    expect(
      warn.mock.calls.some((c) =>
        String(c[0]).includes("self_heal_stale_invalid_payload"),
      ),
    ).toBe(true);
    warn.mockRestore();
  });

  it("does NOT self-heal when payloadVersion=0 (no version to override)", async () => {
    // Edge case: a brand-new row with `payload = null`. `null` fails
    // schema validation, but version is 0 so the standard write
    // path applies — we shouldn't fall through to the self-heal
    // log line.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { persistence, calls } = makeFakePersistence({
      draftRow: makeDraftRow({ payloadVersion: 0, payload: null }),
    });

    await persistDraftFromProduct({
      runId: "run_test_001",
      storeId: "fanaa",
      product: makeProduct(),
      persistence,
    });

    expect(calls.savePayload[0]?.expectedPayloadVersion).toBe(0);
    expect(
      warn.mock.calls.some((c) =>
        String(c[0]).includes("self_heal_stale_invalid_payload"),
      ),
    ).toBe(false);
    warn.mockRestore();
  });

  it("returns draft_not_found when findBySlug yields null", async () => {
    const { persistence, calls } = makeFakePersistence({ draftRow: null });
    const result = await persistDraftFromProduct({
      runId: "run_test_001",
      storeId: "fanaa",
      product: makeProduct(),
      persistence,
    });
    expect(result.status).toBe("draft_not_found");
    expect(calls.savePayload).toHaveLength(0);
  });
});
