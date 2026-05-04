"""
IP intelligence — geo-block + anti-VPN / anti-proxy gate.

Why we built this in-house instead of pulling the official `geoip2` SDK:
  • The SDK ships its own HTTP layer (aiohttp) — adding a second async
    HTTP stack to the image when we already use httpx for every other
    outbound call (webhooks, pixel CAPIs).
  • We only ever hit a single endpoint (`/geoip/v2.1/insights/{ip}`)
    and parse a small subset of the response — the SDK's depth is
    overkill for that.

Behaviour
─────────
  • If `ENABLE_IP_FRAUD_CHECK=false`           → allow.
  • If MaxMind credentials are missing         → allow + log once.
  • If IP is private / loopback / unparseable  → allow.
  • Otherwise call MaxMind GeoIP2 Insights:
      - country code must be in `allowed_countries`
      - `traits.is_anonymous*` flags must all be false
      - `traits.is_hosting_provider` flag must be false (data-centre IPs
        on residential checkouts are almost always click-spammers).
  • Network/timeout errors → fail-OPEN (we never block real customers
    because MaxMind had a hiccup). Errors are logged with the IP so ops
    can see when the upstream is degraded.

A tiny in-process TTL cache (1 hour) deduplicates repeated lookups for
the same IP — a customer who refreshes the checkout doesn't burn a
second query, and bursts from a single buyer never hit the rate limit.
"""

from __future__ import annotations

import ipaddress
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple

import httpx

from app.core.config import get_settings


log = logging.getLogger(__name__)

_INSIGHTS_URL = "https://geoip.maxmind.com/geoip/v2.1/insights/{ip}"
_HTTP_TIMEOUT = 2.5  # seconds — keep the order endpoint snappy
_CACHE_TTL = 60 * 60  # 1 hour
_CACHE_MAX_ENTRIES = 4096  # bounded so a long-running pod can't leak

# Single warning per process for a missing license key — avoids log spam.
_warned_missing_credentials = False


@dataclass(frozen=True)
class IpCheck:
    """Result of one IP intelligence lookup."""

    ip: str
    allow: bool
    country: Optional[str] = None
    city: Optional[str] = None
    is_anonymous: bool = False
    is_hosting: bool = False
    reason: Optional[str] = None  # error / block code, never customer-facing
    cached: bool = False

    def to_payload(self) -> Dict[str, object]:
        """JSON-safe view for the public `/geo/me` endpoint. Avoids leaking
        internal reason codes to non-blocked clients."""
        return {
            "ip": self.ip,
            "country": self.country,
            "city": self.city,
            "allowed": self.allow,
            "isAnonymous": self.is_anonymous,
        }


# ── Cache ────────────────────────────────────────────────────────────────────


@dataclass
class _Entry:
    result: IpCheck
    expires_at: float


_cache: Dict[str, _Entry] = {}


def _cache_get(ip: str) -> Optional[IpCheck]:
    entry = _cache.get(ip)
    if not entry:
        return None
    if entry.expires_at < time.time():
        _cache.pop(ip, None)
        return None
    return IpCheck(**{**entry.result.__dict__, "cached": True})


def _cache_put(ip: str, result: IpCheck) -> None:
    if len(_cache) >= _CACHE_MAX_ENTRIES:
        # Oldest-first eviction — cheap O(n) but n is small and bounded.
        oldest = min(_cache.items(), key=lambda kv: kv[1].expires_at)
        _cache.pop(oldest[0], None)
    _cache[ip] = _Entry(result=result, expires_at=time.time() + _CACHE_TTL)


def clear_cache() -> None:
    """Test-only — wipes the IP cache."""
    _cache.clear()


# ── Public API ───────────────────────────────────────────────────────────────


async def check_ip(ip: Optional[str]) -> IpCheck:
    """Returns an `IpCheck`. Always returns — never raises."""
    settings = get_settings()

    if not ip:
        return IpCheck(ip="", allow=True, reason="no_ip")

    if not settings.enable_ip_fraud_check:
        return IpCheck(ip=ip, allow=True, reason="disabled")

    if _is_private_or_local(ip):
        return IpCheck(ip=ip, allow=True, reason="private_ip")

    cached = _cache_get(ip)
    if cached:
        return cached

    if not (settings.maxmind_account_id and settings.maxmind_license_key):
        global _warned_missing_credentials
        if not _warned_missing_credentials:
            log.warning(
                "ENABLE_IP_FRAUD_CHECK is true but MaxMind credentials are "
                "not configured — defaulting to allow. Set MAXMIND_ACCOUNT_ID "
                "and MAXMIND_LICENSE_KEY, or set ENABLE_IP_FRAUD_CHECK=false."
            )
            _warned_missing_credentials = True
        return IpCheck(ip=ip, allow=True, reason="missing_credentials")

    try:
        country, city, traits = await _fetch_insights(
            ip,
            settings.maxmind_account_id,
            settings.maxmind_license_key,
        )
    except Exception as exc:  # noqa: BLE001 — fail-open is intentional
        log.warning(
            "maxmind insights call failed — failing open",
            extra={"ip": ip, "error": str(exc)},
        )
        return IpCheck(ip=ip, allow=True, reason="upstream_error")

    is_anonymous = bool(
        traits.get("is_anonymous")
        or traits.get("is_anonymous_proxy")
        or traits.get("is_anonymous_vpn")
        or traits.get("is_tor_exit_node")
    )
    is_hosting = bool(traits.get("is_hosting_provider"))

    allow_country = (
        not country
        or country.upper() in {c.upper() for c in settings.allowed_countries}
    )

    blocked_reason: Optional[str] = None
    if not allow_country:
        blocked_reason = "country_not_allowed"
    elif is_anonymous:
        blocked_reason = "anonymous_ip"
    elif is_hosting:
        blocked_reason = "hosting_provider"

    result = IpCheck(
        ip=ip,
        allow=blocked_reason is None,
        country=country,
        city=city,
        is_anonymous=is_anonymous,
        is_hosting=is_hosting,
        reason=blocked_reason,
    )
    _cache_put(ip, result)
    return result


def is_phone_whitelisted(phone_e164: Optional[str]) -> bool:
    """True if the phone is in `WHITELISTED_PHONES` — bypasses geo gate."""
    if not phone_e164:
        return False
    settings = get_settings()
    if not settings.whitelisted_phones:
        return False
    normalised = phone_e164.strip()
    return any(p.strip() == normalised for p in settings.whitelisted_phones)


# ── Internals ────────────────────────────────────────────────────────────────


def _is_private_or_local(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True  # unparseable → don't try MaxMind
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
    )


async def _fetch_insights(
    ip: str,
    account_id: str,
    license_key: str,
) -> Tuple[Optional[str], Optional[str], Dict[str, object]]:
    """Hit MaxMind GeoIP2 Insights. Returns (country_iso, city_name, traits)."""
    auth = (account_id, license_key)
    url = _INSIGHTS_URL.format(ip=ip)
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.get(
            url,
            auth=auth,
            headers={"accept": "application/json"},
        )
    # MaxMind returns structured JSON for both success and error responses.
    if resp.status_code != 200:
        # 4xx / 5xx — surface via the fail-open path in `check_ip`.
        try:
            payload = resp.json()
        except Exception:
            payload = {"error": resp.text}
        raise RuntimeError(f"maxmind {resp.status_code}: {payload}")

    data = resp.json()
    country_iso = (data.get("country") or {}).get("iso_code")
    city_name = ((data.get("city") or {}).get("names") or {}).get("en")
    traits = data.get("traits") or {}
    return country_iso, city_name, traits
