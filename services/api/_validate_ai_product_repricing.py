"""
Validation harness — AI-published product checkout (the `product_unknown` fix).

ROOT CAUSE this proves fixed
----------------------------
The order re-pricer resolved products ONLY from the hardcoded curated mirror
(`catalog.PRODUCTS`), so every operator-published AI product (`run_*`,
persisted in `storefront_catalog_product`) 404'd checkout with a 422
`product_unknown`. The storefront/PDP read the DB; the order API didn't.

What this script exercises (no Postgres, no HTTP — a fake AsyncSession):
    1. `get_product_from_db` builds a priced Product from a catalog row
       (offer tiers + Arabic title sourced from cro_content).
    2. `_reprice_cart` resolves an AI line via the DB fallback and prices it.
    3. A curated line still resolves with ZERO DB hits.
    4. A genuinely unknown id STILL raises the loud 422 (drift stays visible).
    5. JSON/JSONB column values decode whether handed back as dict or str.

Run:  python _validate_ai_product_repricing.py
"""

from __future__ import annotations

import asyncio
import os
import sys
from typing import Any, Optional

# Make `import app...` resolve when run from services/api/.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.catalog import (  # noqa: E402
    Money,
    get_product_from_db,
    _as_json,
    _coerce_offer_tiers,
    _row_to_product,
    _title_from_cro,
)
from app.services.orders import _reprice_cart, OrderError  # noqa: E402


# ── Fakes ──────────────────────────────────────────────────────────────

class _FakeResult:
    def __init__(self, row: Optional[dict]):
        self._row = row

    def mappings(self):
        return self

    def first(self):
        return self._row


class _FakeSession:
    """Stand-in for AsyncSession.execute → result.mappings().first().

    `rows` maps the bound `slug` param to a row dict (or None for a miss).
    """

    def __init__(self, rows: dict[str, Optional[dict]]):
        self._rows = rows
        self.calls = 0

    async def execute(self, _stmt, params: Optional[dict] = None):
        self.calls += 1
        slug = (params or {}).get("slug")
        return _FakeResult(self._rows.get(slug))


class _Line:
    def __init__(self, product_id: str, quantity: int, source: str = "base"):
        self.product_id = product_id
        self.quantity = quantity
        self.source = source


def _ai_row(slug: str = "run_mpylutgk_5atjcbwp") -> dict:
    return {
        "slug": slug,
        "sku": "FN-AI-001",
        "price_minor": 34900,
        "price_currency": "SAR",
        # JSONB often arrives as a STRING under a raw text() query — exercise that.
        "offer_tiers": (
            '[{"quantity":1,"total":{"amount":34900,"currency":"SAR"}},'
            '{"quantity":3,"total":{"amount":89900,"currency":"SAR"}}]'
        ),
        "collection": "hair",
        "landing_path": "",
        "cro_content": {"title": {"ar": "فيتامينات سوجاربير للشعر", "en": "Sugarbear"}},
    }


# ── Harness plumbing ───────────────────────────────────────────────────

PASSED = 0
FAILED = 0


def _check(name: str, got: Any, expected: Any) -> None:
    global PASSED, FAILED
    ok = got == expected
    print(f"  [{'ok  ' if ok else 'FAIL'}] {name}")
    if not ok:
        print(f"          got      = {got!r}")
        print(f"          expected = {expected!r}")
        FAILED += 1
    else:
        PASSED += 1


# ── Cases ──────────────────────────────────────────────────────────────

def case_as_json() -> None:
    print("CASE _as_json decodes dict / str / None defensively")
    _check("dict passthrough", _as_json({"a": 1}), {"a": 1})
    _check("str decoded", _as_json('{"a": 1}'), {"a": 1})
    _check("None → None", _as_json(None), None)
    _check("garbage → None", _as_json("not json"), None)


def case_coerce_tiers() -> None:
    print("CASE _coerce_offer_tiers builds tiers + skips malformed entries")
    tiers = _coerce_offer_tiers(
        '[{"quantity":2,"total":{"amount":27900}},{"bad":true}]', "SAR"
    )
    _check("one valid tier survives", len(tiers), 1)
    _check("quantity", tiers[0].quantity, 2)
    _check("amount", tiers[0].total.amount, 27900)
    _check("currency fallback applied", tiers[0].total.currency, "SAR")


def case_title_from_cro() -> None:
    print("CASE _title_from_cro pulls localized title, falls back to slug")
    _check(
        "ar title",
        _title_from_cro({"title": {"ar": "منتج", "en": "Product"}}, "slug-x", "ar"),
        "منتج",
    )
    _check("fallback to slug when missing", _title_from_cro(None, "slug-x", "ar"), "slug-x")


def case_row_to_product() -> None:
    print("CASE _row_to_product → priced Product (id == slug)")
    p = _row_to_product(_ai_row())
    _check("id is slug", p.id, "run_mpylutgk_5atjcbwp")
    _check("price minor", p.price.amount, 34900)
    _check("ar title from cro", p.title("ar"), "فيتامينات سوجاربير للشعر")
    _check("sku", p.resolved_sku(), "FN-AI-001")
    _check("has tiers", p.has_tiers(), True)


def case_get_product_from_db() -> None:
    print("CASE get_product_from_db resolves a live AI row, None on miss")
    session = _FakeSession({"run_mpylutgk_5atjcbwp": _ai_row()})
    p = asyncio.run(get_product_from_db(session, "run_mpylutgk_5atjcbwp"))
    _check("resolved", p is not None and p.id, "run_mpylutgk_5atjcbwp")
    miss = asyncio.run(get_product_from_db(_FakeSession({}), "run_does_not_exist"))
    _check("miss → None", miss, None)


def case_reprice_ai_line() -> None:
    print("CASE _reprice_cart prices an AI line via the DB fallback")
    session = _FakeSession({"run_mpylutgk_5atjcbwp": _ai_row()})
    repriced = asyncio.run(
        _reprice_cart([_Line("run_mpylutgk_5atjcbwp", 3, "base")], session)
    )
    _check("one line", len(repriced), 1)
    _check("product_id", repriced[0]["product_id"], "run_mpylutgk_5atjcbwp")
    # qty 3 hits the 3-for-899 tier → server-authoritative price, not client.
    _check("tier price honoured", repriced[0]["line_total"], 89900)
    _check("title carried (AR)", repriced[0]["title"], "فيتامينات سوجاربير للشعر")


def case_curated_line_no_db_hit() -> None:
    print("CASE curated line resolves with ZERO DB hits")
    session = _FakeSession({})
    repriced = asyncio.run(_reprice_cart([_Line("p_004", 1, "base")], session))
    _check("curated resolved", repriced[0]["product_id"], "p_004")
    _check("no DB hit for curated", session.calls, 0)


def case_unknown_still_422() -> None:
    print("CASE genuinely unknown id STILL raises product_unknown 422")
    session = _FakeSession({})
    raised = None
    try:
        asyncio.run(_reprice_cart([_Line("run_not_published", 1, "base")], session))
    except OrderError as exc:
        raised = exc
    _check("raised", raised is not None, True)
    if raised is not None:
        _check("code", raised.code, "product_unknown")
        _check("status", raised.status_code, 422)
    _check("DB was consulted before failing", session.calls, 1)


def main() -> int:
    for case in (
        case_as_json,
        case_coerce_tiers,
        case_title_from_cro,
        case_row_to_product,
        case_get_product_from_db,
        case_reprice_ai_line,
        case_curated_line_no_db_hit,
        case_unknown_still_422,
    ):
        case()
        print()
    print(f"PASSED={PASSED} FAILED={FAILED}")
    return 1 if FAILED else 0


if __name__ == "__main__":
    raise SystemExit(main())
