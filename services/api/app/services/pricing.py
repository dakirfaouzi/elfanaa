"""
Server-side pricing engine — bit-for-bit equivalent to
`frontend/lib/pricing.ts`.

The whole point of this module: the client's reported price is *ignored*.
Every order POST is re-priced from the catalog so a malicious user can't
edit the Zustand store and pay 10 SAR for a 199 SAR cushion.

If you change tier rules, change them in BOTH places (TS + Python).
The frontend file references this module for parity in its docstring.
"""

from __future__ import annotations

from typing import Optional

from app.services.catalog import Money, OfferTier, Product


def line_total(product: Product, quantity: int) -> Money:
    """Total for `product × quantity`, honouring offerTiers if present."""
    if quantity <= 0:
        return Money(amount=0, currency=product.price.currency)

    if not product.has_tiers():
        return Money(
            amount=product.price.amount * quantity,
            currency=product.price.currency,
        )

    tiers = sorted(product.offer_tiers, key=lambda t: t.quantity)

    # Exact tier match wins.
    exact: Optional[OfferTier] = next((t for t in tiers if t.quantity == quantity), None)
    if exact is not None:
        return exact.total

    smallest = tiers[0]
    if quantity < smallest.quantity:
        return Money(
            amount=product.price.amount * quantity, currency=product.price.currency
        )

    # Above the largest tier — block + per-unit-at-top-tier-rate remainder.
    largest = tiers[-1]
    blocks, remainder = divmod(quantity, largest.quantity)
    per_unit_at_top_tier = round(largest.total.amount / largest.quantity)
    total = blocks * largest.total.amount + remainder * per_unit_at_top_tier
    return Money(amount=total, currency=largest.total.currency)


def effective_unit_price(product: Product, quantity: int) -> Money:
    if quantity <= 0:
        return product.price
    total = line_total(product, quantity)
    return Money(
        amount=round(total.amount / quantity), currency=total.currency
    )
