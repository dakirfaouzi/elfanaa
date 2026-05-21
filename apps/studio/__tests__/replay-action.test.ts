import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runReplayAction } from "../lib/studio/replay-action";
import {
  makeTempPlatformData,
  fixtureRunRecord,
  writeFixtureRun,
  pointPlatformDataRoot,
  restorePlatformDataRoot,
  type TempPlatformData,
} from "./_helpers/fixture-bundle";

/**
 * Tests for the replay server action.
 *
 * # Coverage
 *
 *   1. not_found  — replay against a missing run.
 *   2. ok (no-op) — replay against a fully-successful run; nothing
 *      to re-run, so the action short-circuits without calling
 *      providers.
 *
 * # What this suite intentionally does NOT cover
 *
 *   • `providers_unavailable` — when ANTHROPIC_API_KEY etc. are
 *     missing, the M4 registry returns STUB adapters that satisfy
 *     the provider interface (and only throw at call-time). The
 *     resolveProvidersForStore() boundary check therefore passes,
 *     and `providers_unavailable` only fires for capabilities with
 *     no stub fallback (none in M6/M7). Triggering this path
 *     requires monkey-patching the registry, which lands as a
 *     dedicated test infra package in M9 alongside the Inngest
 *     adapter — the surface is asserted by typechecking only here.
 *
 *   • `replay_failed` — same reason; would require executing the
 *     stubs which throw at runtime, but the fixture run has every
 *     stage marked successful so no stub is ever invoked.
 *
 * Real-provider end-to-end tests land with the M9 e2e suite.
 */
describe("replay-action", () => {
  let temp: TempPlatformData;
  let prevEnv: string | undefined;

  beforeEach(async () => {
    temp = await makeTempPlatformData();
    prevEnv = pointPlatformDataRoot(temp.root);
  });

  afterEach(async () => {
    restorePlatformDataRoot(prevEnv);
    await temp.cleanup();
  });

  it("returns not_found when the run does not exist", async () => {
    const result = await runReplayAction({ runId: "nope" });
    expect(result.status).toBe("not_found");
  });

  it("returns ok when every stage already succeeded (no-op replay)", async () => {
    const run = fixtureRunRecord();
    await writeFixtureRun(temp, run);
    const result = await runReplayAction({ runId: run.runId });
    // Cannot assert exact status without provider env, but it MUST
    // NOT be `not_found` — the run exists. The two acceptable terminal
    // statuses are `ok` (no-op replay) or `providers_unavailable`
    // (defence-in-depth on hosts where the stub fallback is disabled).
    expect(["ok", "providers_unavailable"]).toContain(result.status);
    if (result.status === "ok") {
      expect(result.runId).toBe(run.runId);
      expect(result.finalProductId).toBe("up_test_001");
    }
  });
});
