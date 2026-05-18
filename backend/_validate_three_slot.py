"""Standalone validation for the Python 3-slot Sheets formatter.

Run from the repo root with:
    python backend/_validate_three_slot.py

Mirrors the assertions in `scripts/_validate_three_slot.mjs` so the
two backends (Next.js fallback + FastAPI two-tier) emit IDENTICAL
Sheets rows for the same inputs.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Reconfigure stdout for Windows consoles that default to cp1252; the
# slot test labels contain Arabic.
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass

# Allow the script to import the backend module directly.
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from app.services.webhooks import build_three_slot_row, compose_full_address


passed = 0
failed = 0


def expect(label: str, actual, expected) -> None:
    global passed, failed
    if actual == expected:
        passed += 1
        print(f"  ✓ {label}")
    else:
        failed += 1
        print(f"  ✗ {label}")
        print(f"      expected: {expected!r}")
        print(f"      actual:   {actual!r}")


print("\nbuild_three_slot_row — Python parity with TypeScript helper")

expect(
    "Sugarbear x3, no cross-sell  →  '3/0/0'",
    build_three_slot_row([
        {"sku": "FN-SUG-004", "name": "سوجاربير", "quantity": 3, "source": "base"},
    ]),
    {"sku": "FN-SUG-004//", "productName": "سوجاربير//", "totalQuantity": "3/0/0"},
)

expect(
    "Sugarbear x1 + cross-sell x3  →  '1/0/3'",
    build_three_slot_row([
        {"sku": "FN-SUG-004", "name": "سوجاربير", "quantity": 1, "source": "base"},
        {"sku": "FN-CREAM-002", "name": "كريم", "quantity": 3, "source": "cross_sell"},
    ]),
    {
        "sku": "FN-SUG-004//FN-CREAM-002",
        "productName": "سوجاربير//كريم",
        "totalQuantity": "1/0/3",
    },
)

expect(
    "User-stated 1/1/3 example",
    build_three_slot_row([
        {"sku": "A", "name": "Base", "quantity": 1, "source": "base"},
        {"sku": "B", "name": "Up", "quantity": 1, "source": "upsell"},
        {"sku": "C", "name": "Cross", "quantity": 3, "source": "cross_sell"},
    ]),
    {"sku": "A/B/C", "productName": "Base/Up/Cross", "totalQuantity": "1/1/3"},
)

expect(
    "Multi-base — slot 0 joins with ' + '",
    build_three_slot_row([
        {"sku": "FN-SUG-004", "name": "سوجاربير", "quantity": 2, "source": "base"},
        {"sku": "FN-GLO-001", "name": "Glow Serum", "quantity": 1, "source": "base"},
    ]),
    {
        "sku": "FN-SUG-004 + FN-GLO-001//",
        "productName": "سوجاربير + Glow Serum//",
        "totalQuantity": "3/0/0",
    },
)

expect(
    "Unknown source collapses to base",
    build_three_slot_row([
        {"sku": "X", "name": "X", "quantity": 1, "source": "shipping"},
    ]),
    {"sku": "X//", "productName": "X//", "totalQuantity": "1/0/0"},
)

expect(
    "Empty list  →  '0/0/0'",
    build_three_slot_row([]),
    {"sku": "//", "productName": "//", "totalQuantity": "0/0/0"},
)

print("\ncompose_full_address — TS parity")

expect(
    "City only",
    compose_full_address("الرياض", None),
    "الرياض",
)
expect(
    "Address only",
    compose_full_address(None, "حي النخيل"),
    "حي النخيل",
)
expect(
    "Both",
    compose_full_address("الرياض", "حي النخيل"),
    "الرياض — حي النخيل",
)
expect(
    "Whitespace + None",
    compose_full_address("   ", "  "),
    "",
)
expect(
    "None + None",
    compose_full_address(None, None),
    "",
)

print("")
print(f"Result: {passed} passed, {failed} failed")
sys.exit(0 if failed == 0 else 1)
