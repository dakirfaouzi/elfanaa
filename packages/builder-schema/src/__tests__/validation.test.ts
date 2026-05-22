import { describe, expect, it } from "vitest";
import { validateForPublish } from "../validation";
import { makeBlankDraft, makeBlankSection } from "../factories";

let n = 0;
const id = () => `sec_${++n}`;

describe("validateForPublish", () => {
  it("blank draft fails (no title, missing hero media warning, etc.)", () => {
    const draft = makeBlankDraft({
      slug: "x",
      title: {},
      newId: id,
    });
    const result = validateForPublish(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = result.issues.map((i) => i.code);
      expect(codes).toContain("title_missing");
      expect(codes).toContain("hero_title_missing");
    }
  });

  it("draft with title + hero + cta + media passes (with warnings)", () => {
    const draft = makeBlankDraft({
      slug: "glow-serum",
      title: { en: "Glow Serum" },
      newId: id,
    });
    const hero = draft.sections[0];
    if (hero.kind === "hero") {
      hero.title = { en: "Glow Serum" };
      hero.media = {
        kind: "image",
        desktopSrc: "https://cdn.example.com/glow.jpg",
        alt: "glow",
      };
    }
    const cta = draft.sections[1];
    if (cta.kind === "cta") {
      cta.title = { en: "Order now" };
      cta.primaryLabel = { en: "Buy" };
      cta.primaryHref = "/order";
    }
    const result = validateForPublish(draft);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const warnCodes = result.warnings.map((w) => w.code);
      expect(warnCodes).toContain("no_faq");
      expect(warnCodes).toContain("no_testimonials");
    }
  });

  it("missing hero produces an error", () => {
    const draft = makeBlankDraft({
      slug: "x",
      title: { en: "X" },
      newId: id,
    });
    draft.sections = [makeBlankSection("cta", id)];
    const cta = draft.sections[0];
    if (cta.kind === "cta") {
      cta.title = { en: "Buy" };
      cta.primaryLabel = { en: "Buy" };
      cta.primaryHref = "/x";
    }
    const result = validateForPublish(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "hero_missing")).toBe(true);
    }
  });

  it("missing cta and sticky cta produces an error", () => {
    const draft = makeBlankDraft({
      slug: "x",
      title: { en: "X" },
      newId: id,
    });
    const hero = draft.sections[0];
    if (hero.kind === "hero") {
      hero.title = { en: "X" };
      hero.media = { kind: "image", desktopSrc: "https://x", alt: "x" };
    }
    draft.sections = [hero];
    const result = validateForPublish(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "cta_missing")).toBe(true);
    }
  });

  it("video section without media is an error", () => {
    const draft = makeBlankDraft({
      slug: "x",
      title: { en: "X" },
      newId: id,
    });
    const hero = draft.sections[0];
    if (hero.kind === "hero") {
      hero.title = { en: "X" };
      hero.media = { kind: "image", desktopSrc: "https://x", alt: "x" };
    }
    const cta = draft.sections[1];
    if (cta.kind === "cta") {
      cta.title = { en: "Buy" };
      cta.primaryLabel = { en: "Buy" };
      cta.primaryHref = "/x";
    }
    draft.sections.push(makeBlankSection("video", id));
    const result = validateForPublish(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "video_missing_media")).toBe(true);
    }
  });

  it("rejects malformed input", () => {
    const result = validateForPublish({ not: "a draft" });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid slug", () => {
    const draft = makeBlankDraft({
      slug: "Bad Slug!",
      title: { en: "X" },
      newId: id,
    });
    const result = validateForPublish(draft);
    expect(result.ok).toBe(false);
  });

  it("disabled sections are ignored when counting hero/cta", () => {
    const draft = makeBlankDraft({
      slug: "x",
      title: { en: "X" },
      newId: id,
    });
    draft.sections[0].enabled = false;
    draft.sections[1].enabled = false;
    const result = validateForPublish(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = result.issues.map((i) => i.code);
      expect(codes).toContain("hero_missing");
      expect(codes).toContain("cta_missing");
    }
  });
});
