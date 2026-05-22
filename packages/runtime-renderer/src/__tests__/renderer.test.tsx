import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  makeBlankDraft,
  makeBlankSection,
  type DraftDocument,
} from "@platform/builder-schema";
import { DraftRenderer } from "../DraftRenderer";
import { buildPageMetadata } from "../metadata";

let n = 0;
const id = () => `sec_${++n}`;

function reset() {
  n = 0;
}

function buildSampleDraft(): DraftDocument {
  reset();
  const draft = makeBlankDraft({
    slug: "glow-serum",
    title: { en: "Glow Serum", ar: "سيروم متألق" },
    newId: id,
  });
  const hero = draft.sections[0];
  if (hero.kind === "hero") {
    hero.title = { en: "Glow Serum", ar: "سيروم متألق" };
    hero.subtitle = { en: "Brightens", ar: "يضيء" };
    hero.media = {
      kind: "image",
      desktopSrc: "https://cdn.example.com/hero.jpg",
      mobileSrc: "https://cdn.example.com/hero-m.jpg",
      alt: "hero",
    };
    hero.ctaLabel = { en: "Buy", ar: "اشترِ" };
    hero.ctaHref = "/order";
  }
  const cta = draft.sections[1];
  if (cta.kind === "cta") {
    cta.title = { en: "Order now", ar: "اطلب الآن" };
    cta.primaryLabel = { en: "Buy", ar: "اشترِ" };
    cta.primaryHref = "/order";
  }
  return draft;
}

describe("DraftRenderer", () => {
  it("renders an article with the locale direction", () => {
    const html = renderToStaticMarkup(<DraftRenderer document={buildSampleDraft()} primary="ar" />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
  });

  it("emits a section per visible block", () => {
    const html = renderToStaticMarkup(<DraftRenderer document={buildSampleDraft()} primary="en" />);
    expect(html).toContain('data-section-kind="hero"');
    expect(html).toContain('data-section-kind="cta"');
  });

  it("skips disabled sections", () => {
    const draft = buildSampleDraft();
    draft.sections[0].enabled = false;
    const html = renderToStaticMarkup(<DraftRenderer document={draft} primary="en" />);
    expect(html).not.toContain('data-section-kind="hero"');
  });

  it("renders mobile + desktop variants via <picture>", () => {
    const html = renderToStaticMarkup(<DraftRenderer document={buildSampleDraft()} primary="en" />);
    expect(html).toContain("<picture>");
    expect(html).toContain("<source");
    expect(html).toContain("hero-m.jpg");
    expect(html).toContain("hero.jpg");
  });

  it("renders sticky CTA last so it stacks correctly", () => {
    const draft = buildSampleDraft();
    const sticky = makeBlankSection("sticky_cta", id);
    if (sticky.kind === "sticky_cta") {
      sticky.label = { en: "Buy" };
      sticky.href = "/order";
    }
    draft.sections.splice(0, 0, sticky);
    const html = renderToStaticMarkup(<DraftRenderer document={draft} primary="en" />);
    const stickyIdx = html.indexOf("pfp-sticky");
    const heroIdx = html.indexOf('data-section-kind="hero"');
    expect(stickyIdx).toBeGreaterThan(heroIdx);
  });

  it("renders FAQ with native <details>", () => {
    const draft = buildSampleDraft();
    const faq = makeBlankSection("faq", id);
    if (faq.kind === "faq") {
      faq.title = { en: "FAQ" };
      faq.items = [
        { id: id(), question: { en: "Is it safe?" }, answer: { en: "Yes." } },
      ];
    }
    draft.sections.push(faq);
    const html = renderToStaticMarkup(<DraftRenderer document={draft} primary="en" />);
    expect(html).toContain("<details");
    expect(html).toContain("Is it safe?");
  });

  it("renders RichText with **bold** segments as <strong>", () => {
    const draft = buildSampleDraft();
    const rt = makeBlankSection("rich_text", id);
    if (rt.kind === "rich_text") {
      rt.body = { en: "Hello **world** today" };
    }
    draft.sections.push(rt);
    const html = renderToStaticMarkup(<DraftRenderer document={draft} primary="en" />);
    expect(html).toContain("<strong>world</strong>");
  });

  it("RichText escapes raw HTML in the body", () => {
    const draft = buildSampleDraft();
    const rt = makeBlankSection("rich_text", id);
    if (rt.kind === "rich_text") {
      rt.body = { en: "<script>alert('x')</script>" };
    }
    draft.sections.push(rt);
    const html = renderToStaticMarkup(<DraftRenderer document={draft} primary="en" />);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("video renderer outputs <video> with poster + controls", () => {
    const draft = buildSampleDraft();
    const vid = makeBlankSection("video", id);
    if (vid.kind === "video") {
      vid.media = {
        kind: "video",
        desktopSrc: "https://cdn.example.com/v.mp4",
        poster: "https://cdn.example.com/p.jpg",
      };
      vid.controls = true;
      vid.autoplay = false;
    }
    draft.sections.push(vid);
    const html = renderToStaticMarkup(<DraftRenderer document={draft} primary="en" />);
    expect(html).toContain('<video');
    expect(html).toContain('poster="https://cdn.example.com/p.jpg"');
    expect(html).toContain("controls");
  });

  it("hero falls back to the other locale when primary is empty", () => {
    reset();
    const draft = makeBlankDraft({
      slug: "x",
      title: { en: "Only English" },
      newId: id,
    });
    const hero = draft.sections[0];
    if (hero.kind === "hero") {
      hero.title = { en: "Only English" };
      hero.media = { kind: "image", desktopSrc: "https://x" };
    }
    const cta = draft.sections[1];
    if (cta.kind === "cta") {
      cta.title = { en: "Buy" };
      cta.primaryLabel = { en: "Buy" };
      cta.primaryHref = "/x";
    }
    const html = renderToStaticMarkup(<DraftRenderer document={draft} primary="ar" />);
    expect(html).toContain("Only English");
  });
});

describe("buildPageMetadata", () => {
  it("returns title + description + ogImage", () => {
    const draft = buildSampleDraft();
    const md = buildPageMetadata(draft, { primary: "en" });
    expect(md.title).toBe("Glow Serum");
    expect(md.description).toBe("Brightens");
    expect(md.ogImage).toBe("https://cdn.example.com/hero.jpg");
    expect(md.locale).toBe("en_US");
  });

  it("falls back to gallery image when hero has no media", () => {
    const draft = buildSampleDraft();
    const hero = draft.sections[0];
    if (hero.kind === "hero") hero.media = null;
    const gallery = makeBlankSection("image_gallery", id);
    if (gallery.kind === "image_gallery") {
      gallery.items = [
        { kind: "image", desktopSrc: "https://cdn/g.jpg", alt: "g" },
      ];
    }
    draft.sections.push(gallery);
    const md = buildPageMetadata(draft, { primary: "en" });
    expect(md.ogImage).toBe("https://cdn/g.jpg");
  });
});
