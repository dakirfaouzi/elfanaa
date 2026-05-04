"""
Pydantic v2 schemas — the API I/O contract.

These mirror the storefront's TS types in `lib/types.ts` so the same
shape travels end-to-end. We use `alias_generator=to_camel` +
`populate_by_name=True` so the API accepts BOTH `full_name` (Python)
and `fullName` (TS / browser) — no client-side converter needed.

Any change here MUST also be reflected in the TS file (kept manually
in sync — small surface, easy to police).
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


CartLineSource = Literal["base", "upsell", "cross_sell"]
LocaleCode = Literal["ar", "en"]
OrderStatus = Literal[
    "created",
    "confirmed",
    "shipped",
    "delivered",
    "cancelled",
    "returned",
]


class _Camel(BaseModel):
    """Base model — accepts both camelCase (browser) and snake_case (Python).

    Routes wrap responses with `response_model_by_alias=True` so the JSON
    payload is camelCase on the wire, matching what the storefront expects.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class CartLineIn(_Camel):
    product_id: str = Field(min_length=1, max_length=40)
    quantity: int = Field(ge=1, le=20)
    variant_id: Optional[str] = Field(default=None, max_length=40)


class CartIn(_Camel):
    lines: List[CartLineIn] = Field(min_length=1, max_length=20)
    currency: str = Field(default="SAR", min_length=3, max_length=3)


class TrackingContext(_Camel):
    """Front-end attribution + dedup hints, optional."""

    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="allow"
    )

    event_id: Optional[str] = None
    fbp: Optional[str] = None
    fbc: Optional[str] = None
    ttp: Optional[str] = None
    sc_click_id: Optional[str] = None
    user_agent: Optional[str] = None
    landing_url: Optional[str] = None
    referrer: Optional[str] = None


class OrderCreateIn(_Camel):
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=4, max_length=24)
    cart: CartIn
    locale: LocaleCode = "ar"
    context: Optional[TrackingContext] = None


class UpsellAcceptIn(_Camel):
    product_id: str = Field(min_length=1, max_length=40)
    quantity: int = Field(default=1, ge=1, le=5)


# ── Output ──────────────────────────────────────────────────────────────────


class MoneyOut(_Camel):
    amount: int = Field(description="Minor units (1 SAR = 100)")
    currency: str = Field(default="SAR")


class OrderItemOut(_Camel):
    product_id: str
    title: str
    quantity: int
    unit_price: MoneyOut
    line_total: MoneyOut
    source: CartLineSource


class CustomerOut(_Camel):
    full_name: str
    phone_e164: str
    phone_national: Optional[str] = None


class OrderOut(_Camel):
    id: str
    created_at: datetime
    status: OrderStatus
    locale: LocaleCode
    payment_method: str
    customer: CustomerOut
    items: List[OrderItemOut]
    subtotal: MoneyOut
    upsell_total: MoneyOut
    total: MoneyOut


class OrderCreateOut(_Camel):
    """Response body for POST /orders — minimal echo, full receipt."""

    ok: bool = True
    order_id: str
    receipt: OrderOut
