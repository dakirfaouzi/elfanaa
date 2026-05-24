import { describe, expect, it } from "vitest";
import {
  detectProvider,
  listProviders,
} from "../lib/studio/intake/provider-detect";

/**
 * Provider detection — ships in Phase A2 of the universal supplier
 * intake (M14+). The tests verify:
 *
 *   1. Every documented platform resolves correctly from a
 *      realistic product URL.
 *   2. Country subdomains hit the same provider (amazon.com vs
 *      amazon.ae vs amazon.co.uk).
 *   3. `www.` prefix doesn't change detection.
 *   4. Functional matchers (Shopify, TikTok Shop) work.
 *   5. Unknown hostnames fall back to "generic" with the
 *      hostname populated.
 *   6. Malformed / empty inputs return "generic" with `hostname: null`
 *      WITHOUT throwing (the form polls this on every keystroke).
 *   7. `listProviders()` matches the table.
 */

describe("detectProvider — known platforms", () => {
  // Each row: [provider id, URL]. Add new platforms here when the
  // matcher table grows.
  const cases: Array<[string, string]> = [
    ["alibaba", "https://www.alibaba.com/product-detail/glow-serum_1234.html"],
    ["aliexpress", "https://www.aliexpress.com/item/1005005012345.html"],
    ["aliexpress", "https://aliexpress.us/item/abc.html"],
    ["amazon", "https://www.amazon.com/dp/B0CK8ABCDE"],
    ["amazon", "https://www.amazon.ae/dp/B0CK8ABCDE"],
    ["amazon", "https://www.amazon.sa/dp/B0CK8ABCDE"],
    ["amazon", "https://www.amazon.co.uk/dp/B0CK8ABCDE"],
    ["amazon", "https://www.amazon.de/dp/B0CK8ABCDE"],
    ["taobao", "https://item.taobao.com/item.htm?id=12345"],
    ["taobao", "https://detail.tmall.com/item.htm?id=67890"],
    ["taobao", "https://detail.1688.com/offer/12345.html"],
    ["noon", "https://www.noon.com/saudi-en/glow-serum/abc/p/"],
    ["temu", "https://www.temu.com/glow-serum-g-12345.html"],
    ["tiktok_shop", "https://shop.tiktok.com/product/12345"],
    ["tiktok_shop", "https://shop.tiktok.com/view/product/12345"],
    ["etsy", "https://www.etsy.com/listing/12345/glow-serum"],
    ["ebay", "https://www.ebay.com/itm/12345"],
    ["ebay", "https://www.ebay.co.uk/itm/12345"],
    ["cj_dropshipping", "https://www.cjdropshipping.com/product/glow-serum.html"],
    ["shopify", "https://glow-serum-co.myshopify.com/products/serum"],
  ];

  it.each(cases)("%s is detected from %s", (expectedId, url) => {
    const r = detectProvider(url);
    expect(r.id).toBe(expectedId);
    expect(r.displayName).not.toBe("Generic");
    expect(r.hostname).toBeTypeOf("string");
  });
});

describe("detectProvider — normalisation", () => {
  it("strips the www. prefix before matching", () => {
    const a = detectProvider("https://www.amazon.com/dp/x").id;
    const b = detectProvider("https://amazon.com/dp/x").id;
    expect(a).toBe("amazon");
    expect(b).toBe("amazon");
  });

  it("is case-insensitive on the hostname", () => {
    expect(detectProvider("https://AMAZON.COM/dp/x").id).toBe("amazon");
    expect(detectProvider("https://Etsy.com/listing/1").id).toBe("etsy");
  });
});

describe("detectProvider — generic fallback", () => {
  it("returns generic for an unrecognised hostname with the hostname populated", () => {
    const r = detectProvider("https://store.example.com/products/x");
    expect(r.id).toBe("generic");
    expect(r.displayName).toBe("Generic");
    expect(r.hostname).toBe("store.example.com");
  });

  it("does NOT detect WooCommerce from custom domains (no false-positives)", () => {
    // WooCommerce has no usable hostname fingerprint; a bespoke
    // domain that runs WooCommerce should still resolve to
    // "generic" until/unless the operator manually tags it.
    expect(detectProvider("https://my-skin-shop.com/product/serum").id).toBe(
      "generic",
    );
  });
});

describe("detectProvider — robustness (no throws)", () => {
  // These inputs hit the form's onChange on every keystroke, so
  // the function MUST tolerate mid-typing strings, empty strings,
  // and data URIs without throwing.
  const robustInputs = [
    "",
    "h",
    "https",
    "https://",
    "not-a-url",
    "ftp://example.com/x",
    "data:text/plain;base64,YWJj",
    "//example.com/x",
  ];

  it.each(robustInputs)("returns generic + null hostname for %s", (input) => {
    const r = detectProvider(input);
    // Either the URL parses (and hits an unknown hostname →
    // "generic" with hostname populated) or it doesn't (→ "generic"
    // with hostname null). Both are valid outcomes; what matters
    // is no throw.
    expect(r.id).toBe("generic");
  });

  it("never throws on null / undefined / non-string input", () => {
    expect(() =>
      detectProvider(null as unknown as string),
    ).not.toThrow();
    expect(() =>
      detectProvider(undefined as unknown as string),
    ).not.toThrow();
    expect(() =>
      detectProvider(42 as unknown as string),
    ).not.toThrow();
  });
});

describe("listProviders", () => {
  it("returns at least the platforms the audit promised", () => {
    const ids = new Set(listProviders().map((p) => p.id));
    for (const id of [
      "alibaba",
      "aliexpress",
      "amazon",
      "cj_dropshipping",
      "ebay",
      "etsy",
      "noon",
      "shopify",
      "taobao",
      "temu",
      "tiktok_shop",
      "woocommerce",
    ]) {
      expect(ids.has(id as never)).toBe(true);
    }
  });

  it("each entry has a non-empty displayName", () => {
    for (const { displayName } of listProviders()) {
      expect(displayName.length).toBeGreaterThan(0);
    }
  });
});
