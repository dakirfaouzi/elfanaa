import { describe, expect, it } from "vitest";
import { BufferSink, createLogger } from "../runtime/logger";

describe("structured logger", () => {
  it("emits one JSON line per event with timestamp, level, event, context, data", () => {
    const sink = new BufferSink();
    const logger = createLogger({
      sink: sink.write,
      context: { runId: "run_log_1", storeId: "fanaa" },
    });

    logger.info("stage_start", { stage: "strategy", attempt: 1 });
    logger.warn("stage_retry", { stage: "strategy", attempt: 2 });
    logger.error("stage_failed", { stage: "strategy", attempt: 3 });

    expect(sink.lines).toHaveLength(3);
    const events = sink.lines.map((l) => JSON.parse(l));
    expect(events[0].event).toBe("stage_start");
    expect(events[0].level).toBe("info");
    expect(events[0].context.runId).toBe("run_log_1");
    expect(events[1].level).toBe("warn");
    expect(events[2].level).toBe("error");
  });

  it("withContext merges into all subsequent emits", () => {
    const sink = new BufferSink();
    const root = createLogger({
      sink: sink.write,
      context: { runId: "run_log_2" },
    });
    const stageLogger = root.withContext({ stage: "research" });
    stageLogger.info("stage_attempt", {});

    const ev = JSON.parse(sink.lines[0]);
    expect(ev.context.runId).toBe("run_log_2");
    expect(ev.context.stage).toBe("research");
  });

  it("filters events below minLevel", () => {
    const sink = new BufferSink();
    const logger = createLogger({ sink: sink.write, minLevel: "warn" });

    logger.debug("noisy", {});
    logger.info("noisy_info", {});
    logger.warn("important", {});
    logger.error("critical", {});

    expect(sink.lines).toHaveLength(2);
    expect(JSON.parse(sink.lines[0]).event).toBe("important");
    expect(JSON.parse(sink.lines[1]).event).toBe("critical");
  });

  it("withContext does NOT mutate the parent logger's context", () => {
    const sink = new BufferSink();
    const root = createLogger({
      sink: sink.write,
      context: { runId: "r" },
    });
    root.withContext({ stage: "vision" }).info("child", {});
    root.info("parent", {});

    const child = JSON.parse(sink.lines[0]);
    const parent = JSON.parse(sink.lines[1]);
    expect(child.context.stage).toBe("vision");
    expect(parent.context.stage).toBeUndefined();
  });
});
