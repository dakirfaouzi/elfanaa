"""
GET /geo/me — best-effort country / anonymous-IP probe for the storefront.

Used by the checkout modal to surface a soft "we only ship within KSA"
banner *before* the customer fills in the form. The authoritative gate
still runs at order-create time on the same MaxMind backend, so a
spoofed `/geo/me` response never lets a non-KSA order land.

Response shape mirrors `IpCheck.to_payload()`:
  { ip, country, city, allowed, isAnonymous }
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request

from app.services.ip_intelligence import check_ip


log = logging.getLogger(__name__)
router = APIRouter(prefix="/geo", tags=["geo"])


def _client_ip(request: Request) -> str | None:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


@router.get("/me")
async def geo_me(request: Request) -> dict:
    ip = _client_ip(request)
    result = await check_ip(ip)
    return result.to_payload()
