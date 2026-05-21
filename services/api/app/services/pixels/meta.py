"""
Meta Conversions API client.

Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
   • Endpoint: https://graph.facebook.com/v19.0/{pixel_id}/events
   • Auth: `?access_token=...` (system-user or app-level token)

Hashing rules (mandatory for `user_data` PII):
   • email, phone (E.164 *without* leading `+`), first_name, last_name,
     city, state, country, zip — SHA-256 of trimmed-lowercase value.
   • External IDs and click IDs (`fbp`, `fbc`) travel un-hashed.

We only post `Purchase` from the server. `event_id` matches the browser
pixel so Meta deduplicates the pair into one conversion in Ads Manager.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

import httpx

from app.core.config import get_settings
from app.core.security import hash_for_capi
from app.services.pixels.types import PixelEvent

log = logging.getLogger(__name__)


META_API_VERSION = "v19.0"
META_BASE = "https://graph.facebook.com"


def _user_data(event: PixelEvent) -> Dict[str, Any]:
    user = event.user
    # Meta wants phone without leading `+`.
    phone_clean = (
        user.phone_e164.lstrip("+") if user.phone_e164 else None
    )
    out: Dict[str, Any] = {}
    if (h := hash_for_capi(user.email)) is not None:
        out["em"] = [h]
    if (h := hash_for_capi(phone_clean)) is not None:
        out["ph"] = [h]
    if (h := hash_for_capi(user.first_name)) is not None:
        out["fn"] = [h]
    if (h := hash_for_capi(user.last_name)) is not None:
        out["ln"] = [h]
    if (h := hash_for_capi(user.country)) is not None:
        out["country"] = [h]
    if user.client_ip:
        out["client_ip_address"] = user.client_ip
    if user.client_user_agent:
        out["client_user_agent"] = user.client_user_agent
    if user.fbp:
        out["fbp"] = user.fbp
    if user.fbc:
        out["fbc"] = user.fbc
    return out


async def send_event(event: PixelEvent) -> Dict[str, Any]:
    settings = get_settings()
    pixel_id = settings.meta_pixel_id
    token = settings.meta_capi_access_token
    if not pixel_id or not token:
        return {"ok": True, "skipped": True}

    body: Dict[str, Any] = {
        "data": [
            {
                "event_name": event.name,
                "event_time": event.event_time_unix,
                "event_id": event.event_id,
                "action_source": "website",
                "event_source_url": event.event_source_url,
                "user_data": _user_data(event),
                "custom_data": {
                    "currency": event.currency,
                    "value": round(event.value_minor / 100, 2),
                    "contents": event.contents,
                    "content_type": "product",
                },
            }
        ]
    }
    if settings.meta_capi_test_event_code:
        body["test_event_code"] = settings.meta_capi_test_event_code

    url = f"{META_BASE}/{META_API_VERSION}/{pixel_id}/events"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(url, params={"access_token": token}, json=body)
        if not res.is_success:
            log.warning(
                "meta CAPI non-2xx",
                extra={"status": res.status_code, "body": res.text[:300]},
            )
        return {"ok": res.is_success, "status": res.status_code}
    except Exception as exc:
        log.error("meta CAPI failed", extra={"error": str(exc)})
        return {"ok": False, "error": str(exc)}
