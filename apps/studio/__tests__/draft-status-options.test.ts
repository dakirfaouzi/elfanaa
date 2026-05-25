import { describe, expect, it } from "vitest";
import type { StudioDraftStatusValue } from "@platform/persistence";
import {
  DRAFT_STATUS_LABEL,
  DRAFT_STATUS_TONE,
  bucketStatus,
  statusLabel,
  statusTagClass,
} from "../lib/studio/draft-status-options";

/**
 * Status label + tone coverage tests.
 *
 * Load-bearing: if Prisma's StudioDraftStatus enum gains or renames
 * a value, this test fails before the UI silently falls back to
 * rendering the raw enum or — worse — undefined.
 *
 * The seven canonical values are hard-coded here as a literal list
 * so the test catches removals too (TypeScript alone only catches
 * additions of unhandled cases).
 */

const ALL_STATUSES: StudioDraftStatusValue[] = [
  "intake",
  "generating",
  "ready",
  "publishing",
  "published",
  "archived",
  "failed",
];

describe("DRAFT_STATUS_LABEL — coverage", () => {
  it("has a non-empty label for every StudioDraftStatusValue", () => {
    for (const status of ALL_STATUSES) {
      expect(DRAFT_STATUS_LABEL[status]).toBeTruthy();
      expect(DRAFT_STATUS_LABEL[status].length).toBeGreaterThan(0);
    }
  });

  it("statusLabel() agrees with DRAFT_STATUS_LABEL", () => {
    for (const status of ALL_STATUSES) {
      expect(statusLabel(status)).toBe(DRAFT_STATUS_LABEL[status]);
    }
  });

  it("DRAFT_STATUS_LABEL has no extra keys beyond the enum", () => {
    const expected = new Set<string>(ALL_STATUSES);
    for (const key of Object.keys(DRAFT_STATUS_LABEL)) {
      expect(expected.has(key)).toBe(true);
    }
  });
});

describe("DRAFT_STATUS_TONE — coverage", () => {
  it("has a valid tone for every StudioDraftStatusValue", () => {
    const validTones = new Set([
      "accent",
      "info",
      "success",
      "warning",
      "danger",
    ]);
    for (const status of ALL_STATUSES) {
      expect(validTones.has(DRAFT_STATUS_TONE[status])).toBe(true);
    }
  });

  it("statusTagClass() returns tag tag-<tone>", () => {
    for (const status of ALL_STATUSES) {
      const cls = statusTagClass(status);
      expect(cls).toBe(`tag tag-${DRAFT_STATUS_TONE[status]}`);
    }
  });
});

describe("bucketStatus — coverage + invariants", () => {
  it("returns a bucket for every status", () => {
    for (const status of ALL_STATUSES) {
      expect(bucketStatus(status)).toBeTruthy();
    }
  });

  it("maps the three transient states to in_progress", () => {
    expect(bucketStatus("intake")).toBe("in_progress");
    expect(bucketStatus("generating")).toBe("in_progress");
    expect(bucketStatus("publishing")).toBe("in_progress");
  });

  it("maps ready → drafts", () => {
    expect(bucketStatus("ready")).toBe("drafts");
  });

  it("maps published/archived/failed each to their own bucket", () => {
    expect(bucketStatus("published")).toBe("published");
    expect(bucketStatus("archived")).toBe("archived");
    expect(bucketStatus("failed")).toBe("failed");
  });
});
