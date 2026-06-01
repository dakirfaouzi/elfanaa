import { describe, expect, it } from "vitest";
import { sanitiseCroContentImages } from "../lib/studio/drafts-service";

/**
 * Section-agnostic cro_content image durability (Step 4 Phase 4.5.1, req #2).
 *
 * The publish path must never STORE a temporary vendor URL in cro_content,
 * regardless of which section the image belongs to. The walk normalises durable
 * refs to absolute CDN URLs and drops non-durable ones (counting them so the
 * publish flow can warn).
 */

const CDN = "https://cdn.elfanaa.com";

function sanitise(value: unknown) {
  const counter = { dropped: 0 };
  const out = sanitiseCroContentImages(value, CDN, counter);
  return { out, dropped: counter.dropped };
}

describe("sanitiseCroContentImages", () => {
  it("normalises a bare-key lifestyleImage to an absolute CDN url", () => {
    const { out, dropped } = sanitise({
      lifestyleImage: { src: "studio/d/generated/life.png", alt: { en: "l" } },
    });
    expect((out as any).lifestyleImage.src).toBe(
      "https://cdn.elfanaa.com/studio/d/generated/life.png",
    );
    expect(dropped).toBe(0);
  });

  it("keeps an already-durable CDN url", () => {
    const { out, dropped } = sanitise({
      images: [{ src: "https://cdn.elfanaa.com/hero.png", alt: { en: "h" } }],
    });
    expect((out as any).images[0].src).toBe("https://cdn.elfanaa.com/hero.png");
    expect(dropped).toBe(0);
  });

  it("DROPS a foreign/vendor url and counts it (never persists vendor)", () => {
    const { out, dropped } = sanitise({
      lifestyleImage: { src: "https://fal.media/files/life.png", alt: { en: "l" } },
    });
    expect((out as any).lifestyleImage.src).toBe("");
    expect(dropped).toBe(1);
  });

  it("walks nested section images (future sections inherit the guarantee)", () => {
    const { out, dropped } = sanitise({
      sectionContent: {
        transformation: {
          image: { src: "studio/d/generated/before-after.png", alt: { en: "t" } },
        },
        proof: {
          shots: [
            { src: "https://fal.media/files/p1.png" },
            { src: "r2://fanaa-bucket/studio/d/p2.png" },
          ],
        },
      },
    });
    const sc = (out as any).sectionContent;
    expect(sc.transformation.image.src).toBe(
      "https://cdn.elfanaa.com/studio/d/generated/before-after.png",
    );
    expect(sc.proof.shots[0].src).toBe(""); // vendor dropped
    expect(sc.proof.shots[1].src).toBe(
      "https://cdn.elfanaa.com/studio/d/p2.png",
    ); // r2:// normalised
    expect(dropped).toBe(1);
  });

  it("leaves non-image data untouched", () => {
    const { out } = sanitise({
      headline: { ar: "ع", en: "H" },
      sectionOrder: ["benefits", "faq"],
      benefits: [{ icon: "Shield", title: { en: "B" } }],
    });
    expect((out as any).headline).toEqual({ ar: "ع", en: "H" });
    expect((out as any).sectionOrder).toEqual(["benefits", "faq"]);
    expect((out as any).benefits[0].icon).toBe("Shield");
  });
});
