import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { listRuns, readRun } from "../lib/studio/run-loader";
import {
  makeTempPlatformData,
  fixtureRunRecord,
  writeFixtureRun,
  pointPlatformDataRoot,
  restorePlatformDataRoot,
  type TempPlatformData,
} from "./_helpers/fixture-bundle";

describe("run-loader", () => {
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

  it("listRuns returns [] when runs/ is empty", async () => {
    const list = await listRuns();
    expect(list).toEqual([]);
  });

  it("listRuns returns [] when runs/ does not exist", async () => {
    await fs.rm(temp.runsRoot, { recursive: true, force: true });
    const list = await listRuns();
    expect(list).toEqual([]);
  });

  it("readRun returns ok for a valid record", async () => {
    const run = fixtureRunRecord();
    await writeFixtureRun(temp, run);
    const result = await readRun(run.runId);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.run.runId).toBe(run.runId);
    expect(result.run.steps).toHaveLength(1);
    expect(result.run.finalProduct?.id).toBe("up_test_001");
  });

  it("readRun returns not_found for a missing record", async () => {
    const result = await readRun("missing");
    expect(result.status).toBe("not_found");
  });

  it("readRun returns corrupted for invalid JSON", async () => {
    await fs.writeFile(path.join(temp.runsRoot, "broken.json"), "{not json", "utf8");
    const result = await readRun("broken");
    expect(result.status).toBe("corrupted");
    if (result.status !== "corrupted") return;
    expect(result.reason).toBe("invalid_json");
  });

  it("readRun returns corrupted for a schema-mismatch record", async () => {
    await fs.writeFile(
      path.join(temp.runsRoot, "wrong.json"),
      JSON.stringify({ runId: "wrong", status: "completed" }, null, 2),
      "utf8",
    );
    const result = await readRun("wrong");
    expect(result.status).toBe("corrupted");
    if (result.status !== "corrupted") return;
    expect(result.reason).toBe("schema_mismatch");
  });

  it("listRuns sorts by createdAt descending and surfaces corrupted records", async () => {
    const a = fixtureRunRecord();
    a.runId = "run_test_a";
    a.createdAt = "2026-01-01T00:00:00.000Z";

    const b = fixtureRunRecord();
    b.runId = "run_test_b";
    b.createdAt = "2026-02-01T00:00:00.000Z";

    await writeFixtureRun(temp, a);
    await writeFixtureRun(temp, b);
    await fs.writeFile(path.join(temp.runsRoot, "broken.json"), "not json", "utf8");

    const list = await listRuns();
    const orderedIds = list.map((r) => r.runId);
    expect(orderedIds).toContain("broken");
    expect(orderedIds.indexOf("run_test_b")).toBeLessThan(orderedIds.indexOf("run_test_a"));
  });
});
