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

    def title(self, locale: str = "ar") -> str:
        return self.title_ar if locale == "ar" else self.title_en

    def has_tiers(self) -> bool:
        return len(self.offer_tiers) > 0


# ── Launch trio ──────────────────────────────────────────────────────────────
# Mirrors `data/products.ts`. Keep IDs and base prices identical or the
# server will reject orders the storefront created.

_TIERS: tuple[OfferTier, ...] = (
    OfferTier(quantity=1, total=Money(amount=19900, currency="SAR")),
    OfferTier(quantity=2, total=Money(amount=27900, currency="SAR")),
    OfferTier(quantity=3, total=Money(amount=34900, currency="SAR")),
)

_BASE_PRICE = Money(amount=19900, currency="SAR")

PRODUCTS: tuple[Product, ...] = (
    Product(
        id="p_001",
        slug="majlis-floor-cushion",
        title_ar="وسادة مجلس أرضية",
        title_en="Majlis Floor Cushion",
        price=_BASE_PRICE,
        offer_tiers=_TIERS,
        collection="majlis",
    ),
    Product(
        id="p_002",
        slug="courtyard-lantern",
        title_ar="فانوس الفناء",
        title_en="Courtyard Lantern",
        price=_BASE_PRICE,
        offer_tiers=_TIERS,
        collection="lighting",
    ),
    Product(
        id="p_003",
        slug="ceramic-vase",
        title_ar="مزهرية سيراميك",
        title_en="Ceramic Vase",
        price=_BASE_PRICE,
        offer_tiers=_TIERS,
        collection="decor",
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
