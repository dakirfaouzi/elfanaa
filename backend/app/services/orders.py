"""
Order domain service.

The route handlers stay thin and delegate the business rules here:
   • Re-price every cart line against the catalog (`pricing.line_total`).
   • Validate phone (Saudi mobile only, E.164 normalised).
   • Persist `Order` + `OrderItem` rows + a `created` event.
   • Fan out to webhooks + pixel CAPIs.
   • Return a populated `OrderOut` ready for JSON encoding.

This module is async-first; every public coroutine accepts an
`AsyncSession` so transactions are caller-controlled.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.phone import PhoneCheck, validate_saudi_phone
from app.db.models import Order, OrderEvent, OrderItem
from app.schemas.order import (
    CartLineSource,
    CustomerOut,
    MoneyOut,
    OrderCreateIn,
    OrderItemOut,
    OrderOut,
    UpsellAcceptIn,
)
from app.services.catalog import Product, get_product
from app.services.ip_intelligence import check_ip, is_phone_whitelisted
from app.services.pricing import line_total
from app.services.pixels import PixelEvent, PixelUser, dispatch_purchase
from app.services.webhooks import (
    build_sheets_row,
    dispatch_signed,
    dispatch_to_google_sheets,
)


log = logging.getLogger(__name__)


class OrderError(Exception):
    """Domain error — turned into 4xx by the route layer."""

    def __init__(self, code: str, message: str, status_code: int = 422):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


# ── Create ───────────────────────────────────────────────────────────────────


async def create_order(
    session: AsyncSession,
    payload: OrderCreateIn,
    *,
    client_ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    referer: Optional[str] = None,
) -> Order:
    """Validate, re-price, persist, and dispatch — returns the persisted order."""
    phone_check = validate_saudi_phone(payload.phone)
    if not phone_check.ok or not phone_check.e164:
        raise OrderError("invalid_phone", f"phone:{phone_check.reason or 'invalid'}", 422)

    # IP fraud gate. Whitelisted phones bypass the check (QA, founder, ops).
    # The check is fail-open: MaxMind outages never block real customers.
    geo: Optional[Dict[str, Any]] = None
    if not is_phone_whitelisted(phone_check.e164):
        ip_check = await check_ip(client_ip)
        geo = {
            "country": ip_check.country,
            "city": ip_check.city,
            "is_anonymous": ip_check.is_anonymous,
            "is_hosting": ip_check.is_hosting,
            "allow": ip_check.allow,
            "reason": ip_check.reason,
        }
        if not ip_check.allow:
            log.warning(
                "order rejected by ip fraud gate",
                extra={
                    "ip": ip_check.ip,
                    "country": ip_check.country,
                    "reason": ip_check.reason,
                    "phone_e164": phone_check.e164,
                },
            )
            raise OrderError(
                "geo_blocked",
                # Customer-facing message stays neutral — never reveal which
                # signal tripped (country / VPN / hosting). Adversaries who
                # know the exact reason iterate around it faster.
                "shipping unavailable for this region",
                403,
            )

    repriced = _reprice_cart(payload.cart.lines)
    if not repriced:
        raise OrderError("empty_cart", "cart contains no valid products", 422)

    subtotal_minor = sum(item["line_total"] for item in repriced)
    currency = repriced[0]["currency"]

    order = Order(
        full_name=payload.full_name.strip(),
        phone_e164=phone_check.e164,
        phone_national=phone_check.national,
        locale=payload.locale,
        payment_method="cod",
        currency=currency,
        subtotal_minor=subtotal_minor,
        upsell_total_minor=0,
        total_minor=subtotal_minor,
        status="created",
        context={
            "client_ip": client_ip,
            "user_agent": user_agent,
            "referer": referer,
            "tracking": payload.context.model_dump() if payload.context else {},
            "geo": geo,
        },
    )
    for item in repriced:
        order.items.append(
            OrderItem(
                product_id=item["product_id"],
                title=item["title"],
                quantity=item["quantity"],
                unit_price_minor=item["unit_price"],
                line_total_minor=item["line_total"],
                currency=item["currency"],
                source="base",
            )
        )
    order.events.append(OrderEvent(name="created", payload={}))

    session.add(order)
    await session.flush()
    await session.refresh(order)

    # Fan out side-effects in parallel; failures are logged, never raised.
    asyncio.create_task(
        _fanout_after_create(order, payload, client_ip=client_ip, user_agent=user_agent)
    )

    return order


# ── Upsell ───────────────────────────────────────────────────────────────────


POST_PURCHASE_OFFER_PRICE_MINOR = 9900  # 99.00 SAR


async def accept_upsell(
    session: AsyncSession, order_id: str, payload: UpsellAcceptIn
) -> Order:
    """Add a post-purchase upsell line at the locked 99 SAR price."""
    order = await _get_order_or_404(session, order_id)
    product = get_product(payload.product_id)
    if product is None:
        raise OrderError("product_not_found", "product not in catalog", 404)

    # Guard: don't re-bill an upsell already added.
    if any(it.product_id == product.id and it.source == "upsell" for it in order.items):
        raise OrderError("upsell_already_accepted", "upsell already added", 409)

    line_total_minor = POST_PURCHASE_OFFER_PRICE_MINOR * payload.quantity
    item = OrderItem(
        order_id=order.id,
        product_id=product.id,
        # Store in canonical Arabic for ops (matches _reprice_cart). The
        # storefront re-localises from `product_id` for the customer view.
        title=product.title("ar"),
        quantity=payload.quantity,
        unit_price_minor=POST_PURCHASE_OFFER_PRICE_MINOR,
        line_total_minor=line_total_minor,
        currency=product.price.currency,
        source="upsell",
    )
    order.items.append(item)
    order.upsell_total_minor += line_total_minor
    order.total_minor += line_total_minor
    order.events.append(
        OrderEvent(
            name="upsell_accepted",
            payload={
                "product_id": product.id,
                "quantity": payload.quantity,
                "amount_minor": line_total_minor,
            },
        )
    )
    await session.flush()
    await session.refresh(order)
    return order


# ── Fetch ────────────────────────────────────────────────────────────────────


async def get_order(session: AsyncSession, order_id: str) -> Order:
    return await _get_order_or_404(session, order_id)


async def _get_order_or_404(session: AsyncSession, order_id: str) -> Order:
    result = await session.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise OrderError("order_not_found", f"order {order_id} not found", 404)
    return order


# ── Helpers ──────────────────────────────────────────────────────────────────


def _reprice_cart(lines) -> List[Dict[str, Any]]:
    """Recompute line totals from the catalog. Drops invalid product ids."""
    out: List[Dict[str, Any]] = []
    for line in lines:
        product = get_product(line.product_id)
        if product is None:
            log.warning(
                "skipping unknown product on order",
                extra={"product_id": line.product_id},
            )
            continue
        total = line_total(product, line.quantity)
        out.append(
            {
                "product_id": product.id,
                "title": product.title("ar"),  # canonical Arabic for ops
                "quantity": line.quantity,
                "unit_price": product.price.amount,
                "line_total": total.amount,
                "currency": total.currency,
            }
        )
    return out


def to_order_out(order: Order) -> OrderOut:
    """ORM → Pydantic mapping. Keeps response shape stable across drivers."""
    return OrderOut(
        id=order.id,
        created_at=order.created_at,
        status=order.status,  # type: ignore[arg-type]
        locale=order.locale,  # type: ignore[arg-type]
        payment_method=order.payment_method,
        customer=CustomerOut(
            full_name=order.full_name,
            phone_e164=order.phone_e164,
            phone_national=order.phone_national,
        ),
        items=[
            OrderItemOut(
                product_id=it.product_id,
                title=it.title,
                quantity=it.quantity,
                unit_price=MoneyOut(amount=it.unit_price_minor, currency=it.currency),
                line_total=MoneyOut(amount=it.line_total_minor, currency=it.currency),
                source=it.source,  # type: ignore[arg-type]
            )
            for it in order.items
        ],
        subtotal=MoneyOut(amount=order.subtotal_minor, currency=order.currency),
        upsell_total=MoneyOut(amount=order.upsell_total_minor, currency=order.currency),
        total=MoneyOut(amount=order.total_minor, currency=order.currency),
    )


async def _fanout_after_create(
    order: Order,
    payload: OrderCreateIn,
    *,
    client_ip: Optional[str],
    user_agent: Optional[str],
) -> None:
    """Webhooks + pixel Purchase, all best-effort, all in parallel."""
    settings = get_settings()
    items_summary = " · ".join(
        f"{it.title} × {it.quantity} ({it.line_total_minor / 100:.0f} {it.currency})"
        for it in order.items
    )

    sheets_row = build_sheets_row(
        received_at=order.created_at.isoformat(),
        order_id=order.id,
        full_name=order.full_name,
        phone=order.phone_national or order.phone_e164,
        phone_e164=order.phone_e164,
        items_summary=items_summary,
        item_count=sum(it.quantity for it in order.items),
        subtotal_minor=order.subtotal_minor,
        upsell_total_minor=order.upsell_total_minor,
        total_minor=order.total_minor,
        currency=order.currency,
        locale=order.locale,
        source=(payload.context.referrer if payload.context else None) or "direct",
    )

    order_payload = {
        "event": "order.created",
        "order": _order_to_payload(order),
    }

    tracking = payload.context
    pixel_event = PixelEvent(
        name="Purchase",
        event_id=(tracking.event_id if tracking and tracking.event_id else f"srv_{order.id}"),
        event_time_unix=int(time.time()),
        value_minor=order.total_minor,
        currency=order.currency,
        user=PixelUser(
            phone_e164=order.phone_e164,
            first_name=order.full_name.split(" ")[0] if order.full_name else None,
            last_name=" ".join(order.full_name.split(" ")[1:]) or None,
            country="sa",
            client_ip=client_ip,
            client_user_agent=user_agent,
            fbp=tracking.fbp if tracking else None,
            fbc=tracking.fbc if tracking else None,
            ttp=tracking.ttp if tracking else None,
            sc_click_id=tracking.sc_click_id if tracking else None,
        ),
        contents=[
            {
                "id": it.product_id,
                "name": it.title,
                "quantity": it.quantity,
                "price": round(it.line_total_minor / it.quantity / 100, 2),
            }
            for it in order.items
        ],
        event_source_url=tracking.landing_url if tracking else None,
    )

    await asyncio.gather(
        dispatch_signed(
            settings.orders_webhook_url, order_payload, secret=settings.webhook_secret
        ),
        dispatch_signed(
            settings.shipping_webhook_url,
            {"event": "shipment.requested", "order": _order_to_payload(order)},
            secret=settings.webhook_secret,
        ),
        dispatch_to_google_sheets(
            settings.google_sheets_webhook_url,
            settings.google_sheets_api_key,
            sheets_row,
        ),
        dispatch_purchase(pixel_event),
        return_exceptions=True,
    )


def _order_to_payload(order: Order) -> Dict[str, Any]:
    return {
        "id": order.id,
        "created_at": order.created_at.isoformat(),
        "status": order.status,
        "locale": order.locale,
        "payment_method": order.payment_method,
        "customer": {
            "full_name": order.full_name,
            "phone_e164": order.phone_e164,
            "phone_national": order.phone_national,
        },
        "items": [
            {
                "product_id": it.product_id,
                "title": it.title,
                "quantity": it.quantity,
                "unit_price_minor": it.unit_price_minor,
                "line_total_minor": it.line_total_minor,
                "currency": it.currency,
                "source": it.source,
            }
            for it in order.items
        ],
        "totals": {
            "subtotal_minor": order.subtotal_minor,
            "upsell_total_minor": order.upsell_total_minor,
            "total_minor": order.total_minor,
            "currency": order.currency,
        },
    }
