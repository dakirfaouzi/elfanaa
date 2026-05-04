"""
Pixel-event data types — shared by all platform CAPI clients.

Lives in its own module to break the circular import between
`dispatch.py` (which orchestrates the platforms) and the per-platform
clients (which need `PixelEvent`/`PixelUser` to build their payloads).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class PixelUser:
    """User-data fields. Hashing is done inside the CAPI clients."""

    email: Optional[str] = None
    phone_e164: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    country: Optional[str] = "sa"
    client_ip: Optional[str] = None
    client_user_agent: Optional[str] = None
    fbp: Optional[str] = None
    fbc: Optional[str] = None
    ttp: Optional[str] = None
    sc_click_id: Optional[str] = None


@dataclass
class PixelEvent:
    """Normalised event shared across platforms."""

    name: str  # "Purchase", "InitiateCheckout", etc.
    event_id: str  # browser dedup id
    event_time_unix: int
    value_minor: int
    currency: str
    user: PixelUser
    contents: List[Dict[str, Any]] = field(default_factory=list)
    event_source_url: Optional[str] = None
