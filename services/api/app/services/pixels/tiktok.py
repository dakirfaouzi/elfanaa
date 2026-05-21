"""
TikTok Events API client.

Docs: https://business-api.tiktok.com/portal/docs?id=1771101303285761
   • Endpoint: https://business-api.tiktok.com/open_api/v1.3/event/track/
   • Header:   `Access-Token: <token>`

Hashing rules:
   • email, phone (E.164), external_id — SHA-256 of trimmed-lowercase value.
   • TikTok also accepts `ttp` (browser pixel cookie) and `ttclid`
     (click ID) un-hashed for cross-attribution.

`event_id` matches the browser pixel for dedup; TikTok requires a unique
`event_id` per event (not per platform), and we honour that.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx

from app.core.config import get_settings
from app.core.security import hash_for_capi
from app.services.pixels.types import PixelEvent

log = logging.getLogger(__name__)


TIKTOK_BASE = "https://business-api.tiktok.com/open_api/v1.3/event/track/"

# TikTok's event-name vocabulary differs slightly from Meta. Map ours
# to theirs so callers stay platform-agnostic.
_NAME_MAP = {
    "Purchase": "CompletePayment",
    "InitiateCheckout": "InitiateCheckout",
    "AddToCart": "AddToCart",
    "ViewContent": "ViewContent",
}


def _user(event: PixelEvent) -> Dict[str, Any]:
    user = event.user
    out: Dict[str, Any] = {}
    if (h := hash_for_capi(user.email)) is not None:
        out["email"] = h
    if user.phone_e164:
        if (h := hash_for_capi(user.phone_e164)) is not None:
            out["phone"] = h
    if user.client_ip:
        out["ip"] = user.client_ip
    if user.client_user_agent:
        out["user_agent"] = user.client_user_agent
    if user.ttp:
        out["ttp"] = user.ttp
    return out


async def send_event(event: PixelEvent) -> Dict[str, Any]:
    settings = get_settings()
    pixel_id = settings.tiktok_pixel_id
    token = settings.tiktok_events_access_token
    if not pixel_id or not token:
        return {"ok": True, "skipped": True}

    tt_event_name = _NAME_MAP.get(event.name, event.name)

    body: Dict[str, Any] = {
        "event_source": "web",
        "event_source_id": pixel_id,
        "data": [
            {
                "event": tt_event_name,
                "event_time": event.event_time_unix,
                "event_id": event.event_id,
                "user": _user(event),
                "properties": {
                    "currency": event.currency,
                    "value": round(event.value_minor / 100, 2),
                    "contents": [
                        {
                            "content_id": c.get("id"),
                            "content_name": c.get("name"),
                            "quantity": c.get("quantity"),
                            "price": c.get("price"),
                        }
                        for c in event.contents
                    ],
                },
                "page": {"url": event.event_source_url} if event.event_source_url else {},
            }
        ],
    }
    if settings.tiktok_test_event_code:
        body["test_event_code"] = settings.tiktok_test_event_code

    headers = {
        "Access-Token": token,
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(TIKTOK_BASE, headers=headers, json=body)
        if not res.is_success:
            log.warning(
                "tiktok events API non-2xx",
                extra={"status": res.status_code, "body": res.text[:300]},
            )
        return {"ok": res.is_success, "status": res.status_code}
    except Exception as exc:
        log.error("tiktok events API failed", extra={"error": str(exc)})
        return {"ok": False, "error": str(exc)}
