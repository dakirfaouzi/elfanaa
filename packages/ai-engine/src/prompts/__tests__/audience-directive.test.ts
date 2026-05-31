import { describe, expect, it } from "vitest";
import {
  buildAudienceDirective,
  summariseAudience,
} from "../audience-directive";

describe("buildAudienceDirective (Step 3)", () => {
  it("returns undefined for undefined / empty targeting (legacy behaviour)", () => {
    expect(buildAudienceDirective(undefined)).toBeUndefined();
    expect(buildAudienceDirective({})).toBeUndefined();
  });

  it("emits the awareness playbook line for the chosen awareness level", () => {
    const out = buildAudienceDirective({ awarenessLevel: "unaware" });
    expect(out).toBeDefined();
    expect(out).toContain("AUDIENCE & POSITIONING DIRECTIVE");
    expect(out).toContain("UNAWARE");
    expect(out).toMatch(/do NOT lead with features or price/i);
  });

  it("maps sophistication, emotional angle and tone to enforced instructions", () => {
    const out = buildAudienceDirective({
      sophisticationLevel: "expert",
      emotionalAngle: "status",
      toneStyle: "luxurious",
    })!;
    expect(out).toContain("sophistication: VERY HIGH");
    expect(out).toContain("STATUS");
    expect(out).toContain("LUXURIOUS");
  });

  it("describes a GCC market with a human label, not just the ISO code", () => {
    const out = buildAudienceDirective({ market: "AE" })!;
    expect(out).toContain("United Arab Emirates");
  });

  it("renders the age band and gendered address", () => {
    const out = buildAudienceDirective({
      gender: "female",
      ageMin: 25,
      ageMax: 40,
    })!;
    expect(out).toMatch(/Address a woman/i);
    expect(out).toContain("25–40");
  });

  it("marks the directive as binding / overriding generic defaults", () => {
    const out = buildAudienceDirective({ toneStyle: "playful" })!;
    expect(out).toMatch(/binding instruction/i);
    expect(out).toMatch(/the directive wins/i);
  });
});

describe("summariseAudience (Step 3)", () => {
  it("returns undefined when nothing meaningful is set", () => {
    expect(summariseAudience(undefined)).toBeUndefined();
    expect(summariseAudience({ gender: "any" })).toBeUndefined();
  });

  it("builds a compact casting summary", () => {
    const s = summariseAudience({
      gender: "female",
      ageMin: 25,
      ageMax: 40,
      market: "sa",
      toneStyle: "luxurious",
    });
    expect(s).toContain("female");
    expect(s).toContain("25-40");
    expect(s).toContain("SA");
    expect(s).toContain("luxurious tone");
  });
});
