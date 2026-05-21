import { describe, expect, it } from "vitest";
import {
  backoffForAttempt,
  resolvePolicy,
  type RetryPolicyTable,
} from "../types";
import { defaultRetryPolicy } from "../default";

describe("retry policy", () => {
  it("defaults match PLATFORM.md §15", () => {
    expect(defaultRetryPolicy.defaults.provider_call.maxAttempts).toBe(3);
    expect(defaultRetryPolicy.defaults.sharp.maxAttempts).toBe(2);
    expect(defaultRetryPolicy.defaults.octokit.maxAttempts).toBe(5);
    expect(defaultRetryPolicy.defaults.assemble.maxAttempts).toBe(1);
  });

  it("provider_call backoff is 1s → 5s → 25s", () => {
    const policy = defaultRetryPolicy.defaults.provider_call;
    expect(policy.backoffMs(1)).toBe(1000);
    expect(policy.backoffMs(2)).toBe(5000);
    expect(policy.backoffMs(3)).toBe(25_000);
  });

  it("assemble stage override forces 1 attempt regardless of kind", () => {
    const resolved = resolvePolicy(defaultRetryPolicy, "provider_call", "assemble");
    expect(resolved.maxAttempts).toBe(1);
  });

  it("image_gen stage override forces 1 attempt (already retries internally)", () => {
    const resolved = resolvePolicy(defaultRetryPolicy, "provider_call", "image_gen");
    expect(resolved.maxAttempts).toBe(1);
  });

  it("unspecified stage inherits the kind default", () => {
    const resolved = resolvePolicy(defaultRetryPolicy, "provider_call", "strategy");
    expect(resolved.maxAttempts).toBe(3);
  });

  it("backoffForAttempt returns 0 when attempts are exhausted", () => {
    const policy = defaultRetryPolicy.defaults.provider_call;
    expect(backoffForAttempt(policy, 3)).toBe(0);
    expect(backoffForAttempt(policy, 4)).toBe(0);
  });

  it("backoffForAttempt applies deterministic jitter when configured", () => {
    const policy = defaultRetryPolicy.defaults.octokit;
    const fixedRandom = () => 0; // most-negative jitter
    const delay = backoffForAttempt(policy, 1, fixedRandom);
    // base = 500ms, jitter = 0.3, fixed random = 0 → delay = 500 - 150 = 350
    expect(delay).toBe(350);
  });

  it("custom RetryPolicyTable can override defaults wholesale", () => {
    const custom: RetryPolicyTable = {
      defaults: {
        provider_call: { maxAttempts: 5, backoffMs: () => 250 },
        sharp: { maxAttempts: 1, backoffMs: () => 0 },
        octokit: { maxAttempts: 1, backoffMs: () => 0 },
        assemble: { maxAttempts: 1, backoffMs: () => 0 },
      },
    };
    const resolved = resolvePolicy(custom, "provider_call", "strategy");
    expect(resolved.maxAttempts).toBe(5);
  });
});
