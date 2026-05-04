"""
Outbound webhook dispatchers.

Every order fans out to:
   • A signed generic webhook (CRM / ERP / Klaviyo / Make / Zapier).
   • The shipping partner endpoint (Aramex / SMSA / J&T).
   • Google Sheets — zero-infra ops dashboard for the team.

All three are best-effort: if a destination is misconfigured or 5xxs, the
order still succeeds for the customer. Failures are logged, never raised.
Production-grade reliability requires a queue (Celery + Redis, RabbitMQ,
or SQS) — wire that in around `dispatch_signed`.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, Optional

import httpx

from app.core.config import get_settings
from app.core.security import sign_payload

log = logging.getLogger(__name__)

# Brand-prefixed signature headers — must match `lib/brand.ts` on the storefront.
HEADER_SIGNATURE = "x-elfanaa-signature"
HEADER_TIMESTAMP = "x-elfanaa-timestamp"


async def dispatch_signed(
    url: Optional[str],
    payload: Dict[str, Any],
    *,
    secret: Optional[str] = None,
) -> Dict[str, Any]:
    """POST `payload` as JSON; sign with HMAC if a secret is configured.

    Always returns a result dict — never raises. Callers fan many of
    these out in parallel via `asyncio.gather(..., return_exceptions=True)`.
    """
    if not url:
        return {"ok": True, "skipped": True}

    body = json.dumps(payload, separators=(",", ":"), default=str)
    headers = {"Content-Type": "application/json"}
    if secret:
        ts = int(time.time())
        headers[HEADER_TIMESTAMP] = str(ts)
        headers[HEADER_SIGNATURE] = sign_payload(body, secret, ts)

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(url, content=body, headers=headers)
        ok = res.is_success
        if not ok:
            log.warning(
                "webhook non-2xx",
                extra={"url": url, "status": res.status_code, "body": res.text[:200]},
            )
        return {"ok": ok, "status": res.status_code}
    except Exception as exc:
        log.error("webhook failed", extra={"url": url, "error": str(exc)})
        return {"ok": False, "error": str(exc)}


async def dispatch_to_google_sheets(
    url: Optional[str],
    api_key: Optional[str],
    row: Dict[str, Any],
) -> Dict[str, Any]:
    """POST a single row to the Apps Script web app from `webhook-script.js`.

    The script reads `apiKey` from the query string for a lightweight
    shared-secret check — sufficient because Apps Script also locks the
    sheet to your Google account. Headers travel as `Content-Type` and
    NOT signed: Apps Script can't verify HMAC without external libs.
    """
    if not url:
        return {"ok": True, "skipped": True}
    target = f"{url}{'&' if '?' in url else '?'}apiKey={api_key}" if api_key else url
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(
                target, json=row, headers={"Content-Type": "application/json"}
            )
        return {"ok": res.is_success, "status": res.status_code}
    except Exception as exc:
        log.error(
            "sheets webhook failed", extra={"url": url, "error": str(exc)}
        )
        return {"ok": False, "error": str(exc)}


def build_sheets_row(
    *,
    received_at: str,
    order_id: str,
    full_name: str,
    phone: str,
    phone_e164: str,
    items_summary: str,
    item_count: int,
    subtotal_minor: int,
    upsell_total_minor: int,
    total_minor: int,
    currency: str,
    locale: str,
    source: str,
) -> Dict[str, Any]:
    """Build a flat dict ready for Google Sheets row append.

    Order matters: Apps Script uses object key order. Match the column
    headers in `sheet-template.csv` so a non-technical teammate can read
    a row without joining other tabs.
    """
    return {
        "received_at": received_at,
        "order_id": order_id,
        "full_name": full_name,
        "phone": phone,
        "phone_e164": phone_e164,
        "items": items_summary,
        "item_count": item_count,
        "subtotal_sar": round(subtotal_minor / 100, 2),
        "upsell_sar": round(upsell_total_minor / 100, 2),
        "total_sar": round(total_minor / 100, 2),
        "currency": currency,
        "payment_method": "cod",
        "locale": locale,
        "source": source,
    }
