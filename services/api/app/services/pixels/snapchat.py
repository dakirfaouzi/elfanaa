"""
Snapchat Conversions API client.

Docs: https://marketingapi.snapchat.com/docs/conversion.html
   • Endpoint: https://tr.snapchat.com/v3/{pixel_id}/events?access_token=...
   • Body shape mirrors Meta CAPI fairly closely.

Hashing rules:
   • email, phone, ip — SHA-256 of trimmed-lowercase value.
   • `sc_click_id` (sccid) travels un-hashed.
   • Snap requires at least one user-data field that uniquely identifies
     the user; phone-only is acceptable for our COD flow.

We send `Purchase` from the server with the same `event_id` as the
browser pixel for dedup.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

import httpx

from app.core.config import get_settings
from app.core.security import hash_for_capi
from app.services.pixels.types import PixelEvent

log = logging.getLogger(__name__)


SNAP_BASE = "https://tr.snapchat.com/v3"

# Snapchat uses uppercase event names but a smaller vocabulary.
_NAME_MAP = {
    "Purchase": "PURCHASE",
    "InitiateCheckout": "START_CHECKOUT",
    "AddToCart": "ADD_CART",
    "ViewContent": "VIEW_CONTENT",
}


def _user_data(event: PixelEvent) -> Dict[str, Any]:
    user = event.user
    out: Dict[str, Any] = {}
    if (h := hash_for_capi(user.email)) is not None:
        out["em"] = h
    if user.phone_e164:
        # Snap wants phone *without* `+` and without spaces — same shape as Meta.
        cleaned = user.phone_e164.lstrip("+")
        if (h := hash_for_capi(cleaned)) is not None:
            out["ph"] = h
    if user.client_ip:
        out["client_ip_address"] = user.client_ip
    if user.client_user_agent:
        out["client_user_agent"] = user.client_user_agent
    if user.sc_click_id:
        out["sc_click_id"] = user.sc_click_id
    return out


async def send_event(event: PixelEvent) -> Dict[str, Any]:
    settings = get_settings()
    pixel_id = settings.snapchat_pixel_id
    token = settings.snapchat_capi_access_token
    if not pixel_id or not token:
        return {"ok": True, "skipped": True}

    snap_event_name = _NAME_MAP.get(event.name, event.name)

    body: Dict[str, Any] = {
        "data": [
            {
                "event_name": snap_event_name,
                "event_time": event.event_time_unix,
                "event_id": event.event_id,
                "action_source": "WEB",
                "event_source_url": event.event_source_url,
                "user_data": _user_data(event),
                "custom_data": {
                    "currency": event.currency,
                    "value": round(event.value_minor / 100, 2),
                    "contents": event.contents,
                },
            }
        ]
    }

    url = f"{SNAP_BASE}/{pixel_id}/events"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(url, params={"access_token": token}, json=body)
        if not res.is_success:
            log.warning(
                "snap CAPI non-2xx",
                extra={"status": res.status_code, "body": res.text[:300]},
            )
        return {"ok": res.is_success, "status": res.status_code}
    except Exception as exc:
        log.error("snap CAPI failed", extra={"error": str(exc)})
        return {"ok": False, "error": str(exc)}
