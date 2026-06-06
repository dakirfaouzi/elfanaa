import { describe, expect, it } from "vitest";
import {
  archiveSourceFor,
  buildArchiveMarker,
  buildTombstoneCreate,
  deriveCatalogStatus,
  normaliseReason,
  RESTORE_DATA,
} from "@/lib/catalog/admin-archive";

/**
 * Catalog PR C — pure archive/restore primitives.
 *
 * These mirror the shared persistence repository's archive/restore semantics
 * (PR B). The tombstone contract (empty currency → snapshot fallback) is the
 * subtle bit worth pinning so a restored curated product never renders "SAR 0".
 */

describe("deriveCatalogStatus", () => {
  it("reports archived when archivedAt is set (regardless of isLive)", () => {
    expect(deriveCatalogStatus({ isLive: false, archivedAt: new Date() })).toBe("archived");
    // Defensive: even if a row is somehow live + archived, the marker wins.
    expect(deriveCatalogStatus({ isLive: true, archivedAt: new Date() })).toBe("archived");
  });

  it("reports live when not archived and isLive", () => {
    expect(deriveCatalogStatus({ isLive: true, archivedAt: null })).toBe("live");
  });

  it("reports unlisted when not archived and not live", () => {
    expect(deriveCatalogStatus({ isLive: false, archivedAt: null })).toBe("unlisted");
  });

  it("accepts an ISO string archivedAt", () => {
    expect(
      deriveCatalogStatus({ isLive: false, archivedAt: "2026-01-01T00:00:00.000Z" }),
    ).toBe("archived");
  });
});

describe("buildArchiveMarker", () => {
  it("always sets isLive=false and the supplied timestamp", () => {
    const now = new Date("2026-06-06T00:00:00.000Z");
    const m = buildArchiveMarker(now);
    expect(m.isLive).toBe(false);
    expect(m.archivedAt).toBe(now);
    expect(m.archivedReason).toBeNull();
    expect(m.archivedBy).toBeNull();
  });

  it("normalises reason and actor", () => {
    const m = buildArchiveMarker(new Date(), { reason: "  out of stock  ", actor: " ops@x.io " });
    expect(m.archivedReason).toBe("out of stock");
    expect(m.archivedBy).toBe("ops@x.io");
  });

  it("drops blank reason/actor to null", () => {
    const m = buildArchiveMarker(new Date(), { reason: "   ", actor: "" });
    expect(m.archivedReason).toBeNull();
    expect(m.archivedBy).toBeNull();
  });
});

describe("buildTombstoneCreate", () => {
  it("creates a curated tombstone with empty currency (snapshot-fallback contract)", () => {
    const marker = buildArchiveMarker(new Date("2026-06-06T00:00:00.000Z"));
    const create = buildTombstoneCreate({
      storeId: "fanaa",
      slug: "p_001",
      source: "curated",
      marker,
    });
    expect(create.storeId).toBe("fanaa");
    expect(create.slug).toBe("p_001");
    expect(create.source).toBe("curated");
    expect(create.priceMinor).toBe(0);
    // Empty currency is the whole point — loader treats price as absent.
    expect(create.priceCurrency).toBe("");
    expect(create.isLive).toBe(false);
    expect(create.archivedAt).toBe(marker.archivedAt);
  });

  it("stamps ai_generated provenance when archiving an AI tombstone", () => {
    const create = buildTombstoneCreate({
      storeId: "fanaa",
      slug: "ai-thing",
      source: "ai_generated",
      marker: buildArchiveMarker(new Date()),
    });
    expect(create.source).toBe("ai_generated");
  });
});

describe("RESTORE_DATA", () => {
  it("clears the marker and re-lists the product", () => {
    expect(RESTORE_DATA.isLive).toBe(true);
    expect(RESTORE_DATA.archivedAt).toBeNull();
    expect(RESTORE_DATA.archivedReason).toBeNull();
    expect(RESTORE_DATA.archivedBy).toBeNull();
  });
});

describe("archiveSourceFor", () => {
  it("maps client source to the DB enum", () => {
    expect(archiveSourceFor("ai")).toBe("ai_generated");
    expect(archiveSourceFor("legacy")).toBe("curated");
  });
});

describe("normaliseReason", () => {
  it("trims, drops empties, and caps at 280 chars", () => {
    expect(normaliseReason("  hi  ")).toBe("hi");
    expect(normaliseReason("   ")).toBeNull();
    expect(normaliseReason(null)).toBeNull();
    expect(normaliseReason(undefined)).toBeNull();
    expect(normaliseReason("x".repeat(400))?.length).toBe(280);
  });
});
