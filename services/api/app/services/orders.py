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
from app.services.catalog import Product, get_product, get_product_from_db
from app.services.ip_intelligence import check_ip, is_phone_whitelisted
from app.services.pricing import line_total
from app.services.pixels import PixelEvent, PixelUser, dispatch_purchase
from app.services.webhooks import (
    build_sheets_order_row,
    build_sheets_order_update_row,
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

    repriced = await _reprice_cart(payload.cart.lines, session)
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
    # Resolve every product on the order ONCE (curated + AI from the DB) so
    # the ops Sheets row carries the real SKU + canonical URL for AI
    # products instead of the `FN-UNKNOWN-<id>` fallback.
    catalog = await _resolve_catalog_map(session, order.items)
    try:
        await _dispatch_sheets_for_order(order, payload, catalog=catalog)
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
        # AI-published products live in the storefront catalog table, not the
        # curated mirror — resolve them the same way the re-pricer does so a
        # post-purchase upsell can offer a generated product too.
        product = await get_product_from_db(session, payload.product_id)
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

    # Full-state rewrite — emit the COMPLETE current order to the
    # Sheets row so every line (base, every upsell, every cross-sell)
    # reflects exactly. This replaces the legacy single-slot upsell
    # merge that capped the row at 3 segments and silently truncated
    # 2nd+ upsells (the "2/1/3" vs expected "2/1/1/3" regression).
    #
    # Best-effort: the upsell is already persisted by the time we get
    # here; a Sheets outage must not roll it back.
    try:
        await _dispatch_sheets_for_order_update(session, order)
    except Exception:
        log.exception(
            "sheets order_update webhook crashed — upsell accepted regardless",
            extra={"order_id": order.id},
        )

    # Re-fire the outbound order webhook so the admin DB mirror picks
    # up the new line. The ingest route at
    # `app/api/admin/ingest/orders/route.ts` is idempotent on order id
    # and rebuilds the item list on update, so accepted upsells become
    # visible in the admin dashboard without a separate event type.
    try:
        await _dispatch_admin_update_for_order(order)
    except Exception:
        log.exception(
            "admin ingest re-dispatch crashed — upsell accepted regardless",
            extra={"order_id": order.id},
        )

    return order


async def _dispatch_admin_update_for_order(order: Order) -> None:
    """Re-fire the signed `ORDERS_WEBHOOK_URL` outbound after an order
    grows so the admin mirror table includes the new line(s).

    Reuses `_order_to_payload` and `dispatch_signed` — same envelope
    the initial `order.created` event used. The receiver
    (`/api/admin/ingest/orders`) keys on `order.id` via Prisma's
    `upsert`, so this is safe to re-deliver.
    """
    settings = get_settings()
    if not settings.orders_webhook_url:
        return
    payload = {
        "event": "order.created",
        "order": _order_to_payload(order),
    }
    await dispatch_signed(
        settings.orders_webhook_url, payload, secret=settings.webhook_secret
    )


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


async def _reprice_cart(lines, session: Optional[AsyncSession] = None) -> List[Dict[str, Any]]:
    """Recompute line totals from the catalog.

    Resolution order per line:
      1. The curated in-memory mirror (`catalog.get_product`) — zero DB,
         O(1), unchanged behaviour for the snapshot products.
      2. On a miss, when a `session` is supplied, the DB-backed resolver
         (`catalog.get_product_from_db`) for AI-published `run_*` products.

    `session` is optional so the in-memory parity/validation harness
    (`_validate_base_preserved.py`) can call this with curated-only lines.

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
        if product is None and session is not None:
            # Curated miss → resolve the AI-published product from the
            # `storefront_catalog_product` table (same Postgres the
            # storefront reads). This is what makes `run_*` products
            # sellable; without it every AI product 404'd here.
            product = await get_product_from_db(session, line.product_id)
        if product is None:
            # Loud failure — see docstring rationale.
            log.error(
                "order rejected — unknown product id (catalog drift)",
                extra={
                    "product_id": line.product_id,
                    "hint": (
                        "Storefront sent a product id neither the curated "
                        "catalog mirror nor the storefront_catalog_product "
                        "table can resolve. For curated drift, mirror "
                        "data/products.ts into catalog.py::PRODUCTS. For an "
                        "AI product, confirm the row is published + is_live."
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


async def _dispatch_sheets_for_order(
    order: Order,
    payload: OrderCreateIn,
    *,
    catalog: Optional[Dict[str, Product]] = None,
) -> None:
    """Awaited Google Sheets append — runs BEFORE `create_order` returns
    so the operational sheet has the row by the time the customer sees
    the upsell popup. Failures are logged but never raised.

    `catalog` is the pre-resolved product map (curated + AI from the DB)
    so AI products land on the row with their real SKU / URL.
    """
    settings = get_settings()
    if not settings.google_sheets_webhook_url:
        log.info(
            "sheets webhook skipped — env not configured",
            extra={"order_id": order.id},
        )
        return

    # Build the per-line items payload (every accepted line, in the
    # storage order the ORM returns them — `build_order_row` will then
    # do the deterministic base → upsell → cross_sell bucketing). The
    # base-order dispatch excludes `upsell`-sourced lines because they
    # don't exist yet at this point — upsells are accepted later via
    # `accept_upsell` which re-dispatches the FULL state through
    # `_dispatch_sheets_for_order_update`.
    pre_upsell_items = [it for it in order.items if it.source != "upsell"]
    items_payload = _items_payload_for_sheets(
        pre_upsell_items, settings.site_url, catalog
    )

    # Slot-0 invariant: if the order has any line, at least one must
    # land in the base bucket. Otherwise the Sheets row reads "/N"
    # (empty leading segment) and ops sees an order with no base
    # product (the failure mode the live "0/1/3" regression produced).
    # This can legitimately happen when a customer adds a base
    # product, then a cross-sell, then removes the base before
    # checkout — leaving only cross-sells tagged. Promote the first
    # cross-sell back to base so the Thank-you receipt always has a
    # primary line.
    _promote_orphan_cross_sells_to_base(items_payload, order_id=order.id)

    full_address = compose_full_address(payload.city, payload.address)

    sheets_row = build_sheets_order_row(
        order_id=order.id,
        order_date_ksa=format_order_date_ksa(order.created_at),
        full_name=order.full_name,
        phone_digits=phone_for_sheets(order.phone_e164 or order.phone_national or ""),
        full_address=full_address,
        items=items_payload,
        total_minor=order.subtotal_minor,
        currency=order.currency,
        fallback_product_url=(payload.context.referrer if payload.context else None)
        or "",
    )

    log.info(
        "sheets webhook → dispatching base order",
        extra={
            "order_id": order.id,
            "sku": sheets_row.get("sku"),
            "total_quantity": sheets_row.get("totalQuantity"),
            "product_url": sheets_row.get("productUrl"),
            "segments": len(items_payload),
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


async def _resolve_catalog_map(
    session: AsyncSession, items: list[OrderItem]
) -> Dict[str, Product]:
    """Resolve every DISTINCT product id on the order to a `Product`.

    Curated mirror first (zero DB), then the `storefront_catalog_product`
    table for AI products. Used to enrich the ops Sheets row with the real
    SKU + canonical URL — order persistence already succeeded by the time
    this runs, so a resolution miss simply leaves that line on the
    `FN-UNKNOWN-<id>` fallback rather than failing anything.
    """
    out: Dict[str, Product] = {}
    for it in items:
        pid = it.product_id
        if pid in out:
            continue
        product = get_product(pid)
        if product is None:
            product = await get_product_from_db(session, pid)
        if product is not None:
            out[pid] = product
    return out


def _items_payload_for_sheets(
    items: list[OrderItem],
    site_url: str,
    catalog: Optional[Dict[str, Product]] = None,
) -> list[Dict[str, Any]]:
    """Map ORM `OrderItem` rows to the dict shape the Sheets row
    builder expects. Each entry carries SKU / Arabic name / quantity /
    per-product canonical URL / source. Unknown product ids still
    emit a row (no silent drop here — `_reprice_cart` already gates
    on unknown ids at order-creation time) using a deterministic
    fallback SKU so the operator can recognise the line in the sheet.

    `catalog` (when provided) is the pre-resolved curated+DB product map;
    it's preferred over the curated-only `get_product` so AI products get
    their real SKU + URL instead of `FN-UNKNOWN-<id>`.
    """
    out: list[Dict[str, Any]] = []
    for it in items:
        product = (catalog or {}).get(it.product_id) or get_product(it.product_id)
        if product is not None:
            sku = product.resolved_sku()
            url = product.canonical_url(site_url)
        else:
            sku = f"FN-UNKNOWN-{it.product_id}"
            url = ""
        source = it.source if it.source in ("base", "upsell", "cross_sell") else "base"
        out.append(
            {
                "sku": sku,
                "name": it.title,
                "quantity": it.quantity,
                "url": url,
                "source": source,
            }
        )
    return out


def _promote_orphan_cross_sells_to_base(
    items_payload: list[Dict[str, Any]], *, order_id: str
) -> None:
    """Slot-0 invariant — see `_dispatch_sheets_for_order` for context."""
    if not items_payload:
        return
    if any(it.get("source") == "base" for it in items_payload):
        return
    for it in items_payload:
        if it.get("source") == "cross_sell":
            it["source"] = "base"
            log.info(
                "promoting orphan cross-sell to base slot — order had no base item",
                extra={"order_id": order_id, "product": it.get("sku")},
            )
            break


async def _dispatch_sheets_for_order_update(
    session: AsyncSession, order: Order
) -> None:
    """Full-state rewrite of the Sheets row after an order grows
    (post-purchase upsell accepted, additional offers accepted, …).

    Sends `kind: "order_update"` with EVERY current line on the order,
    in deterministic base → upsell → cross_sell order, so the Apps
    Script can overwrite the row atomically — no slot arithmetic, no
    fixed-shape assumptions, supports unbounded segment counts.

    Best-effort: failures are logged, never raised. The upsell is
    still added to the database regardless of Sheets state.
    """
    settings = get_settings()
    if not settings.google_sheets_webhook_url:
        log.info(
            "sheets webhook (update) skipped — env not configured",
            extra={"order_id": order.id},
        )
        return

    catalog = await _resolve_catalog_map(session, order.items)
    items_payload = _items_payload_for_sheets(
        list(order.items), settings.site_url, catalog
    )
    _promote_orphan_cross_sells_to_base(items_payload, order_id=order.id)

    sheets_row = build_sheets_order_update_row(
        order_id=order.id,
        items=items_payload,
        total_minor=order.total_minor,
        currency=order.currency,
    )

    log.info(
        "sheets webhook → dispatching order_update (full-state rewrite)",
        extra={
            "order_id": order.id,
            "sku": sheets_row.get("sku"),
            "total_quantity": sheets_row.get("totalQuantity"),
            "variant_price": sheets_row.get("variantPrice"),
            "segments": len(items_payload),
        },
    )

    result = await dispatch_to_google_sheets(
        settings.google_sheets_webhook_url,
        settings.google_sheets_api_key,
        sheets_row,
    )

    if not result.get("ok"):
        log.error(
            "sheets webhook → order_update dispatch failed",
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

    Shape contract (dual format — preserved for backwards compatibility):

    The payload carries BOTH:
        • `lines` (camelCase, money-as-object) — the shape the admin
          ingest at `app/api/admin/ingest/orders/route.ts` expects
          (matches the Next.js fallback at `app/api/orders/route.ts`).
        • `items` (snake_case, minor-units fields) — the legacy shape
          older subscribers may still read.

    Both lists carry exactly the same lines in the same order, so a
    consumer can pick either one without truncating the order. Before
    this fix the FastAPI side only sent `items` in snake-case, which
    the admin ingest mapper couldn't read — so admin DB rows had no
    item rows at all. That made the admin dashboard's "items per
    order" / "has upsell" / "has cross-sell" panes look empty even
    when the live order was correct end-to-end.
    """
    settings = get_settings()
    lines_camel = [
        {
            "productId": it.product_id,
            "title": it.title,
            "quantity": it.quantity,
            "unitPrice": {"amount": it.unit_price_minor, "currency": it.currency},
            "lineTotal": {"amount": it.line_total_minor, "currency": it.currency},
            "source": it.source,
            # Per-product canonical URL — admin DB doesn't store this
            # column yet, but it's already useful in the rawPayload
            # archive and any future analytics that wants per-product
            # URLs without re-joining against the catalog.
            "url": (
                p.canonical_url(settings.site_url)
                if (p := get_product(it.product_id))
                else ""
            ),
        }
        for it in order.items
    ]
    items_snake = [
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
    ]
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
            # camelCase mirror so the admin ingest's `o.customer.phone`
            # / `o.customer.phoneE164` reads (which expect camelCase)
            # land on actual values for FastAPI-served orders too.
            "fullName": order.full_name,
            "phone": order.phone_national or order.phone_e164,
            "phoneE164": order.phone_e164,
        },
        # Top-level shipping fields — the admin ingest looks for them
        # at `order.address` / `order.city` (camelCase already matches
        # the snake_case key thanks to the admin ingest reading both).
        "city": (city or "").strip() or None,
        "address": (address or "").strip() or None,
        "paymentMethod": order.payment_method,
        "createdAt": order.created_at.isoformat(),
        "lines": lines_camel,
        "items": items_snake,
        "totals": {
            "subtotal_minor": order.subtotal_minor,
            "upsell_total_minor": order.upsell_total_minor,
            "total_minor": order.total_minor,
            "currency": order.currency,
            # camelCase mirror so the admin ingest's
            # `o.totals?.subtotal?.amount` / `o.totals?.total?.amount`
            # reads pick up the right values.
            "subtotal": {"amount": order.subtotal_minor, "currency": order.currency},
            "total": {"amount": order.total_minor, "currency": order.currency},
        },
    }
