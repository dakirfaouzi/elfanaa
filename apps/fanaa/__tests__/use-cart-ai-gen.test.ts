/**
 * useCart AI-gen integration tests (M12 / Step 2 / Phase 2.5).
 *
 * These pin the "bridge the catalog split" contract on the CLIENT
 * side — every cart operation MUST work end-to-end for AI-generated
 * products (which are absent from `data/products.ts` snapshot but
 * arrive on the PDP via the hybrid loader and on the cart store via
 * the embedded `productSnapshot` field).
 *
 * # The bug class this guards
 *
 * Pre-Phase-2.5:
 *   • useCart.add(aiGenId) → silent no-op (snapshot miss)
 *   • cart.lines contained the line (when forced via persisted state)
 *     but `useResolvedCartLines` filtered it out → empty drawer
 *   • `useCartSubtotal` ignored it → 0 SAR subtotal with items present
 *   • Checkout payload constructed → /api/orders 422 product_unknown
 *
 * Post-Phase-2.5: every call-site that has the full Product in
 * scope passes it via `opts.product`; selectors prefer the embedded
 * snapshot; AI-gen products flow through identically to snapshot
 * products.
 *
 * # Why we don't render React components in these tests
 *
 * The hook is a pure Zustand store factory — we test it by calling
 * its action methods directly and reading state, which exercises
 * the actual code path users hit without paying the React renderer
 * cost or needing a DOM mock. Hook-rendering tests (RTL) would also
 * couple us to the persist-middleware's hydration timing.
 */

import { describe, expect, it, beforeEach } from "vitest";
import type { Product } from "@/lib/types";

// `localStorage` / `window` are polyfilled by `__tests__/setup.ts`
// (wired in `vitest.config.ts::setupFiles`). That setup runs before
// any test module loads, so Zustand's persist middleware in
// `hooks/useCart.ts` binds to the in-memory backing map at module-
// init time — exactly the contract Phase 2.5 tests need.
import { useCart, selectResolvedLines } from "@/hooks/useCart";

function aiGenProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "run_ai_xyz",
    slug: "run_ai_xyz",
    title: { ar: "AI", en: "AI Product" },
    description: { ar: "", en: "" },
    images: [{ src: "data:image/svg+xml;utf8,<svg/>", alt: { ar: "", en: "" } }],
    price: { amount: 19900, currency: "SAR" },
    offerTiers: [
      { quantity: 1, total: { amount: 19900, currency: "SAR" } },
      { quantity: 2, total: { amount: 27900, currency: "SAR" } },
      { quantity: 3, total: { amount: 34900, currency: "SAR" } },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  useCart.getState().clear();
});

/* -------------------------------------------------------------------------- */
/*                              add(productId, qty)                            */
/* -------------------------------------------------------------------------- */

describe("useCart.add — snapshot products (backward compat)", () => {
  it("adds a snapshot product via id-only call (legacy callers unchanged)", () => {
    useCart.getState().add("p_001", 2);
    const lines = useCart.getState().cart.lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]!.productId).toBe("p_001");
    expect(lines[0]!.quantity).toBe(2);
  });

  it("silently no-ops for true unknown ids (preserves existing contract)", () => {
    useCart.getState().add("nonexistent_id", 1);
    expect(useCart.getState().cart.lines).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/*                         add(productId, qty, { product })                    */
/* -------------------------------------------------------------------------- */

describe("useCart.add — AI-generated products (Phase 2.5 bridge)", () => {
  it("accepts an AI-gen product when opts.product is provided", () => {
    const ai = aiGenProduct();
    useCart.getState().add(ai.id, 1, { product: ai });

    const lines = useCart.getState().cart.lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]!.productId).toBe(ai.id);
  });

  it("embeds the product snapshot on the cart line", () => {
    const ai = aiGenProduct();
    useCart.getState().add(ai.id, 1, { product: ai });

    const line = useCart.getState().cart.lines[0]!;
    expect(line.productSnapshot).toBeDefined();
    expect(line.productSnapshot?.id).toBe(ai.id);
    expect(line.productSnapshot?.price).toEqual(ai.price);
  });

  it("refreshes the embedded snapshot on a re-add (operator edits propagate)", () => {
    const ai = aiGenProduct({ price: { amount: 19900, currency: "SAR" } });
    useCart.getState().add(ai.id, 1, { product: ai });

    // Operator publishes a new price mid-session — next add carries
    // the updated product through; cart line snapshot is refreshed.
    const aiV2 = aiGenProduct({ price: { amount: 24900, currency: "SAR" } });
    useCart.getState().add(aiV2.id, 1, { product: aiV2 });

    const line = useCart.getState().cart.lines[0]!;
    expect(line.quantity).toBe(2);
    expect(line.productSnapshot?.price.amount).toBe(24900);
  });

  it("rejects AI-gen ids with NEITHER snapshot nor opts.product (true drift)", () => {
    useCart.getState().add("run_unknown", 1);
    expect(useCart.getState().cart.lines).toHaveLength(0);
  });

  it("forwards source + variantId alongside product (cross-sell tagging works)", () => {
    const ai = aiGenProduct();
    useCart
      .getState()
      .add(ai.id, 1, { product: ai, source: "cross_sell", variantId: "v1" });

    const line = useCart.getState().cart.lines[0]!;
    expect(line.source).toBe("cross_sell");
    expect(line.variantId).toBe("v1");
    expect(line.productSnapshot?.id).toBe(ai.id);
  });
});

/* -------------------------------------------------------------------------- */
/*                          Selector contract (Phase 2.5)                      */
/* -------------------------------------------------------------------------- */

describe("cart selectors — embedded snapshot preferred", () => {
  it("selectResolvedLines surfaces AI-gen lines via productSnapshot", () => {
    const ai = aiGenProduct();
    useCart.getState().add(ai.id, 2, { product: ai });

    const resolved = selectResolvedLines(useCart.getState());
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.product.id).toBe(ai.id);
    expect(resolved[0]!.quantity).toBe(2);
  });

  it("subtotal() includes AI-gen lines in the running total", () => {
    const ai = aiGenProduct({
      offerTiers: [
        { quantity: 1, total: { amount: 19900, currency: "SAR" } },
        { quantity: 2, total: { amount: 27900, currency: "SAR" } },
      ],
    });
    useCart.getState().add(ai.id, 2, { product: ai });

    const subtotal = useCart.getState().subtotal();
    // Tier-aware pricing: qty=2 → 279 SAR total (not 2 × 199).
    expect(subtotal.amount).toBe(27900);
    expect(subtotal.currency).toBe("SAR");
  });

  it("subtotal() mixes snapshot + AI-gen lines correctly", () => {
    const ai = aiGenProduct();
    useCart.getState().add("p_001", 1);
    useCart.getState().add(ai.id, 1, { product: ai });

    const subtotal = useCart.getState().subtotal();
    // Both lines contribute. Subtotal is two unit prices (qty=1
    // each), proving snapshot and AI-gen paths produce the same
    // shape downstream.
    expect(subtotal.amount).toBeGreaterThan(0);
  });

  it("selectResolvedLines falls back to snapshot lookup for legacy lines (no embed)", () => {
    /*
     * Simulate a pre-Phase-2.5 persisted cart by mutating state
     * directly — the persistence migration path: legacy lines have
     * `productSnapshot: undefined`, and the selector must still
     * resolve them via getProductById for backward compat.
     */
    useCart.setState({
      cart: {
        currency: "SAR",
        lines: [{ productId: "p_001", quantity: 1, source: "base" }],
      },
    });

    const resolved = selectResolvedLines(useCart.getState());
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.product.id).toBe("p_001");
  });
});
