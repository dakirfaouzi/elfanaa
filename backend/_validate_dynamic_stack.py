"""Standalone validation for the dynamic Sheets order-row formatter (Python).

Run from the repo root with:
    python backend/_validate_dynamic_stack.py

Mirrors `scripts/_validate_dynamic_stack.mjs` so the two backends
(Next.js fallback + FastAPI two-tier) emit IDENTICAL Sheets rows for
the same inputs. The dynamic builder is the new (post-2026-05-19)
contract that supports unbounded multi-upsell / multi-cross-sell
stacks; this script exists specifically so the live "2/1/3 vs
expected 2/1/1/3" regression can never come back undetected.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Reconfigure stdout for Windows consoles that default to cp1252; the
# regression labels contain Arabic.
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from app.services.webhooks import (
    build_order_row,
    build_sheets_order_row,
    build_sheets_order_update_row,
    build_three_slot_row,
    compose_full_address,
)


passed = 0
failed = 0


def expect(label: str, actual, expected) -> None:
    global passed, failed
    if actual == expected:
        passed += 1
        print(f"  \u2713 {label}")
    else:
        failed += 1
        print(f"  \u2717 {label}")
        print(f"      expected: {expected!r}")
        print(f"      actual:   {actual!r}")


def line(
    *,
    sku: str,
    name: str,
    quantity: int,
    source: str = "base",
    url: str = "",
):
    return {
        "sku": sku,
        "name": name,
        "quantity": quantity,
        "url": url,
        "source": source,
    }


# ── build_order_row ─────────────────────────────────────────────────────────

print("\nbuild_order_row — single product (1 segment)")
expect(
    "Sugarbear x3 only  →  '3'",
    build_order_row(
        [
            line(
                sku="FN-SUG-004",
                name="سوجاربير",
                quantity=3,
                source="base",
                url="https://elfanaa.com/sugarbear",
            )
        ]
    ),
    {
        "sku": "FN-SUG-004",
        "productName": "سوجاربير",
        "totalQuantity": "3",
        "productUrl": "https://elfanaa.com/sugarbear",
    },
)

print("\nbuild_order_row — base + cross-sell (2 segments)")
expect(
    "Sugarbear x1 + cross-sell x3  →  '1/3' (2 segments, no padding)",
    build_order_row(
        [
            line(sku="FN-SUG-004", name="سوجاربير", quantity=1, url="u-s", source="base"),
            line(sku="FN-CREAM-002", name="كريم", quantity=3, url="u-c", source="cross_sell"),
        ]
    ),
    {
        "sku": "FN-SUG-004/FN-CREAM-002",
        "productName": "سوجاربير/كريم",
        "totalQuantity": "1/3",
        "productUrl": "u-s/u-c",
    },
)

print("\nbuild_order_row — exact multi-upsell regression")
expect(
    "Base x2 + upsell #1 + upsell #2 + cross x3  →  '2/1/1/3' (the user's expected output)",
    build_order_row(
        [
            line(sku="FN-SUG-004", name="Sugarbear", quantity=2, url="us", source="base"),
            line(sku="FN-UPS-99-A", name="Upsell A", quantity=1, url="ua", source="upsell"),
            line(sku="FN-UPS-99-B", name="Upsell B", quantity=1, url="ub", source="upsell"),
            line(sku="FN-CRS-001", name="Cross", quantity=3, url="uc", source="cross_sell"),
        ]
    ),
    {
        "sku": "FN-SUG-004/FN-UPS-99-A/FN-UPS-99-B/FN-CRS-001",
        "productName": "Sugarbear/Upsell A/Upsell B/Cross",
        "totalQuantity": "2/1/1/3",
        "productUrl": "us/ua/ub/uc",
    },
)

print("\nbuild_order_row — large funnel: base + 5 upsells (6 segments)")
expect(
    "Base + 5 upsells  →  6 segments",
    build_order_row(
        [
            line(sku="B", name="Base", quantity=1, url="u0", source="base"),
            line(sku="U1", name="U1", quantity=1, url="u1", source="upsell"),
            line(sku="U2", name="U2", quantity=1, url="u2", source="upsell"),
            line(sku="U3", name="U3", quantity=1, url="u3", source="upsell"),
            line(sku="U4", name="U4", quantity=1, url="u4", source="upsell"),
            line(sku="U5", name="U5", quantity=1, url="u5", source="upsell"),
        ]
    ),
    {
        "sku": "B/U1/U2/U3/U4/U5",
        "productName": "Base/U1/U2/U3/U4/U5",
        "totalQuantity": "1/1/1/1/1/1",
        "productUrl": "u0/u1/u2/u3/u4/u5",
    },
)

print("\nbuild_order_row — base + 7 cross-sells (8 segments)")
expect(
    "Base + 7 cross-sells  →  8 segments with quantities 1..7",
    build_order_row(
        [
            line(sku="B", name="B", quantity=1, url="ub", source="base"),
            line(sku="C1", name="C1", quantity=1, url="u1", source="cross_sell"),
            line(sku="C2", name="C2", quantity=2, url="u2", source="cross_sell"),
            line(sku="C3", name="C3", quantity=3, url="u3", source="cross_sell"),
            line(sku="C4", name="C4", quantity=4, url="u4", source="cross_sell"),
            line(sku="C5", name="C5", quantity=5, url="u5", source="cross_sell"),
            line(sku="C6", name="C6", quantity=6, url="u6", source="cross_sell"),
            line(sku="C7", name="C7", quantity=7, url="u7", source="cross_sell"),
        ]
    ),
    {
        "sku": "B/C1/C2/C3/C4/C5/C6/C7",
        "productName": "B/C1/C2/C3/C4/C5/C6/C7",
        "totalQuantity": "1/1/2/3/4/5/6/7",
        "productUrl": "ub/u1/u2/u3/u4/u5/u6/u7",
    },
)

print("\nbuild_order_row — duplicate SKUs (each line preserved)")
expect(
    "Same SKU added as base + cross-sell  →  both segments emitted, no merge",
    build_order_row(
        [
            line(sku="FN-DUP", name="Dup", quantity=2, url="u", source="base"),
            line(sku="FN-DUP", name="Dup", quantity=1, url="u", source="cross_sell"),
        ]
    ),
    {
        "sku": "FN-DUP/FN-DUP",
        "productName": "Dup/Dup",
        "totalQuantity": "2/1",
        "productUrl": "u/u",
    },
)

print("\nbuild_order_row — source ordering (base → upsell → cross_sell)")
expect(
    "Mixed input order: upsell first, base second, cross third  →  reordered correctly",
    build_order_row(
        [
            line(sku="UA", name="UA", quantity=1, url="a", source="upsell"),
            line(sku="B",  name="B",  quantity=1, url="b", source="base"),
            line(sku="C",  name="C",  quantity=1, url="c", source="cross_sell"),
            line(sku="UB", name="UB", quantity=1, url="ub", source="upsell"),
        ]
    ),
    {
        "sku": "B/UA/UB/C",
        "productName": "B/UA/UB/C",
        "totalQuantity": "1/1/1/1",
        "productUrl": "b/a/ub/c",
    },
)

print("\nbuild_order_row — edge cases")
expect(
    "Empty list  →  every field is the empty string",
    build_order_row([]),
    {"sku": "", "productName": "", "totalQuantity": "", "productUrl": ""},
)
expect(
    "Unknown source collapses to base",
    build_order_row(
        [line(sku="X", name="X", quantity=1, url="u", source="shipping")]
    ),
    {"sku": "X", "productName": "X", "totalQuantity": "1", "productUrl": "u"},
)
expect(
    "Missing URL  →  empty-string segment (alignment preserved)",
    build_order_row(
        [
            {"sku": "A", "name": "A", "quantity": 1, "source": "base"},
            {"sku": "B", "name": "B", "quantity": 1, "source": "upsell"},
        ]
    ),
    {"sku": "A/B", "productName": "A/B", "totalQuantity": "1/1", "productUrl": "/"},
)

# ── build_sheets_order_row uses build_order_row internally ──────────────────

print("\nbuild_sheets_order_row — multi-segment row preserves full state")
sheets = build_sheets_order_row(
    order_id="ord_x",
    order_date_ksa="19/05/2026",
    full_name="X",
    phone_digits="966500000000",
    full_address="",
    items=[
        line(sku="A", name="A", quantity=1, url="ua", source="base"),
        line(sku="B", name="B", quantity=2, url="ub", source="cross_sell"),
        line(sku="C", name="C", quantity=3, url="uc", source="cross_sell"),
    ],
    total_minor=49700,
    currency="SAR",
    fallback_product_url="https://elfanaa.com/sugarbear",
)
expect(
    "order row contains every accepted line's segment for SKU/name/qty/url",
    {
        "sku": sheets["sku"],
        "name": sheets["productName"],
        "qty": sheets["totalQuantity"],
        "url": sheets["productUrl"],
        "variantPrice": sheets["variantPrice"],
        "kind": sheets["kind"],
    },
    {
        "sku": "A/B/C",
        "name": "A/B/C",
        "qty": "1/2/3",
        "url": "ua/ub/uc",
        "variantPrice": 497,
        "kind": "order",
    },
)

print("\nbuild_sheets_order_row — fallback URL used only when EVERY line has no URL")
sheets_fallback = build_sheets_order_row(
    order_id="ord_y",
    order_date_ksa="19/05/2026",
    full_name="Y",
    phone_digits="966500000000",
    full_address="",
    items=[
        line(sku="A", name="A", quantity=1, url="", source="base"),
        line(sku="B", name="B", quantity=2, url="", source="cross_sell"),
    ],
    total_minor=39800,
    currency="SAR",
    fallback_product_url="https://elfanaa.com/sugarbear",
)
expect(
    "All lines URL-less  →  productUrl falls back to the request referer",
    sheets_fallback["productUrl"],
    "https://elfanaa.com/sugarbear",
)

# ── build_sheets_order_update_row (the multi-upsell rewrite path) ───────────

print("\nbuild_sheets_order_update_row — full-state rewrite carries every line")
update = build_sheets_order_update_row(
    order_id="ord_z",
    items=[
        line(sku="B", name="B", quantity=2, url="ub", source="base"),
        line(sku="U1", name="U1", quantity=1, url="uu1", source="upsell"),
        line(sku="U2", name="U2", quantity=1, url="uu2", source="upsell"),
        line(sku="C", name="C", quantity=3, url="uc", source="cross_sell"),
    ],
    total_minor=89600,
    currency="SAR",
)
expect(
    "order_update payload — kind + every segment + variant price all present",
    update,
    {
        "kind": "order_update",
        "orderId": "ord_z",
        "sku": "B/U1/U2/C",
        "productName": "B/U1/U2/C",
        "totalQuantity": "2/1/1/3",
        "productUrl": "ub/uu1/uu2/uc",
        "variantPrice": 896,
        "currency": "SAR",
    },
)

# ── build_three_slot_row shim — must now be dynamic (no fixed-slot padding) ─

print("\nbuild_three_slot_row shim — dynamic, no truncation")
expect(
    "Legacy shim: base x2 + 2 upsells + cross x3  →  '2/1/1/3' (no truncation)",
    build_three_slot_row(
        [
            {"sku": "B", "name": "B", "quantity": 2, "source": "base"},
            {"sku": "U1", "name": "U1", "quantity": 1, "source": "upsell"},
            {"sku": "U2", "name": "U2", "quantity": 1, "source": "upsell"},
            {"sku": "C", "name": "C", "quantity": 3, "source": "cross_sell"},
        ]
    ),
    {"sku": "B/U1/U2/C", "productName": "B/U1/U2/C", "totalQuantity": "2/1/1/3"},
)
expect(
    "Legacy shim: single base x3  →  '3' (no padding to 3 slots)",
    build_three_slot_row(
        [{"sku": "X", "name": "X", "quantity": 3, "source": "base"}]
    ),
    {"sku": "X", "productName": "X", "totalQuantity": "3"},
)

# ── compose_full_address — unchanged ────────────────────────────────────────

print("\ncompose_full_address — unchanged contract")
expect("City only", compose_full_address("الرياض", None), "الرياض")
expect("Address only", compose_full_address(None, "حي النخيل"), "حي النخيل")
expect("Both", compose_full_address("الرياض", "حي النخيل"), "الرياض — حي النخيل")
expect("Whitespace + whitespace", compose_full_address("   ", "  "), "")
expect("None + None", compose_full_address(None, None), "")

print("")
print(f"Result: {passed} passed, {failed} failed")
sys.exit(0 if failed == 0 else 1)
