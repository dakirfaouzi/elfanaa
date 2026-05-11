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


def build_sheets_order_row(
    *,
    order_id: str,
    order_date_ksa: str,
    full_name: str,
    phone_digits: str,
    full_address: str,
    product_url: str,
    skus: list[str],
    product_names_ar: list[str],
    quantities: list[int],
    total_minor: int,
    currency: str = "SAR",
) -> Dict[str, Any]:
    """Flat payload for a single new-order row.

    Mirrors `SheetsOrderRow` in `lib/webhooks/google-sheets.ts` and the
    column layout in `Fanaa_Store Orders - Feuille 1.csv`. The Apps Script
    side reads each field by name (NOT by index), so adding optional
    columns later is forward-compatible.

    Multi-product: SKU / Product name / Total quantity are joined with "/"
    so a single row tells the full story without joining tabs.
    """
    return {
        "kind": "order",
        "orderId": order_id,
        "orderDate": order_date_ksa,
        "country": "KSA",
        "fullName": full_name,
        "phone": phone_digits,
        "fullAddress": full_address,
        "productUrl": product_url,
        "sku": "/".join(s for s in skus if s),
        "productName": "/".join(n for n in product_names_ar if n),
        "totalQuantity": "/".join(str(q) for q in quantities),
        "variantPrice": round(total_minor / 100),
        "currency": currency or "SAR",
    }


def build_sheets_upsell_row(
    *,
    order_id: str,
    upsell_sku: str,
    upsell_product_name_ar: str,
    upsell_quantity: int,
    upsell_total_minor: int,
    currency: str = "SAR",
) -> Dict[str, Any]:
    """Flat payload for an upsell — Apps Script locates the original row
    by `orderId` and updates SKU / Product name / Total quantity /
    Variant price in place so the final row is the final real order.
    """
    return {
        "kind": "upsell",
        "orderId": order_id,
        "upsellSku": upsell_sku,
        "upsellProductName": upsell_product_name_ar,
        "upsellQuantity": upsell_quantity,
        "upsellPrice": round(upsell_total_minor / 100),
        "currency": currency or "SAR",
    }


def format_order_date_ksa(dt) -> str:
    """`datetime` → `DD/MM/YYYY` in Asia/Riyadh (UTC+3, no DST)."""
    import datetime as _dt

    if isinstance(dt, str):
        try:
            dt = _dt.datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except Exception:
            return ""

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_dt.timezone.utc)
    riyadh = dt.astimezone(_dt.timezone(_dt.timedelta(hours=3)))
    return riyadh.strftime("%d/%m/%Y")


def phone_for_sheets(value: str) -> str:
    """`+966512345678` → `966512345678`. Strips leading `+` and whitespace."""
    if not value:
        return ""
    return value.lstrip("+").replace(" ", "")
