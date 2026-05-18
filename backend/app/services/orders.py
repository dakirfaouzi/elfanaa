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
    build_sheets_order_row,
    build_sheets_upsell_row,
    compose_full_address,
    dispatch_signed,
    dispatch_to_google_sheets,
    format_order_date_ksa,
    phone_for_sheets,
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
                # Per-line source carried in from `_reprice_cart` so
                # cross-sell items end up in the cross-sell slot of
                # the Sheets row (and the admin DB's `hasCrossSell`
                # flag becomes accurate for the first time).
                source=item.get("source", "base"),
            )
        )
    order.events.append(OrderEvent(name="created", payload={}))

    session.add(order)
    await session.flush()
    await session.refresh(order)

    # ── Google Sheets row append — AWAITED ─────────────────────────────────
    # The ops dashboard must contain the row BEFORE the customer lands on
    # the upsell screen, otherwise an immediate upsell-accept would race
    # the base-order append and try to update a row that doesn't exist yet.
    # Order creation still succeeds if this step fails (try/except below).
    try:
        await _dispatch_sheets_for_order(order, payload)
    except Exception:
        log.exception(
            "sheets webhook crashed — order kept",
            extra={"order_id": order.id},
        )

    # ── Non-blocking side-effects (CRM + shipping + pixel CAPIs) ───────────
    # These do not affect the buyer's UX. Fire-and-forget keeps the
    # checkout response fast even if Meta / TikTok CAPI is sluggish.
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

    # Update the Google Sheets row in place — the Apps Script finds the
    # existing row by `orderId` and appends the upsell SKU / Arabic
    # product name / quantity to the original row (separator "/"), and
    # adds the upsell price to Variant price. The final row reads as
    # the FINAL real order. Best-effort; failures are logged, never raised.
    settings = get_settings()
    if not settings.google_sheets_webhook_url:
        log.info(
            "sheets upsell webhook skipped — env not configured",
            extra={"order_id": order.id},
        )
        return order

    try:
        sheets_payload = build_sheets_upsell_row(
            order_id=order.id,
            upsell_sku=product.resolved_sku(),
            upsell_product_name_ar=product.title("ar"),
            upsell_quantity=payload.quantity,
            upsell_total_minor=line_total_minor,
            currency=order.currency,
        )
        log.info(
            "sheets webhook → dispatching upsell update",
            extra={
                "order_id": order.id,
                "upsell_sku": sheets_payload.get("upsellSku"),
                "upsell_price": sheets_payload.get("upsellPrice"),
                "upsell_quantity": sheets_payload.get("upsellQuantity"),
            },
        )
        result = await dispatch_to_google_sheets(
            settings.google_sheets_webhook_url,
            settings.google_sheets_api_key,
            sheets_payload,
        )
        if not result.get("ok"):
            log.error(
                "sheets webhook → upsell dispatch failed",
                extra={"order_id": order.id, "result": result},
            )
    except Exception:
        log.exception(
            "sheets upsell webhook crashed — upsell accepted regardless",
            extra={"order_id": order.id},
        )

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
    """Recompute line totals from the catalog.

    The per-line `source` is forwarded ("base" / "cross_sell") so the
    Sheets row builder can place each item in the correct slot of the
    3-slot `base / upsell / cross_sell` format. Defaults to "base" for
    legacy payloads that don't tag their cart lines.

    Unknown products are a HARD ERROR.

    Why this is strict: prior to this guard the function dropped
    unknown ids with a `log.warning` and continued. In production this
    meant a storefront → backend catalog drift (e.g. the missing
    `p_004` Sugarbear entry that landed the live "0/1/3" regression)
    silently mutilated orders — the BASE product disappeared from
    `order.items`, the Sheets row went out as `"0/0/N"`, and the
    Thank-you page lost the base line. The customer was charged for
    the upsell + cross-sell, the base never reached fulfilment, and
    ops only noticed via support tickets.

    A loud 422 ("product_unknown") forces the failure into:
       1. the customer's UX (they see the error and retry / call us)
       2. the FastAPI access logs (concrete `product_id` in the error)
       3. the EasyPanel container logs (`log.error`)
    so the operator can update `app/services/catalog.py` and redeploy
    before any further orders silently corrupt the sheet.
    """
    out: List[Dict[str, Any]] = []
    for line in lines:
        product = get_product(line.product_id)
        if product is None:
            # Loud failure — see docstring rationale.
            log.error(
                "order rejected — unknown product id (catalog drift)",
                extra={
                    "product_id": line.product_id,
                    "hint": (
                        "Storefront sent a product id the backend cannot "
                        "price. Mirror the storefront catalog into "
                        "backend/app/services/catalog.py::PRODUCTS and "
                        "redeploy the API container."
                    ),
                },
            )
            raise OrderError(
                "product_unknown",
                f"unknown product id: {line.product_id}",
                422,
            )
        total = line_total(product, line.quantity)
        # `getattr` keeps this resilient if a future schema change
        # introduces a new shape without the `source` attribute.
        raw_source = getattr(line, "source", None) or "base"
        # Only `base` and `cross_sell` are valid for pre-checkout cart
        # lines — `upsell` lines are added post-checkout via the
        # `/orders/{id}/upsell/accept` endpoint. Any unexpected value
        # collapses to "base" to avoid corrupting downstream slot logic.
        source = "cross_sell" if raw_source == "cross_sell" else "base"
        out.append(
            {
                "product_id": product.id,
                "title": product.title("ar"),  # canonical Arabic for ops
                "quantity": line.quantity,
                "unit_price": product.price.amount,
                "line_total": total.amount,
                "currency": total.currency,
                "source": source,
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


async def _dispatch_sheets_for_order(order: Order, payload: OrderCreateIn) -> None:
    """Awaited Google Sheets append — runs BEFORE `create_order` returns
    so the operational sheet has the row by the time the customer sees
    the upsell popup. Failures are logged but never raised.
    """
    settings = get_settings()
    if not settings.google_sheets_webhook_url:
        log.info(
            "sheets webhook skipped — env not configured",
            extra={"order_id": order.id},
        )
        return

    # Build per-line item dicts tagged with their `source` so the Sheets
    # row builder can bucket them into the deterministic 3-slot format
    # `base / upsell / cross_sell`. The base order row deliberately
    # excludes `upsell`-sourced items — those don't exist yet at this
    # point (the upsell is accepted post-checkout and merged into the
    # row in place by the Apps Script via `_handleUpsell`).
    pre_upsell_items = [it for it in order.items if it.source != "upsell"]
    items_payload: list[Dict[str, Any]] = []
    for it in pre_upsell_items:
        product = get_product(it.product_id)
        items_payload.append(
            {
                "sku": product.resolved_sku() if product else f"FN-UNKNOWN-{it.product_id}",
                "name": it.title,
                "quantity": it.quantity,
                "source": it.source if it.source in ("base", "cross_sell") else "base",
            }
        )

    # Slot-0 invariant: if the order has any line, the base slot must
    # be populated. Otherwise the Sheets row reads "0/0/N" and ops sees
    # an order with no base product (the literal failure mode the live
    # "0/1/3" regression produced). This can legitimately happen when a
    # customer adds a base product, then a cross-sell, then removes the
    # base before checkout — leaving only cross-sells tagged. Promote
    # the first cross-sell into the base slot so the row reflects the
    # real order shape and the Thank-you receipt has a primary line.
    if items_payload and not any(it["source"] == "base" for it in items_payload):
        for it in items_payload:
            if it["source"] == "cross_sell":
                it["source"] = "base"
                log.info(
                    "promoting orphan cross-sell to base slot — order had no base item",
                    extra={"order_id": order.id, "product": it.get("sku")},
                )
                break

    # Compose the "City — Street" string from the (now-declared) payload
    # fields. Prior to commit fixing this, the popup posted `city` but
    # `OrderCreateIn` lacked the field, so Pydantic dropped it and we
    # always wrote `""` here. The Next.js fallback at
    # `app/api/orders/route.ts` already does the same via
    # `composeFullAddress(input.city, input.address)`; keeping both in
    # sync via the shared helper guarantees identical Sheets output
    # regardless of which backend serves the order.
    full_address = compose_full_address(payload.city, payload.address)

    sheets_row = build_sheets_order_row(
        order_id=order.id,
        order_date_ksa=format_order_date_ksa(order.created_at),
        full_name=order.full_name,
        phone_digits=phone_for_sheets(order.phone_e164 or order.phone_national or ""),
        full_address=full_address,
        product_url=(payload.context.referrer if payload.context else None) or "",
        items=items_payload,
        total_minor=order.subtotal_minor,
        currency=order.currency,
    )

    log.info(
        "sheets webhook → dispatching base order",
        extra={
            "order_id": order.id,
            "sku": sheets_row.get("sku"),
            "total_quantity": sheets_row.get("totalQuantity"),
            "variant_price": sheets_row.get("variantPrice"),
            "product_url": sheets_row.get("productUrl"),
        },
    )

    result = await dispatch_to_google_sheets(
        settings.google_sheets_webhook_url,
        settings.google_sheets_api_key,
        sheets_row,
    )

    if not result.get("ok"):
        log.error(
            "sheets webhook → base order dispatch failed",
            extra={"order_id": order.id, "result": result},
        )


async def _fanout_after_create(
    order: Order,
    payload: OrderCreateIn,
    *,
    client_ip: Optional[str],
    user_agent: Optional[str],
) -> None:
    """Fire-and-forget side effects: CRM + shipping + pixel CAPIs.

    The Google Sheets append is handled separately by
    `_dispatch_sheets_for_order`, which is AWAITED before the route
    returns. This function intentionally does NOT touch the sheet.
    """
    settings = get_settings()

    order_payload = {
        "event": "order.created",
        # Pass the input `city`/`address` alongside the order so any
        # subscriber (admin ingest mirror, CRM hook, shipping partner)
        # receives the full shipping address without having to round-trip
        # back to the order's own row. Order persistence in `models.Order`
        # does not yet have these columns; passing them on the wire is
        # the minimal-isolation fix per the production brief.
        "order": _order_to_payload(order, city=payload.city, address=payload.address),
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

    shipment_payload = {
        "event": "shipment.requested",
        "order": _order_to_payload(order, city=payload.city, address=payload.address),
    }

    await asyncio.gather(
        dispatch_signed(
            settings.orders_webhook_url, order_payload, secret=settings.webhook_secret
        ),
        dispatch_signed(
            settings.shipping_webhook_url,
            shipment_payload,
            secret=settings.webhook_secret,
        ),
        dispatch_purchase(pixel_event),
        return_exceptions=True,
    )


def _order_to_payload(
    order: Order,
    *,
    city: Optional[str] = None,
    address: Optional[str] = None,
) -> Dict[str, Any]:
    """Serialise an `Order` ORM row for outbound webhooks.

    `city`/`address` arrive from the original `OrderCreateIn` payload
    (they are not yet persisted on the Order ORM). They are forwarded
    so downstream subscribers — notably the Next.js admin ingest at
    `app/api/admin/ingest/orders/route.ts`, which already reads them
    when present — can store the customer's full shipping address.
    """
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
        # Top-level shipping fields — the admin ingest looks for them
        # at `order.address` / `order.city` (camelCase already matches
        # the snake_case key thanks to the admin ingest reading both).
        "city": (city or "").strip() or None,
        "address": (address or "").strip() or None,
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
