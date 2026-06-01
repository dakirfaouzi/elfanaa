import { describe, expect, it } from "vitest";
import { PIPELINE_STAGES } from "@platform/worker";
import {
  STAGE_ORDER,
  STAGE_LABELS,
  STAGE_DESCRIPTIONS,
  computePipelineProgress,
  type PipelineStage,
} from "../lib/studio/pipeline-stages";

/**
 * Pipeline-stages schema-guard + behaviour tests.
 *
 * The schema-guard half is load-bearing: `STAGE_ORDER` in the Studio
 * UI must stay in sync with `PIPELINE_STAGES` in `@platform/worker`.
 * If the worker drops or renames a stage, this test fails in CI
 * before the UI silently mislabels "Stage 7 of 11" as the wrong
 * stage.
 *
 * The behavioural half locks in `computePipelineProgress` semantics:
 *   • Running pipelines report only success in the fraction (no
 *     premature "100%" from skips).
 *   • The next un-finished stage becomes `"active"` on running runs.
 *   • Completed runs always read 1.0 regardless of skips.
 *   • Failed runs surface the actual count + don't fabricate progress.
 */

describe("STAGE_ORDER conformance", () => {
  it("matches @platform/worker PIPELINE_STAGES one-to-one, in order", () => {
    expect(STAGE_ORDER.length).toBe(PIPELINE_STAGES.length);
    expect([...STAGE_ORDER]).toEqual([...PIPELINE_STAGES]);
  });

  it("has 12 stages (per PLATFORM.md §11 + Step 4 §4.1 section_content)", () => {
    expect(STAGE_ORDER.length).toBe(12);
  });

  it("includes the Step-4 section_content stage between social_proof and upsell_match", () => {
    const i = STAGE_ORDER.indexOf("section_content");
    expect(i).toBeGreaterThan(STAGE_ORDER.indexOf("social_proof"));
    expect(i).toBeLessThan(STAGE_ORDER.indexOf("upsell_match"));
  });

  it("every stage has an operator-facing label", () => {
    for (const stage of STAGE_ORDER) {
      expect(STAGE_LABELS[stage]).toBeTruthy();
      expect(STAGE_LABELS[stage].length).toBeGreaterThan(0);
    }
  });

  it("every stage has a one-line description", () => {
    for (const stage of STAGE_ORDER) {
      expect(STAGE_DESCRIPTIONS[stage]).toBeTruthy();
      expect(STAGE_DESCRIPTIONS[stage].length).toBeGreaterThan(0);
    }
  });

  it("STAGE_LABELS has no extra keys beyond STAGE_ORDER", () => {
    const expected = new Set<string>(STAGE_ORDER);
    for (const key of Object.keys(STAGE_LABELS)) {
      expect(expected.has(key)).toBe(true);
    }
  });

  it("STAGE_DESCRIPTIONS has no extra keys beyond STAGE_ORDER", () => {
    const expected = new Set<string>(STAGE_ORDER);
    for (const key of Object.keys(STAGE_DESCRIPTIONS)) {
      expect(expected.has(key)).toBe(true);
    }
  });
});

describe("computePipelineProgress — empty input", () => {
  it("reports zero counts and no current stage when no steps have run", () => {
    const p = computePipelineProgress([], "pending");
    expect(p.successCount).toBe(0);
    expect(p.failureCount).toBe(0);
    expect(p.fraction).toBe(0);
    // On `"pending"` runStatus, the FIRST stage is promoted to active
    // because the orchestrator will start it next. currentStage is
    // therefore "research" (the first stage), and ordinal 1.
    expect(p.currentStage).toBe("research");
    expect(p.currentOrdinal).toBe(1);
  });

  it("returns null currentStage when no steps and run is already terminal", () => {
    // Terminal with zero steps = cancelled before anything ran.
    const p = computePipelineProgress([], "cancelled");
    expect(p.currentStage).toBeNull();
    expect(p.currentOrdinal).toBe(0);
  });
});

describe("computePipelineProgress — running pipeline", () => {
  it("marks the next un-finished stage as active when running", () => {
    const steps = [
      { stage: "research" as PipelineStage, status: "success" as const },
      { stage: "vision" as PipelineStage, status: "success" as const },
    ];
    const p = computePipelineProgress(steps, "running");
    expect(p.perStage.research).toBe("success");
    expect(p.perStage.vision).toBe("success");
    // strategy is next per STAGE_ORDER — should be active.
    expect(p.perStage.strategy).toBe("active");
    expect(p.perStage.structure).toBe("pending");
    expect(p.currentStage).toBe("strategy");
    expect(p.currentOrdinal).toBe(3);
  });

  it("fraction counts only successes, never skips, on running runs", () => {
    const steps = [
      { stage: "research" as PipelineStage, status: "success" as const },
      { stage: "vision" as PipelineStage, status: "skipped" as const },
      { stage: "strategy" as PipelineStage, status: "success" as const },
    ];
    const p = computePipelineProgress(steps, "running");
    expect(p.successCount).toBe(2);
    expect(p.skippedCount).toBe(1);
    expect(p.fraction).toBeCloseTo(2 / 12, 5);
  });
});

describe("computePipelineProgress — terminal runs", () => {
  it("reports 1.0 fraction on a completed run even when some stages skipped", () => {
    const steps = STAGE_ORDER.map((stage, i) => ({
      stage: stage as PipelineStage,
      status: i === 1 ? ("skipped" as const) : ("success" as const),
    }));
    const p = computePipelineProgress(steps, "completed");
    expect(p.fraction).toBe(1);
    expect(p.currentStage).toBe("assemble");
    expect(p.currentOrdinal).toBe(12);
  });

  it("surfaces failure at the failed stage without fabricating progress", () => {
    const steps = [
      { stage: "research" as PipelineStage, status: "success" as const },
      { stage: "vision" as PipelineStage, status: "success" as const },
      { stage: "strategy" as PipelineStage, status: "failed" as const },
    ];
    const p = computePipelineProgress(steps, "failed");
    expect(p.successCount).toBe(2);
    expect(p.failureCount).toBe(1);
    expect(p.fraction).toBeCloseTo(2 / 12, 5);
    expect(p.currentStage).toBe("strategy");
    expect(p.currentOrdinal).toBe(3);
    expect(p.perStage.strategy).toBe("failed");
    // Downstream stages stay pending, not active — the run is terminal.
    expect(p.perStage.structure).toBe("pending");
  });
});

describe("computePipelineProgress — defensive", () => {
  it("ignores step records with unknown stage names", () => {
    const steps = [
      { stage: "research" as PipelineStage, status: "success" as const },
      { stage: "ghost_stage" as unknown as PipelineStage, status: "success" as const },
    ];
    const p = computePipelineProgress(steps, "running");
    expect(p.successCount).toBe(1);
    expect(p.perStage.research).toBe("success");
    // No mutation of the ghost name into perStage.
    expect(Object.keys(p.perStage).sort()).toEqual([...STAGE_ORDER].sort());
  });

  it("returns the canonical 12 in perStage regardless of input", () => {
    const p = computePipelineProgress([], "completed");
    expect(Object.keys(p.perStage).length).toBe(12);
  });
});
