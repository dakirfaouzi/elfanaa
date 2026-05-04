"""
Server-side pixel layer (CAPI / Events API).

Each platform exposes a single coroutine:
   • `send_event(...)` — accepts a normalised `PixelEvent` and posts it.

The `dispatch_purchase(...)` orchestrator in `dispatch.py` calls all three
in parallel after an order is persisted, dropping anything that's not
configured. Browser pixels send the same `event_id` so the platforms
deduplicate the pair into a single conversion.

Design notes:
   • PII (email/phone/name) is hashed via `core/security.hash_for_capi`.
   • We only fire `Purchase` from the server (highest-value event); the
     other events (`ViewContent`, `AddToCart`, `InitiateCheckout`) come
     from the browser pixels — see `frontend/lib/pixels`.
   • Missing tokens silently no-op; never block the order pipeline on a
     pixel failure.
"""

from app.services.pixels.dispatch import dispatch_purchase  # noqa: F401
from app.services.pixels.types import PixelEvent, PixelUser  # noqa: F401
