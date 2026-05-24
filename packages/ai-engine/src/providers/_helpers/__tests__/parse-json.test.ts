import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseJsonWithRepair } from "../parse-json";
// Imported for vi.mocked() in the both-failed tests below — jsonrepair
// is normally aggressive enough that almost any input gets coerced to
// SOMETHING parseable, so deterministically exercising the both-failed
// branch requires stubbing the library itself.
import { jsonrepair } from "jsonrepair";

// Replace `jsonrepair` with a vi.fn() that delegates to the real
// implementation by default, but is overridable per-test via
// `vi.mocked(jsonrepair).mockImplementationOnce(...)`. The hoisted
// `vi.mock()` call runs before any imports, so `parseJsonWithRepair`
// (which imports jsonrepair internally) picks up our mock.
vi.mock("jsonrepair", async () => {
  const actual = await vi.importActual<typeof import("jsonrepair")>(
    "jsonrepair",
  );
  return {
    ...actual,
    jsonrepair: vi.fn((input: string) => actual.jsonrepair(input)),
  };
});

describe("parseJsonWithRepair", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // ─── Fast path ─────────────────────────────────────────────────────

  it("parses well-formed JSON without invoking repair", () => {
    const text = '{"hello": "world", "nested": {"a": 1}}';
    const out = parseJsonWithRepair(text, "anthropic");
    expect(out).toEqual({ hello: "world", nested: { a: 1 } });
    // Repair never fired → no warning.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // ─── Repair path — production failure modes ────────────────────────

  it("repairs missing comma between object members (the production social_proof bug)", () => {
    // Exact shape of the run_mpiptq9l_pligqded failure: comma
    // missing after the first object member, parser chokes with
    // "Expected ',' or '}'".
    const text = '{"a": 1 "b": 2}';
    const out = parseJsonWithRepair(text, "anthropic");
    expect(out).toEqual({ a: 1, b: 2 });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("JSON repair fired");
    expect(warnSpy.mock.calls[0][0]).toContain("anthropic-adapter");
  });

  it("repairs unescaped smart quotes around Arabic content", () => {
    // Claude occasionally emits Unicode smart quotes around Arabic
    // strings instead of straight ASCII quotes, breaking the parser.
    const text = '{\u201Cbody\u201D: \u201Cمرحبا\u201D}';
    const out = parseJsonWithRepair(text, "anthropic");
    expect(out).toEqual({ body: "مرحبا" });
    expect(warnSpy).toHaveBeenCalled();
  });

  it("repairs trailing commas", () => {
    const text = '{"a": 1, "b": 2,}';
    const out = parseJsonWithRepair(text, "openai");
    expect(out).toEqual({ a: 1, b: 2 });
  });

  it("repairs missing closing brace (the truncation-recovery case)", () => {
    // Even though our adapter catches `stop_reason: max_tokens`
    // earlier, a network-cut response that still made it to the
    // parser should also be salvageable when jsonrepair can guess
    // the closing bracket safely.
    const text = '{"a": 1, "b": 2';
    const out = parseJsonWithRepair(text, "anthropic");
    expect(out).toEqual({ a: 1, b: 2 });
  });

  it("logs the warning under the correct provider label", () => {
    parseJsonWithRepair('{"a": 1,}', "openai");
    expect(warnSpy.mock.calls[0][0]).toContain("openai-adapter");
  });

  // ─── Both-failed path ──────────────────────────────────────────────

  it("throws with provider-prefixed message + chained causes when jsonrepair itself fails", () => {
    // Force jsonrepair to throw — covers the catastrophic case where
    // the response is so unstructured that the repair library bails.
    vi.mocked(jsonrepair).mockImplementationOnce(() => {
      throw new Error("JSONRepairError: cannot repair");
    });

    const text = "absolute_garbage";
    let caught: unknown;
    try {
      parseJsonWithRepair(text, "anthropic");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error & { cause?: Error };
    expect(err.message).toBe("anthropic_json_parse_failed");
    // The cause carries BOTH the original parse error AND the repair
    // attempt error, so the operator-facing chain shows the full
    // diagnostic.
    expect(err.cause).toBeInstanceOf(Error);
    const causeMsg = (err.cause as Error).message;
    expect(causeMsg).toMatch(/original=/);
    expect(causeMsg).toMatch(/repair_attempt=.*JSONRepairError/);
  });

  it("throws with provider-prefixed message when repair output is still invalid", () => {
    // Force jsonrepair to return something that still won't parse —
    // covers the rare case where the library claims success but the
    // output still has a structural defect.
    vi.mocked(jsonrepair).mockImplementationOnce(() => "still {{ not json");

    const text = "anything";
    let caught: unknown;
    try {
      parseJsonWithRepair(text, "openai");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error & { cause?: Error };
    expect(err.message).toBe("openai_json_parse_failed");
    expect((err.cause as Error).message).toMatch(/post_repair=/);
  });
});
