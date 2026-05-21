"""
ORM models — the persistence shape of an ELFANAA order.

Schema design — three normalised tables:
   • `orders`         — one row per checkout (customer + totals + status)
   • `order_items`    — one row per cart line; `source` distinguishes a
                        `base` line from a post-purchase `upsell` add.
   • `order_events`   — append-only audit trail (created, upsell_accepted,
                        webhook_sent, shipped, delivered, cancelled, …).

We store money as integer minor units to match the storefront's TS engine
and avoid floating-point drift across systems. `JSONB` is used sparingly
for free-form payloads where querying isn't needed (raw client locale,
analytics context, etc.).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _new_id(prefix: str) -> str:
    """Short prefixed id — readable in dashboards (e.g. `ord_a1b2c3...`)."""
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(
        String(40), primary_key=True, default=lambda: _new_id("ord")
    )

    # ── Customer (server-side validated phone) ───────────────────────────────
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone_e164: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    phone_national: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # ── Locale + payment ─────────────────────────────────────────────────────
    locale: Mapped[str] = mapped_column(String(8), nullable=False, default="ar")
    payment_method: Mapped[str] = mapped_column(
        String(16), nullable=False, default="cod"
    )

    # ── Totals (minor units) ─────────────────────────────────────────────────
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="SAR")
    subtotal_minor: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    upsell_total_minor: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0
    )
    total_minor: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    # ── Status ───────────────────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="created", index=True
    )

    # ── Tracking + analytics context (free-form JSONB) ───────────────────────
    context: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )

    # ── Timestamps ───────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        onupdate=_utcnow,
        server_default=func.now(),
    )

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )
    events: Mapped[list["OrderEvent"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[str] = mapped_column(
        String(40), primary_key=True, default=lambda: _new_id("itm")
    )
    order_id: Mapped[str] = mapped_column(
        String(40), ForeignKey("orders.id", ondelete="CASCADE"), index=True
    )

    product_id: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    line_total_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="SAR")

    # `base` (initial cart line) | `upsell` (post-purchase add) | `cross_sell`
    source: Mapped[str] = mapped_column(String(16), nullable=False, default="base")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, server_default=func.now()
    )

    order: Mapped[Order] = relationship(back_populates="items")


class OrderEvent(Base):
    """Append-only audit trail. Never mutated; only inserted."""

    __tablename__ = "order_events"

    id: Mapped[str] = mapped_column(
        String(40), primary_key=True, default=lambda: _new_id("evt")
    )
    order_id: Mapped[str] = mapped_column(
        String(40), ForeignKey("orders.id", ondelete="CASCADE"), index=True
    )

    name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=dict, server_default="{}"
    )
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, server_default=func.now()
    )

    order: Mapped[Order] = relationship(back_populates="events")
