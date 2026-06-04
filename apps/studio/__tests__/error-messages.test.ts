import { describe, it, expect } from "vitest";
import { friendlyError } from "../lib/studio/error-messages";

/**
 * friendlyError (Sprint 2) — operator-facing error humaniser. These
 * assertions lock the mapping for the codes Studio actually surfaces so a
 * future copy tweak can't silently re-expose a raw machine string.
 */
describe("friendlyError", () => {
  it("never returns the raw code", () => {
    for (const raw of [
      "save_failed:409:stale payload",
      "upload_returned_no_usable_ref",
      "upload_failed",
      "load_failed",
      "intake_failed",
      "mode_unavailable",
      "product_unknown",
      "network_error",
    ]) {
      const msg = friendlyError(raw);
      expect(msg).not.toContain(raw);
      expect(msg.length).toBeGreaterThan(10);
    }
  });

  it("maps a stale-save conflict to a reload hint", () => {
    expect(friendlyError("save_failed:409:")).toMatch(/reload/i);
  });

  it("maps a generic autosave failure to a retry hint", () => {
    expect(friendlyError("save_failed:500:boom")).toMatch(/save/i);
  });

  it("maps upload failures to an image-upload message", () => {
    expect(friendlyError("upload_failed")).toMatch(/upload/i);
    expect(friendlyError("upload_returned_no_usable_ref")).toMatch(/unusable/i);
  });

  it("maps slug conflicts", () => {
    expect(friendlyError("conflict")).toMatch(/slug/i);
  });

  it("maps product_unknown to a publish hint", () => {
    expect(friendlyError("unknown product id: run_x")).toMatch(/publish/i);
  });

  it("prefers a specific rule over the status fallback", () => {
    // The publish rule wins even though the string also carries a status.
    expect(friendlyError("Publish failed (502).")).toMatch(/publishing failed/i);
  });

  it("falls back to an HTTP-status sentence for bare statuses", () => {
    expect(friendlyError("request (502)")).toMatch(/server/i);
    expect(friendlyError("request (401)")).toMatch(/session/i);
    expect(friendlyError("request (404)")).toMatch(/find/i);
  });

  it("returns a safe generic message for empty / unknown input", () => {
    expect(friendlyError("")).toMatch(/something went wrong/i);
    expect(friendlyError(null)).toMatch(/something went wrong/i);
    expect(friendlyError("kjsdfkjsdf")).toMatch(/something went wrong/i);
  });
});
