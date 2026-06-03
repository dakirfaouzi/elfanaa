"""
Regression guard — base product MUST survive the order pipeline.

What this script exists to prove (and never let regress):

    Before the catalog-sync fix, the FastAPI re-pricer silently dropped
    any cart line whose `product_id` was not in `PRODUCTS`. Production
    storefront sent `p_004` (Sugarbear) and the backend catalog still
    held placeholder home-decor entries (Majlis Cushion / Courtyard
    Lantern / Ceramic Vase). Outcome:
        order.items   = [{p_003 (cross-sell), qty=3}]   ← base gone
        Sheets row    = "0/0/3"
        After upsell  = "0/1/3"   ← the live regression
        Thank-you     = no base product on receipt

    The fix has two parts:
      1. `catalog.PRODUCTS` mirrors `data/products.ts` (incl. p_004).
      2. `_reprice_cart` now RAISES `OrderError("product_unknown", ...)`
         on any id it cannot resolve, so future drift fails loudly.

This script exercises both halves without needing Postgres or HTTP:
    • Builds CartLineIn-shaped objects in memory.
    • Drives `_reprice_cart` directly.
    • Pipes the result through the dynamic `build_order_row` builder
      to verify the row layout matches the storefront's expectation.

Note: as of the dynamic-stack rewrite (see `_validate_dynamic_stack.py`),
the row builder no longer pads to 3 slots and no longer SUMS multiple
lines into a single bucket. Each accepted line gets its own segment.
The expected values below reflect that — `1/0/0` became `1`, `1/0/3`
became `1/3`, etc.

Run from repo root (Windows PowerShell):
    backend/.venv/Scripts/python backend/_validate_base_preserved.py
Or from POSIX:
    backend/.venv/bin/python backend/_validate_base_preserved.py
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Iterable, List

# Allow running from anywhere — anchor sys.path on /backend so
# `app.services.*` imports resolve identically to the live container.
_THIS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_THIS_DIR))

# Force UTF-8 stdout on Windows — Arabic product names choke cp1252.
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass


# ── Lightweight CartLineIn stand-in ──────────────────────────────────
# We bypass Pydantic deliberately — the validator would refuse "unknown"
# product ids if we tried to test the error path through it. Duck-typing
# `.product_id`, `.quantity`, `.source` (and accepting `getattr` fallback)
# is exactly what `_reprice_cart` consumes.

class _Line:
    def __init__(self, product_id: str, quantity: int, source: str = "base"):
        self.product_id = product_id
        self.quantity = quantity
        self.source = source

    def __repr__(self) -> str:
        return f"_Line(product_id={self.product_id!r}, quantity={self.quantity}, source={self.source!r})"


# ── Imports under test ────────────────────────────────────────────────

import asyncio  # noqa: E402

from app.services.orders import _reprice_cart as _reprice_cart_async, OrderError  # noqa: E402
from app.services.catalog import (  # noqa: E402
    PRODUCTS,
    get_product,
    known_product_ids,
)
from app.services.webhooks import build_order_row  # noqa: E402


def _reprice_cart(lines) -> List[dict]:
    """Sync wrapper for the (now async) re-pricer.

    This harness exercises curated-only lines with no DB session, so the
    re-pricer never touches Postgres — `asyncio.run` is sufficient and keeps
    every existing test body unchanged.
    """
    return asyncio.run(_reprice_cart_async(lines))


# ── Helpers ───────────────────────────────────────────────────────────

PASSED = 0
FAILED = 0


def _check(name: str, got, expected) -> None:
    global PASSED, FAILED
    ok = got == expected
    label = "ok  " if ok else "FAIL"
    print(f"  [{label}] {name}")
    if not ok:
        print(f"          got      = {got!r}")
        print(f"          expected = {expected!r}")
        FAILED += 1
    else:
        PASSED += 1


def _row_for(repriced: List[dict]) -> dict:
    """Reuse the production dynamic builder so this test catches divergence."""
    items = []
    for it in repriced:
        product = get_product(it["product_id"])
        items.append(
            {
                "sku": product.resolved_sku() if product else "FN-UNKNOWN",
                "name": it["title"],
                "quantity": it["quantity"],
                "url": product.canonical_path() if product else "",
                "source": it["source"],
            }
        )
    return build_order_row(items)


# ── Test cases ────────────────────────────────────────────────────────

def case_catalog_has_sugarbear() -> None:
    print("CASE catalog mirror includes p_004 (Sugarbear)")
    ids = known_product_ids()
    _check("p_001 in PRODUCTS", "p_001" in ids, True)
    _check("p_002 in PRODUCTS", "p_002" in ids, True)
    _check("p_003 in PRODUCTS", "p_003" in ids, True)
    _check("p_004 in PRODUCTS (regression-critical)", "p_004" in ids, True)

    sugar = get_product("p_004")
    assert sugar is not None
    _check("p_004 SKU is FN-SUG-004", sugar.resolved_sku(), "FN-SUG-004")
    _check("p_004 AR title", sugar.title("ar"), "فيتامينات سوجاربير للشعر")
    _check("p_004 collection", sugar.collection, "hair")


def case_base_only_sugarbear() -> None:
    print("CASE base only — Sugarbear x1 (no upsell, no cross-sell)")
    repriced = _reprice_cart([_Line("p_004", 1, "base")])
    row = _row_for(repriced)
    # Single line  →  single-segment row (dynamic builder, no padding).
    _check("totalQuantity == '1'", row["totalQuantity"], "1")
    _check("sku == 'FN-SUG-004'", row["sku"], "FN-SUG-004")


def case_base_plus_cross_sell() -> None:
    print("CASE base + cross-sell — Sugarbear x1 + Hair Mask x3 (cross_sell)")
    repriced = _reprice_cart(
        [
            _Line("p_004", 1, "base"),
            _Line("p_003", 3, "cross_sell"),
        ]
    )
    row = _row_for(repriced)
    # Dynamic builder: 2 lines  →  2 segments (no empty middle slot).
    _check(
        "totalQuantity == '1/3'  (base SURVIVES — was missing before fix)",
        row["totalQuantity"],
        "1/3",
    )
    _check(
        "sku ordering = FN-SUG-004 / FN-HAIRMASK-003",
        row["sku"],
        "FN-SUG-004/FN-HAIRMASK-003",
    )


def case_multi_base() -> None:
    print("CASE multi-base — Glow Serum x1 + Sugarbear x2 (both base)")
    repriced = _reprice_cart(
        [
            _Line("p_001", 1, "base"),
            _Line("p_004", 2, "base"),
        ]
    )
    row = _row_for(repriced)
    # Dynamic builder: each line emits its own segment — they are no
    # longer summed inside the base bucket. The customer ordered
    # Glow Serum x1 + Sugarbear x2, the sheet now reflects both
    # explicitly instead of collapsing to "3".
    _check("totalQuantity == '1/2'", row["totalQuantity"], "1/2")
    _check(
        "sku ordering = FN-SERUM-001 / FN-SUG-004",
        row["sku"],
        "FN-SERUM-001/FN-SUG-004",
    )


def case_unknown_product_is_loud() -> None:
    print("CASE unknown product is a HARD ERROR (no silent skip)")
    raised = None
    try:
        _reprice_cart([_Line("p_999_definitely_not_real", 1, "base")])
    except OrderError as exc:
        raised = exc
    _check(
        "raises OrderError instead of silently dropping",
        raised is not None,
        True,
    )
    if raised is not None:
        _check("error code", raised.code, "product_unknown")
        _check("HTTP status", raised.status_code, 422)


def case_unknown_alongside_base_still_fails() -> None:
    print("CASE base + unknown → STILL fails (must not mask the drift)")
    raised = None
    try:
        _reprice_cart(
            [
                _Line("p_004", 1, "base"),
                _Line("p_999", 2, "cross_sell"),
            ]
        )
    except OrderError as exc:
        raised = exc
    _check(
        "raises (the old behaviour would have kept the order with base only)",
        raised is not None,
        True,
    )


def case_orphan_cross_sell_promoted() -> None:
    """Replicates the slot-0 invariant in `_dispatch_sheets_for_order`.

    The promotion happens just before the items hit `build_order_row`;
    we mirror that here so the test cases the public outcome (the row).
    """
    print("CASE cart has only cross-sells — base slot must NOT stay empty")
    repriced = _reprice_cart([_Line("p_003", 2, "cross_sell")])

    items = []
    for it in repriced:
        product = get_product(it["product_id"])
        items.append(
            {
                "sku": product.resolved_sku(),
                "name": it["title"],
                "quantity": it["quantity"],
                "url": product.canonical_path(),
                "source": it["source"],
            }
        )
    # Mirror the orders.py promotion logic.
    if items and not any(x["source"] == "base" for x in items):
        for x in items:
            if x["source"] == "cross_sell":
                x["source"] = "base"
                break
    row = build_order_row(items)
    # After promotion: single base-tagged line  →  single-segment row.
    _check("totalQuantity == '2' (promoted)", row["totalQuantity"], "2")
    _check(
        "sku in first segment is the promoted product",
        row["sku"].split("/")[0],
        "FN-HAIRMASK-003",
    )


# ── Entry point ───────────────────────────────────────────────────────


def main() -> int:
    print("─" * 72)
    print(" Base-product preservation regression suite ")
    print("─" * 72)

    case_catalog_has_sugarbear()
    case_base_only_sugarbear()
    case_base_plus_cross_sell()
    case_multi_base()
    case_unknown_product_is_loud()
    case_unknown_alongside_base_still_fails()
    case_orphan_cross_sell_promoted()

    print("─" * 72)
    total = PASSED + FAILED
    print(f"  RESULT  {PASSED}/{total} passed, {FAILED} failed")
    print("─" * 72)
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
