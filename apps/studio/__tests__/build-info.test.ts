import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getBuildSha,
  getBuildShaShort,
  getBuildShaUrl,
  getBuildTimestamp,
} from "../lib/studio/build-info";

/**
 * Build-info helper tests.
 *
 * Coverage focuses on the contract that protects operators from
 * the stale-deploy class of bug:
 *
 *   • Missing build-arg → falls back to "dev" loudly (the NavBar
 *     pill renders red so it's impossible to miss in production).
 *   • Malformed input → also "dev", never a broken GitHub link.
 *   • Both env vars (server + NEXT_PUBLIC_) are read with server
 *     winning on tie, so a server component never accidentally
 *     shows a different SHA from a sibling client component.
 *   • Short form is canonical 7 chars (matches `git log --oneline`).
 *   • GitHub link points at the actual repo this Studio image
 *     ships out of (regression guard if the repo ever forks).
 */

const SERVER_KEY = "STUDIO_BUILD_SHA";
const CLIENT_KEY = "NEXT_PUBLIC_STUDIO_BUILD_SHA";
const TS_KEY = "STUDIO_BUILT_AT";

function clearAll() {
  delete process.env[SERVER_KEY];
  delete process.env[CLIENT_KEY];
  delete process.env[TS_KEY];
}

describe("build-info", () => {
  let snapshot: NodeJS.ProcessEnv;
  beforeEach(() => {
    snapshot = { ...process.env };
    clearAll();
  });
  afterEach(() => {
    process.env = snapshot;
  });

  it("returns 'dev' when no env var is set", () => {
    expect(getBuildSha()).toBe("dev");
    expect(getBuildShaShort()).toBe("dev");
    expect(getBuildShaUrl()).toBeNull();
  });

  it("returns the server-side SHA when set", () => {
    process.env[SERVER_KEY] = "5827610abc1234567890abcdef1234567890abcd";
    expect(getBuildSha()).toBe("5827610abc1234567890abcdef1234567890abcd");
    expect(getBuildShaShort()).toBe("5827610");
  });

  it("returns the NEXT_PUBLIC_ SHA when server-side is unset", () => {
    process.env[CLIENT_KEY] = "5827610";
    expect(getBuildSha()).toBe("5827610");
    expect(getBuildShaShort()).toBe("5827610");
  });

  it("prefers server-side SHA over NEXT_PUBLIC_ when both set (no drift)", () => {
    process.env[SERVER_KEY] = "aaaaaaa";
    process.env[CLIENT_KEY] = "bbbbbbb";
    expect(getBuildSha()).toBe("aaaaaaa");
  });

  it("lowercases the SHA (deterministic comparisons / URLs)", () => {
    process.env[SERVER_KEY] = "DEADBEEFCAFE";
    expect(getBuildSha()).toBe("deadbeefcafe");
  });

  it("rejects malformed SHAs and falls back to 'dev'", () => {
    // Spaces, special chars, non-hex letters, too-short, too-long.
    const bad = [
      "not-a-sha",
      "0123456 abcdef",
      "GGGGGGGG",
      "abc12",
      "0".repeat(41),
      "<script>",
    ];
    for (const v of bad) {
      process.env[SERVER_KEY] = v;
      expect(getBuildSha()).toBe("dev");
      expect(getBuildShaUrl()).toBeNull();
    }
  });

  it("accepts both short (7) and full (40) hex SHAs", () => {
    process.env[SERVER_KEY] = "5827610";
    expect(getBuildSha()).toBe("5827610");
    process.env[SERVER_KEY] = "5827610abc1234567890abcdef1234567890abcd";
    expect(getBuildSha()).toBe("5827610abc1234567890abcdef1234567890abcd");
  });

  it("getBuildShaUrl points at the elfanaa repo on GitHub", () => {
    process.env[SERVER_KEY] = "5827610";
    const url = getBuildShaUrl();
    expect(url).toBe(
      "https://github.com/dakirfaouzi/elfanaa/commit/5827610",
    );
  });

  it("getBuildTimestamp returns null when STUDIO_BUILT_AT is unset", () => {
    expect(getBuildTimestamp()).toBeNull();
  });

  it("getBuildTimestamp returns the value when STUDIO_BUILT_AT is set", () => {
    process.env[TS_KEY] = "2026-05-24T18:00:00Z";
    expect(getBuildTimestamp()).toBe("2026-05-24T18:00:00Z");
  });
});
