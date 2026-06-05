import { describe, it, expect } from "vitest";
import { isPathActive, isShopContextActive } from "@/lib/nav/active";

describe("isPathActive", () => {
  it("matches exact paths", () => {
    expect(isPathActive("/about", "/about")).toBe(true);
    expect(isPathActive("/collections/face", "/collections/face")).toBe(true);
  });

  it("matches nested children", () => {
    expect(isPathActive("/about/team", "/about")).toBe(true);
  });

  it("does not match siblings or partial segments", () => {
    expect(isPathActive("/aboutus", "/about")).toBe(false);
    expect(isPathActive("/collections/hair", "/collections/face")).toBe(false);
  });

  it("treats root specially", () => {
    expect(isPathActive("/", "/")).toBe(true);
    expect(isPathActive("/shop", "/")).toBe(false);
  });
});

describe("isShopContextActive", () => {
  it("is true across all discovery surfaces", () => {
    expect(isShopContextActive("/shop")).toBe(true);
    expect(isShopContextActive("/collections")).toBe(true);
    expect(isShopContextActive("/collections/face")).toBe(true);
    expect(isShopContextActive("/concerns/dryness")).toBe(true);
    expect(isShopContextActive("/for/men")).toBe(true);
  });

  it("is false elsewhere", () => {
    expect(isShopContextActive("/")).toBe(false);
    expect(isShopContextActive("/about")).toBe(false);
    expect(isShopContextActive("/products/glow-serum")).toBe(false);
  });
});
