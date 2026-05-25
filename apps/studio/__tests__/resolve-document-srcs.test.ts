import { describe, expect, it } from "vitest";
import type { DraftDocument } from "@platform/builder-schema";
import { resolveDocumentSrcs } from "../lib/studio/resolve-document-srcs";

/**
 * C3.1 follow-up — `resolveDocumentSrcs()` walks a DraftDocument and
 * returns a fresh copy where every media src has been routed through
 * `resolveAssetUrl()`.
 *
 * The walker is the bridge between the unchanged shared renderer
 * (`@platform/runtime-renderer/<Media>`, which writes `desktopSrc`
 * straight into `<img src>`) and the Studio mount sites (builder
 * preview pane + `/p/<slug>` storefront), where R2 keys must be
 * translated into proxy URLs before they reach the renderer.
 *
 * # Coverage focus
 *
 *   1. Every section kind that carries media is traversed correctly.
 *   2. Sections without media pass through unchanged.
 *   3. The input document is NEVER mutated.
 *   4. Empty / null media slots stay empty / null.
 *   5. `meta.ogImage` is resolved (drives OG-card scraping).
 */

function makeMinimalDoc(over?: Partial<DraftDocument>): DraftDocument {
  return {
    version: 1,
    meta: {
      title: { ar: "س", en: "S" },
      slug: "s",
      keywords: [],
      ...(over?.meta ?? {}),
    },
    sections: over?.sections ?? [],
  } as DraftDocument;
}

describe("resolveDocumentSrcs", () => {
  it("returns a fresh document (does NOT mutate the input)", () => {
    const original = makeMinimalDoc({
      sections: [
        {
          id: "sec_h",
          kind: "hero",
          enabled: true,
          title: { en: "H" },
          media: { kind: "image", desktopSrc: "studio-intake/fanaa/01H.webp" },
          align: "center",
        },
      ],
    });
    const snapshot = JSON.stringify(original);
    resolveDocumentSrcs(original);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("resolves meta.ogImage when present", () => {
    const doc = makeMinimalDoc({
      meta: {
        title: { en: "X" },
        slug: "x",
        ogImage: "studio-intake/fanaa/01H.webp",
        keywords: [],
      },
    });
    const out = resolveDocumentSrcs(doc);
    expect(out.meta.ogImage).toMatch(
      /\/api\/studio\/media\/studio-intake\/fanaa\/01H\.webp$/,
    );
  });

  it("leaves meta untouched when ogImage is absent", () => {
    const doc = makeMinimalDoc();
    const out = resolveDocumentSrcs(doc);
    expect(out.meta).toBe(doc.meta);
  });

  it("resolves hero.media.desktopSrc and preserves the alt", () => {
    const doc = makeMinimalDoc({
      sections: [
        {
          id: "sec_h",
          kind: "hero",
          enabled: true,
          title: { en: "H" },
          media: {
            kind: "image",
            desktopSrc: "studio-intake/fanaa/01H.webp",
            alt: "Hero",
          },
          align: "center",
        },
      ],
    });
    const out = resolveDocumentSrcs(doc);
    const hero = out.sections[0];
    expect(hero.kind).toBe("hero");
    if (hero.kind !== "hero") throw new Error();
    expect(hero.media?.desktopSrc).toMatch(
      /\/api\/studio\/media\/studio-intake\/fanaa\/01H\.webp$/,
    );
    expect(hero.media?.alt).toBe("Hero");
  });

  it("resolves hero.media.mobileSrc and poster when present", () => {
    const doc = makeMinimalDoc({
      sections: [
        {
          id: "sec_h",
          kind: "hero",
          enabled: true,
          title: { en: "H" },
          media: {
            kind: "image",
            desktopSrc: "studio-intake/fanaa/01H.webp",
            mobileSrc: "studio-intake/fanaa/01M.webp",
            poster: "studio-intake/fanaa/01P.webp",
          },
          align: "center",
        },
      ],
    });
    const out = resolveDocumentSrcs(doc);
    const hero = out.sections[0];
    if (hero.kind !== "hero" || !hero.media) throw new Error();
    expect(hero.media.mobileSrc).toMatch(/\/api\/studio\/media\//);
    expect(hero.media.poster).toMatch(/\/api\/studio\/media\//);
  });

  it("preserves null hero.media", () => {
    const doc = makeMinimalDoc({
      sections: [
        {
          id: "sec_h",
          kind: "hero",
          enabled: true,
          title: { en: "H" },
          media: null,
          align: "center",
        },
      ],
    });
    const out = resolveDocumentSrcs(doc);
    const hero = out.sections[0];
    if (hero.kind !== "hero") throw new Error();
    expect(hero.media).toBeNull();
  });

  it("resolves before_after.pairs[].before/after media", () => {
    const doc = makeMinimalDoc({
      sections: [
        {
          id: "sec_ba",
          kind: "before_after",
          enabled: true,
          pairs: [
            {
              id: "p1",
              before: {
                kind: "image",
                desktopSrc: "studio-intake/fanaa/01B.webp",
              },
              after: {
                kind: "image",
                desktopSrc: "studio-intake/fanaa/01A.webp",
              },
            },
          ],
          layout: "side_by_side",
        },
      ],
    });
    const out = resolveDocumentSrcs(doc);
    const sec = out.sections[0];
    if (sec.kind !== "before_after") throw new Error();
    expect(sec.pairs[0].before.desktopSrc).toMatch(/\/api\/studio\/media\//);
    expect(sec.pairs[0].after.desktopSrc).toMatch(/\/api\/studio\/media\//);
  });

  it("resolves testimonials[].avatar when present", () => {
    const doc = makeMinimalDoc({
      sections: [
        {
          id: "sec_t",
          kind: "testimonials",
          enabled: true,
          items: [
            {
              id: "t1",
              author: "Sara",
              quote: { ar: "ج", en: "G" },
              avatar: {
                kind: "image",
                desktopSrc: "studio-intake/fanaa/01T.webp",
              },
            },
            {
              id: "t2",
              author: "Nour",
              quote: { ar: "ج", en: "G" },
              avatar: null,
            },
          ],
          display: "grid",
        },
      ],
    });
    const out = resolveDocumentSrcs(doc);
    const sec = out.sections[0];
    if (sec.kind !== "testimonials") throw new Error();
    expect(sec.items[0].avatar?.desktopSrc).toMatch(/\/api\/studio\/media\//);
    expect(sec.items[1].avatar).toBeNull();
  });

  it("resolves video.media and its poster", () => {
    const doc = makeMinimalDoc({
      sections: [
        {
          id: "sec_v",
          kind: "video",
          enabled: true,
          media: {
            kind: "video",
            desktopSrc: "studio-intake/fanaa/01V.mp4",
            poster: "studio-intake/fanaa/01PO.webp",
          },
          autoplay: false,
          loop: false,
          muted: true,
          controls: true,
        },
      ],
    });
    const out = resolveDocumentSrcs(doc);
    const sec = out.sections[0];
    if (sec.kind !== "video" || !sec.media) throw new Error();
    expect(sec.media.desktopSrc).toMatch(/\/api\/studio\/media\//);
    expect(sec.media.poster).toMatch(/\/api\/studio\/media\//);
  });

  it("resolves every image_gallery item", () => {
    const doc = makeMinimalDoc({
      sections: [
        {
          id: "sec_g",
          kind: "image_gallery",
          enabled: true,
          items: [
            { kind: "image", desktopSrc: "studio-intake/fanaa/01.webp" },
            { kind: "image", desktopSrc: "studio-intake/fanaa/02.webp" },
            { kind: "image", desktopSrc: "https://cdn.example.com/abs.webp" },
          ],
          columns: 3,
        },
      ],
    });
    const out = resolveDocumentSrcs(doc);
    const sec = out.sections[0];
    if (sec.kind !== "image_gallery") throw new Error();
    expect(sec.items[0].desktopSrc).toMatch(/\/api\/studio\/media\/studio-intake\/fanaa\/01\.webp$/);
    expect(sec.items[1].desktopSrc).toMatch(/\/api\/studio\/media\/studio-intake\/fanaa\/02\.webp$/);
    // Already-absolute URLs pass through.
    expect(sec.items[2].desktopSrc).toBe("https://cdn.example.com/abs.webp");
  });

  it("passes media-free sections through unchanged", () => {
    const doc = makeMinimalDoc({
      sections: [
        {
          id: "sec_c",
          kind: "cta",
          enabled: true,
          title: { en: "Buy" },
          primaryLabel: { en: "Shop" },
          primaryHref: "#order",
          variant: "solid",
        },
        {
          id: "sec_b",
          kind: "benefits",
          enabled: true,
          items: [
            { id: "b1", title: { en: "Fast" }, body: { en: "..." } },
          ],
          columns: 3,
        },
        {
          id: "sec_f",
          kind: "faq",
          enabled: true,
          items: [
            {
              id: "f1",
              question: { en: "Q?" },
              answer: { en: "A." },
            },
          ],
        },
        {
          id: "sec_s",
          kind: "sticky_cta",
          enabled: true,
          label: { en: "Buy" },
          href: "#order",
          bottomOffsetPx: 0,
        },
        {
          id: "sec_r",
          kind: "rich_text",
          enabled: true,
          body: { en: "Hello." },
          width: "narrow",
        },
      ],
    });
    const out = resolveDocumentSrcs(doc);
    // Each section identity-preserved or content-equivalent.
    expect(out.sections.length).toBe(doc.sections.length);
    for (let i = 0; i < out.sections.length; i++) {
      expect(out.sections[i].kind).toBe(doc.sections[i].kind);
      expect(out.sections[i].id).toBe(doc.sections[i].id);
    }
  });

  it("leaves absolute desktopSrc alone for mixed inputs (smoke)", () => {
    const doc = makeMinimalDoc({
      sections: [
        {
          id: "sec_h",
          kind: "hero",
          enabled: true,
          title: { en: "H" },
          media: {
            kind: "image",
            desktopSrc: "https://cdn.example.com/h.webp",
          },
          align: "center",
        },
      ],
    });
    const out = resolveDocumentSrcs(doc);
    const hero = out.sections[0];
    if (hero.kind !== "hero" || !hero.media) throw new Error();
    expect(hero.media.desktopSrc).toBe("https://cdn.example.com/h.webp");
  });
});
