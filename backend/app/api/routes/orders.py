"""
Orders endpoint.

   POST /orders                       — create a new COD order
   GET  /orders/{id}                  — fetch (used by the storefront's
                                        thank-you page recovery flow)
   POST /orders/{id}/upsell/accept    — record an accepted post-purchase upsell
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.schemas.order import (
    OrderCreateIn,
    OrderCreateOut,
    OrderOut,
    UpsellAcceptIn,
)
from app.services.orders import (
    OrderError,
    accept_upsell,
    create_order,
    get_order,
    to_order_out,
)


log = logging.getLogger(__name__)
router = APIRouter(prefix="/orders", tags=["orders"])


def _client_ip(request: Request) -> str | None:
    """Best-effort client IP. Trusts `x-forwarded-for` because traffic
    arrives via EasyPanel's reverse proxy. Tighten this if you're behind
    multiple hops or want to enforce a specific trusted-proxy list.
    """
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post(
    "",
    response_model=OrderCreateOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
async def create_order_endpoint(
    payload: OrderCreateIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> OrderCreateOut:
    try:
        order = await create_order(
            session,
            payload,
            client_ip=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
            referer=request.headers.get("referer"),
        )
    except OrderError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc

    receipt = to_order_out(order)
    log.info(
        "order created",
        extra={
            "order_id": order.id,
            "items": len(order.items),
            "total_minor": order.total_minor,
        },
    )
    return OrderCreateOut(ok=True, order_id=order.id, receipt=receipt)


@router.get(
    "/{order_id}",
    response_model=OrderOut,
    response_model_by_alias=True,
)
async def get_order_endpoint(
    order_id: str,
    session: AsyncSession = Depends(get_session),
) -> OrderOut:
    try:
        order = await get_order(session, order_id)
    except OrderError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc
    return to_order_out(order)


@router.post(
    "/{order_id}/upsell/accept",
    response_model=OrderOut,
    response_model_by_alias=True,
)
async def accept_upsell_endpoint(
    order_id: str,
    payload: UpsellAcceptIn,
    session: AsyncSession = Depends(get_session),
) -> OrderOut:
    try:
        order = await accept_upsell(session, order_id, payload)
    except OrderError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc
    return to_order_out(order)
