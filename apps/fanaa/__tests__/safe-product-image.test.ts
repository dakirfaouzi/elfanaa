/**
 * SafeProductImage routing tests (Phase 2.5.1 placeholder fix).
 *
 * Background — production regression that motivated this file:
 *
 *   AI-generated products' inline-data-URL placeholder rendered
 *   correctly in 5 of 6 product surfaces (shop card, cart drawer
 *   line, cross-sell card, sticky bar, thank-you receipt) but
 *   produced a blank cream tile in the PDP gallery. The gallery
 *   is the ONLY surface that sets next/image's `priority` prop
 *   unconditionally (because it's the PDP's LCP element). Next.js
 *   15.5's data-URL bypass + `priority` combo turned out to be
 *   partially broken — the optimizer-skip path doesn't fully fire
 *   when the preload-link hint is also active.
 *
 *   The fix sidesteps next/image entirely for `data:` srcs by
 *   rendering a plain `<img>` with the same `fill`/`object-cover`
 *   positioning CSS next/image would have applied. The decision
 *   of WHICH branch to take is encoded in `pickImageStrategy()` —
 *   exported for unit-testability without standing up a jsdom +
 *   React Testing Library harness.
 *
 *   These tests pin the contract so a future Next.js upgrade or
 *   prop refactor doesn't silently re-route data URLs through the
 *   optimizer and re-introduce the blank-tile regression.
 */

import { describe, expect, it } from "vitest";
import { pickImageStrategy } from "@/components/product/SafeProductImage";
import { PLACEHOLDER_PRODUCT_IMAGE } from "@/lib/product-image";

describe("pickImageStrategy", () => {
  describe("https URLs (snapshot products with curated photography)", () => {
    it("routes to next-image for an https URL with fill", () => {
      expect(
        pickImageStrategy(
          "https://images.unsplash.com/photo-1.jpg",
          true,
          false,
        ),
      ).toBe("next-image");
    });

    it("routes to next-image for an https URL without fill", () => {
      expect(
        pickImageStrategy(
          "https://images.unsplash.com/photo-1.jpg",
          false,
          false,
        ),
      ).toBe("next-image");
    });

    it("routes to next-image for an http URL", () => {
      // Production never serves over http, but the routing logic
      // should still hand it to next/image so the optimizer can
      // handle the protocol.
      expect(
        pickImageStrategy("http://example.com/photo.jpg", true, false),
      ).toBe("next-image");
    });
  });

  describe("data URLs (AI-generated products' placeholder)", () => {
    it("routes to img-fill when src is the placeholder data URL and fill=true", () => {
      // This is the PDP gallery / shop card / cart drawer path —
      // every product surface uses `fill` mode for the wrapper
      // container's aspect ratio. The blank-tile regression was
      // specifically this combination silently routing to
      // next-image despite the data URL.
      expect(
        pickImageStrategy(PLACEHOLDER_PRODUCT_IMAGE.src, true, false),
      ).toBe("img-fill");
    });

    it("routes to img-fixed when src is the placeholder data URL and fill=false", () => {
      // Reserved for non-fill callers (currently none in the
      // product surfaces, but parity ensures the wrapper is
      // unconditionally safe to drop in).
      expect(
        pickImageStrategy(PLACEHOLDER_PRODUCT_IMAGE.src, false, false),
      ).toBe("img-fixed");
    });

    it("routes any data:image/svg+xml URL to the plain-img path", () => {
      // The placeholder happens to be SVG today; the contract is
      // "any data URL", not "this specific SVG". Future cache-
      // busted placeholders or runtime-generated thumbnails get
      // the same treatment.
      expect(
        pickImageStrategy("data:image/svg+xml;utf8,<svg/>", true, false),
      ).toBe("img-fill");
    });

    it("routes data:image/png;base64 URLs to the plain-img path", () => {
      expect(
        pickImageStrategy("data:image/png;base64,iVBORw0KGgo=", true, false),
      ).toBe("img-fill");
    });
  });

  describe("onError fallback", () => {
    it("routes to img-fill once hasError flips, regardless of original https src", () => {
      // The runtime symptom that drove this branch: Unsplash
      // photo IDs that 404 (operator-uploaded URLs that Unsplash
      // later unpublished, stale CDN cache from a previous
      // deploy). After the onError handler flips `hasError`,
      // every subsequent render must treat the effective src
      // (the placeholder data URL) as a data URL — not the
      // original failing https URL.
      expect(
        pickImageStrategy(
          "https://images.unsplash.com/photo-deleted.jpg",
          true,
          true,
        ),
      ).toBe("img-fill");
    });

    it("routes to img-fixed once hasError flips, when fill is not set", () => {
      expect(
        pickImageStrategy(
          "https://images.unsplash.com/photo-deleted.jpg",
          false,
          true,
        ),
      ).toBe("img-fixed");
    });
  });

  describe("edge cases", () => {
    it("treats non-string src (StaticImageData) as next-image", () => {
      // next/image accepts `string | StaticImageData`. Product
      // surfaces always pass strings via the image helpers, but
      // the routing must not crash if a bundled-asset import ever
      // reaches the wrapper.
      const staticAsset = { src: "/img/static.png", height: 100, width: 100 };
      expect(pickImageStrategy(staticAsset, true, false)).toBe("next-image");
    });

    it("treats undefined src as next-image (lets next/image surface its own error)", () => {
      expect(pickImageStrategy(undefined, true, false)).toBe("next-image");
    });

    it("treats empty string as next-image (caller bug — fail loud, don't swap silently)", () => {
      expect(pickImageStrategy("", true, false)).toBe("next-image");
    });
  });
});
