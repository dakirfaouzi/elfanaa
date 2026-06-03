"""
Server-side catalog mirror — keeps the storefront's `data/products.ts`
shape in Python so the backend can recompute prices without trusting the
client. When you swap the storefront catalog for a real CMS or DB, swap
this module for an adapter and the rest of the backend stays untouched.

Money is in *minor units* throughout (1 SAR = 100). All `total`s on a
tier are LINE totals at that exact quantity, NOT unit prices.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Iterable, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class Money:
    amount: int
    currency: str = "SAR"


@dataclass(frozen=True)
class OfferTier:
    quantity: int
    total: Money


@dataclass(frozen=True)
class Product:
    id: str
    slug: str
    title_ar: str
    title_en: str
    price: Money
    offer_tiers: tuple[OfferTier, ...] = field(default_factory=tuple)
    collection: str = ""
    sku: str = ""
    # Optional bespoke landing page (e.g. `/sugarbear`). When omitted,
    # `canonical_path()` falls back to `/products/<slug>`. Mirrors the
    # `landingPath` field on the storefront `Product` type — see
    # `lib/product-href.ts::productHref` for the parallel TS resolver.
    landing_path: str = ""

    def title(self, locale: str = "ar") -> str:
        return self.title_ar if locale == "ar" else self.title_en

    def has_tiers(self) -> bool:
        return len(self.offer_tiers) > 0

    def resolved_sku(self) -> str:
        """Returns `sku` if set, else a deterministic fallback derived from
        slug + id (mirrors `lib/sku.ts` in the Next.js storefront).
        """
        if self.sku:
            return self.sku
        return _fallback_sku(self.id, self.slug)

    def canonical_path(self) -> str:
        """Path-only canonical URL for this product.

        Returns the bespoke landing path when set (e.g. `/sugarbear`),
        falling back to the generic PDP route (`/products/<slug>`).
        Always starts with `/`. Mirrors `productHref()` in TS.
        """
        if self.landing_path:
            return self.landing_path
        return f"/products/{self.slug or self.id}"

    def canonical_url(self, site_url: str = "") -> str:
        """Full canonical URL — `site_url` prefix + canonical path.

        `site_url` is read from settings (`SITE_URL` env var) and is
        typically `https://elfanaa.com`. When `site_url` is empty
        (local dev / unset env) the function returns the path-only
        form so the Sheets cell still reflects the right product
        instead of being blank.
        """
        path = self.canonical_path()
        if not site_url:
            return path
        return f"{site_url.rstrip('/')}{path}"


def _fallback_sku(product_id: str, slug: str) -> str:
    import re

    slug = (slug or "").lower()
    head = re.split(r"[^a-z0-9]+", slug)[0] if slug else ""
    token = head[:10].upper() if len(head) >= 3 else "".join(
        re.split(r"[^a-z0-9]+", slug)
    )[:10].upper() or "ITEM"
    tail_match = re.search(r"(\d+)\s*$", product_id or "")
    tail = (tail_match.group(1) if tail_match else "0").zfill(3)
    return f"FN-{token}-{tail}"


# ── Catalog ──────────────────────────────────────────────────────────────────
# MIRRORS `data/products.ts` 1:1 — id, slug, sku, AR/EN title, price, tiers,
# and collection. The backend re-prices server-side, so a drift here causes
# orders to be silently mutilated:
#
#   • An item whose `id` is not in this tuple is treated as *unknown* and
#     dropped from the cart by `_reprice_cart`. That is exactly what made
#     the base product disappear in production after the 3-slot rollout —
#     the storefront was sending `p_004` (Sugarbear) and the backend had
#     no entry, so the row ended up bucketed as cross-sell only and
#     Sheets read `"0/0/3"` → `"0/1/3"` after the upsell merge.
#
#   • The frontend `data/products.ts` is the source of truth for product
#     copy / images / CRO surface. The backend mirror keeps ONLY the
#     fields needed to re-price and to feed the operational Sheets row
#     (SKU, AR title, price, tier ladder, collection).
#
#   • When you add or rename a product on the storefront, mirror the
#     `id`, `sku`, `title_ar`, `title_en`, `price`, `offer_tiers`, and
#     `collection` here. The runtime guard in `_reprice_cart`
#     (`OrderError("product_unknown", ..., 422)`) refuses to persist an
#     order whose ids the backend cannot resolve — so any future drift
#     surfaces on the FIRST attempted order instead of corrupting the
#     row silently.

_TIERS: tuple[OfferTier, ...] = (
    OfferTier(quantity=1, total=Money(amount=19900, currency="SAR")),
    OfferTier(quantity=2, total=Money(amount=27900, currency="SAR")),
    OfferTier(quantity=3, total=Money(amount=34900, currency="SAR")),
)

_BASE_PRICE = Money(amount=19900, currency="SAR")

PRODUCTS: tuple[Product, ...] = (
    # P_001 — Glow Serum (face)
    Product(
        id="p_001",
        slug="glow-serum",
        sku="FN-SERUM-001",
        title_ar="سيروم الإشراق",
        title_en="Glow Serum",
        price=_BASE_PRICE,
        offer_tiers=_TIERS,
        collection="face",
    ),
    # P_002 — Barrier Repair Cream (face)
    Product(
        id="p_002",
        slug="barrier-cream",
        sku="FN-CREAM-002",
        title_ar="كريم ترميم الحاجز",
        title_en="Barrier Repair Cream",
        price=_BASE_PRICE,
        offer_tiers=_TIERS,
        collection="face",
    ),
    # P_003 — Deep Repair Hair Mask (hair)
    Product(
        id="p_003",
        slug="hair-mask",
        sku="FN-HAIRMASK-003",
        title_ar="قناع الترميم العميق",
        title_en="Deep Repair Mask",
        price=_BASE_PRICE,
        offer_tiers=_TIERS,
        collection="hair",
    ),
    # P_004 — Sugarbear Hair Vitamins (hair) — canonical /sugarbear funnel
    #
    # Until this entry existed the FastAPI re-pricer dropped every
    # /sugarbear cart line silently (the customer paid for it, the
    # Sheets row went out as "0/…/…", and the Thank-you page lost the
    # base product). See commit message + ROOT_CAUSE note above.
    Product(
        id="p_004",
        slug="sugarbear-hair",
        sku="FN-SUG-004",
        title_ar="فيتامينات سوجاربير للشعر",
        title_en="Sugarbear Hair Vitamins",
        price=_BASE_PRICE,
        offer_tiers=_TIERS,
        collection="hair",
        landing_path="/sugarbear",
    ),
)


def get_product(product_id: str) -> Optional[Product]:
    return next((p for p in PRODUCTS if p.id == product_id), None)


def get_products(ids: Iterable[str]) -> List[Product]:
    out = []
    for pid in ids:
        p = get_product(pid)
        if p is not None:
            out.append(p)
    return out


def known_product_ids() -> frozenset[str]:
    """Stable set of every product id the re-pricer can resolve.

    Exposed for cross-system checks — see `_reprice_cart` and the
    storefront/backend parity helpers. Returning a `frozenset` makes
    callers' membership checks O(1) and immutable.

    NOTE: this is the CURATED set only. AI-published products live in the
    `storefront_catalog_product` table and resolve via
    `get_product_from_db` — they are intentionally NOT enumerated here.
    """
    return frozenset(p.id for p in PRODUCTS)


# ── DB-backed catalog (AI-published products) ────────────────────────────────
#
# The hardcoded `PRODUCTS` tuple above mirrors ONLY the curated snapshot
# (`data/products.ts`). Operator-published, AI-generated products are written
# by the Studio publish flow into the Postgres `storefront_catalog_product`
# table — the SAME table the Next.js storefront reads. Until this resolver
# existed, the order re-pricer could not price any `run_*` product and every
# AI product 404'd checkout with `product_unknown` (422).
#
# This is the "swap this module for an adapter" seam promised in the module
# docstring: curated products keep their zero-DB fast path; only a miss falls
# through to the DB.

# Single-tenant deployment. Mirrors `apps/fanaa/lib/catalog/loader.ts`'s
# `STORE_ID = "fanaa"` — both the storefront and this service read the same
# rows from the same database.
_STORE_ID = "fanaa"


def _as_json(value: Any) -> Any:
    """Decode a JSON/JSONB column value into Python.

    With a raw `text()` query the asyncpg driver may hand JSONB back as a
    string (there is no column type info to trigger SQLAlchemy's JSON
    codec), so decode defensively and tolerate already-decoded values.
    """
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, (str, bytes)):
        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return None
    return None


def _coerce_offer_tiers(raw: Any, fallback_currency: str) -> tuple[OfferTier, ...]:
    """Build `OfferTier`s from the row's `offer_tiers` JSON.

    Shape mirrors `CatalogMetadata.offerTiers`:
    `[{ "quantity": int, "total": { "amount": int, "currency": str } }]`.
    Malformed entries are skipped rather than failing the order — a bad
    tier should degrade to per-unit pricing, never block a sale.
    """
    data = _as_json(raw)
    if not isinstance(data, list):
        return ()
    tiers: list[OfferTier] = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        qty = entry.get("quantity")
        total = entry.get("total")
        if not isinstance(qty, int) or not isinstance(total, dict):
            continue
        amount = total.get("amount")
        if not isinstance(amount, int):
            continue
        currency = total.get("currency") or fallback_currency
        tiers.append(
            OfferTier(quantity=qty, total=Money(amount=amount, currency=currency))
        )
    return tuple(tiers)


def _title_from_cro(raw: Any, slug: str, locale: str) -> str:
    """Pull the localised product title out of the `cro_content` projection.

    AI products carry their title in `cro_content.title` (a
    `{ ar, en }` LocalizedString — see `synthesiseProductFromRow`). Falls
    back to the slug so the ops Sheets row + receipt always show something
    recognisable even for a row published before titles were projected.
    """
    cro = _as_json(raw)
    if isinstance(cro, dict):
        title = cro.get("title")
        if isinstance(title, dict):
            val = title.get(locale) or title.get("ar") or title.get("en")
            if isinstance(val, str) and val.strip():
                return val.strip()
    return slug


def _row_to_product(row: Any) -> Product:
    slug = row["slug"]
    currency = row["price_currency"] or "SAR"
    price = Money(amount=int(row["price_minor"]), currency=currency)
    return Product(
        # The storefront uses the row slug as the product id for AI products
        # (`synthesiseProductFromRow`: `id = row.slug`), so the cart sends the
        # slug and we key on it here.
        id=slug,
        slug=slug,
        title_ar=_title_from_cro(row["cro_content"], slug, "ar"),
        title_en=_title_from_cro(row["cro_content"], slug, "en"),
        price=price,
        offer_tiers=_coerce_offer_tiers(row["offer_tiers"], currency),
        collection=row["collection"] or "",
        sku=row["sku"] or "",
        landing_path=row["landing_path"] or "",
    )


async def get_product_from_db(
    session: AsyncSession, product_id: str
) -> Optional[Product]:
    """Resolve an AI-published product from `storefront_catalog_product`.

    Pricing stays server-authoritative: the price + offer tiers come from
    the DB row, never the client. Scoped to the live ("is_live") rows of
    the fanaa store — identical to the storefront loader's query — so the
    backend re-pricer and the storefront can never disagree about which
    products are sellable.

    Returns `None` when no live row matches (true catalog drift), which the
    caller turns into the existing loud `product_unknown` 422.
    """
    result = await session.execute(
        text(
            """
            SELECT slug, sku, price_minor, price_currency, offer_tiers,
                   collection, landing_path, cro_content
            FROM storefront_catalog_product
            WHERE store_id = :store_id
              AND slug = :slug
              AND is_live = TRUE
            LIMIT 1
            """
        ),
        {"store_id": _STORE_ID, "slug": product_id},
    )
    row = result.mappings().first()
    if row is None:
        return None
    return _row_to_product(row)
