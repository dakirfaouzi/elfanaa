"""
Server-side catalog mirror — keeps the storefront's `data/products.ts`
shape in Python so the backend can recompute prices without trusting the
client. When you swap the storefront catalog for a real CMS or DB, swap
this module for an adapter and the rest of the backend stays untouched.

Money is in *minor units* throughout (1 SAR = 100). All `total`s on a
tier are LINE totals at that exact quantity, NOT unit prices.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, List, Optional


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
    """
    return frozenset(p.id for p in PRODUCTS)
