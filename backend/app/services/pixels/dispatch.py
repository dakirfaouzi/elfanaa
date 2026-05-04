"""
Pixel event dispatch — the "send Purchase to all CAPIs" orchestrator.

Browser pixels fire the same event with the same `event_id` so platforms
collapse the server + browser pair into a single conversion. If one side
is missing (ad-blocker, fetch race), the other still credits the lead.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict

from app.core.config import get_settings
from app.services.pixels.types import PixelEvent, PixelUser

log = logging.getLogger(__name__)


async def dispatch_purchase(event: PixelEvent) -> Dict[str, Any]:
    """Fan out a Purchase to every configured CAPI in parallel."""
    # Imports are deferred to call time to avoid a circular dependency
    # at module-load (the platform clients import `PixelEvent` from us).
    from app.services.pixels import meta as meta_capi
    from app.services.pixels import snapchat as snap_capi
    from app.services.pixels import tiktok as tiktok_capi

    settings = get_settings()
    targets = []

    if settings.meta_pixel_id and settings.meta_capi_access_token:
        targets.append(("meta", meta_capi.send_event(event)))
    if settings.tiktok_pixel_id and settings.tiktok_events_access_token:
        targets.append(("tiktok", tiktok_capi.send_event(event)))
    if settings.snapchat_pixel_id and settings.snapchat_capi_access_token:
        targets.append(("snapchat", snap_capi.send_event(event)))

    if not targets:
        log.info("no pixel CAPIs configured; skipping server-side dispatch")
        return {"dispatched": 0}

    results = await asyncio.gather(
        *[t[1] for t in targets], return_exceptions=True
    )

    out: Dict[str, Any] = {"dispatched": len(results)}
    for (label, _), res in zip(targets, results):
        out[label] = (
            {"ok": False, "error": str(res)}
            if isinstance(res, BaseException)
            else res
        )
    return out


__all__ = ["PixelEvent", "PixelUser", "dispatch_purchase"]
