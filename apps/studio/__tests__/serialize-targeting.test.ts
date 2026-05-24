import { describe, expect, it } from "vitest";
import { renderTargetingAsNotes } from "../lib/studio/intake/serialize-targeting";

/**
 * Targeting-string serializer tests (Phase B2).
 *
 * Coverage focuses on the contract this helper provides to the
 * strategy stage:
 *
 *   • Empty inputs → empty string (form omits operatorNotes
 *     entirely → strategy prompt sees no notes section, identical
 *     to M9 behavior).
 *   • Bullets are emitted ONLY for picked fields.
 *   • Freeform notes are appended without losing operator wording.
 *   • Combined output is human-readable AND consistent enough that
 *     Claude can parse it deterministically.
 */

describe("renderTargetingAsNotes", () => {
  it("returns empty string when no picks and no freeform notes", () => {
    expect(renderTargetingAsNotes(undefined, undefined)).toBe("");
    expect(renderTargetingAsNotes({}, undefined)).toBe("");
    expect(renderTargetingAsNotes({}, "")).toBe("");
    expect(renderTargetingAsNotes({}, "   ")).toBe("");
  });

  it("emits ONLY a Notes block when freeform notes are set but no structured picks", () => {
    const out = renderTargetingAsNotes(
      {},
      "Lean into clinical proof; competitors over-promise.",
    );
    expect(out).toBe(
      "Notes: Lean into clinical proof; competitors over-promise.",
    );
  });

  it("emits ONLY an Audience-targeting block when picks are set but no freeform notes", () => {
    const out = renderTargetingAsNotes(
      { gender: "female", awarenessLevel: "solution-aware" },
      undefined,
    );
    expect(out.startsWith("Audience targeting:")).toBe(true);
    expect(out).toContain("• Gender: Women");
    expect(out).toContain("• Awareness: Solution-aware");
    expect(out).not.toContain("Notes:");
  });

  it("combines both blocks with a blank-line separator", () => {
    const out = renderTargetingAsNotes(
      { gender: "female", market: "SA" },
      "additional context",
    );
    expect(out).toMatch(/Audience targeting:[\s\S]+\n\nNotes: additional context/);
  });

  it("formats age range correctly for both endpoints set", () => {
    expect(
      renderTargetingAsNotes({ ageMin: 25, ageMax: 40 }, undefined),
    ).toContain("• Age range: 25–40");
  });

  it("formats age range correctly for min only (open upper bound)", () => {
    expect(renderTargetingAsNotes({ ageMin: 25 }, undefined)).toContain(
      "• Age range: 25+",
    );
  });

  it("formats age range correctly for max only (open lower bound)", () => {
    expect(renderTargetingAsNotes({ ageMax: 40 }, undefined)).toContain(
      "• Age range: ≤ 40",
    );
  });

  it("includes the friendly market name when the ISO code is in the dictionary", () => {
    const out = renderTargetingAsNotes({ market: "SA" }, undefined);
    expect(out).toContain("• Market: Saudi Arabia (SA)");
  });

  it("falls back to the raw ISO code for markets outside the friendly dictionary", () => {
    // Schema requires uppercase 2-letter; "XX" is structurally valid
    // but has no friendly label — serializer must still emit it.
    const out = renderTargetingAsNotes({ market: "XX" }, undefined);
    expect(out).toContain("• Market: XX");
    expect(out).not.toContain("(undefined)");
  });

  it("expands enum values to their human labels (not the raw codes)", () => {
    const out = renderTargetingAsNotes(
      {
        awarenessLevel: "solution-aware",
        sophisticationLevel: "intermediate",
        emotionalAngle: "transformation",
        toneStyle: "luxurious",
      },
      undefined,
    );
    // The serializer MUST emit the human label — Claude reads
    // these in the strategy prompt and benefits from the
    // expanded explanations the operator picked from.
    expect(out).toContain("Solution-aware");
    expect(out).toContain("Intermediate");
    expect(out).toContain("Transformation");
    expect(out).toContain("Luxurious");
    // The raw enum should NOT leak through.
    expect(out).not.toMatch(/\bsolution-aware\b(?!.*\()/);
  });

  it("trims surrounding whitespace from freeform notes", () => {
    expect(renderTargetingAsNotes({}, "  hello  ")).toBe("Notes: hello");
  });

  it("omits bullets for fields not picked, even when others are set", () => {
    const out = renderTargetingAsNotes(
      { gender: "female", toneStyle: "playful" },
      undefined,
    );
    expect(out).toContain("• Gender: Women");
    expect(out).toContain("• Tone style: Playful");
    expect(out).not.toContain("Market");
    expect(out).not.toContain("Awareness");
    expect(out).not.toContain("Age range");
  });

  it("output is deterministic for the same input (run-to-run stability)", () => {
    const targeting = {
      gender: "female" as const,
      market: "SA",
      ageMin: 25,
      ageMax: 40,
      awarenessLevel: "solution-aware" as const,
    };
    const a = renderTargetingAsNotes(targeting, "context");
    const b = renderTargetingAsNotes(targeting, "context");
    expect(a).toBe(b);
  });
});
