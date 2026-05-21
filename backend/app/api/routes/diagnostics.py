"""
Operational diagnostics — one-click integration checks for the operator.

Mirrors the Next.js endpoint at `app/api/diagnostics/sheets/route.ts` so
both deployment modes (FastAPI two-tier and Next.js single-tier) can be
verified the same way: hit the URL in a browser, read the JSON response.
"""

from __future__ import annotations

import time
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from fastapi import APIRouter

from app.core.config import get_settings
from app.services.webhooks import dispatch_to_google_sheets


router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])


@router.get("/sheets")
async def sheets_integration_check() -> Dict[str, Any]:
    """
    Verify the Google Sheets orders pipeline end-to-end without
    placing a real order.

    Answers three questions in the order they matter:
      1. Are GOOGLE_SHEETS_WEBHOOK_URL and GOOGLE_SHEETS_API_KEY set?
      2. Does the /exec URL respond at all?
      3. Does it accept the apiKey we send?

    Uses `kind: "ping"` so `webhook-script.js` short-circuits without
    appending a row — safe for monitoring / repeated calls.

    Always returns HTTP 200 so the JSON body is always inspectable.
    Trust the `ok` field, never the HTTP status of this endpoint.
    """
    settings = get_settings()
    url = settings.google_sheets_webhook_url
    api_key = settings.google_sheets_api_key

    env = {
        "GOOGLE_SHEETS_WEBHOOK_URL": bool(url),
        "GOOGLE_SHEETS_API_KEY": bool(api_key),
        "webhookUrlHost": _safe_host(url),
    }

    if not url:
        return {
            "ok": False,
            "stage": "env",
            "env": env,
            "error": "GOOGLE_SHEETS_WEBHOOK_URL is not set in this environment.",
            "hint": (
                "Set GOOGLE_SHEETS_WEBHOOK_URL (and GOOGLE_SHEETS_API_KEY) "
                "in the EasyPanel env-var UI of the API service, then "
                "redeploy."
            ),
        }
    if not api_key:
        return {
            "ok": False,
            "stage": "env",
            "env": env,
            "error": "GOOGLE_SHEETS_API_KEY is not set in this environment.",
            "hint": (
                "Add GOOGLE_SHEETS_API_KEY in EasyPanel — it must match "
                "the API_KEY constant inside webhook-script.js."
            ),
        }

    started = time.perf_counter()
    result = await dispatch_to_google_sheets(
        url,
        api_key,
        {"kind": "ping", "orderId": "diagnostics_ping"},
    )
    elapsed_ms = int((time.perf_counter() - started) * 1000)

    if not result.get("ok"):
        app_ok = result.get("app_ok")
        return {
            "ok": False,
            "stage": "auth-or-app" if app_ok is False else "transport",
            "env": env,
            "elapsedMs": elapsed_ms,
            "transport": {
                "status": result.get("status"),
                "body": result.get("body"),
                "error": result.get("error"),
            },
            "hint": (
                "Apps Script returned ok:false. Most common cause: the "
                "GOOGLE_SHEETS_API_KEY env var here does not match "
                "API_KEY in webhook-script.js. Fix one to equal the "
                "other, then Deploy → Manage deployments → ✎ → New "
                "version in Apps Script."
                if app_ok is False
                else "The /exec URL did not respond as expected. Open "
                "the URL in a browser — Apps Script's GET handler "
                "should return {\"ok\":true,\"service\":\"elfanaa-orders-"
                "webhook\"}. If you see a Google sign-in screen "
                "instead, the deployment's 'Who has access' must be "
                "set to 'Anyone'."
            ),
        }

    body = result.get("body") or ""
    responded_to_ping = '"kind":"ping"' in body

    return {
        "ok": True,
        "stage": "ping-acknowledged" if responded_to_ping else "appended-instead-of-pinged",
        "env": env,
        "elapsedMs": elapsed_ms,
        "transport": {
            "status": result.get("status"),
            "body": body,
        },
        "hint": (
            "Healthy: the next COD order will append a row to your sheet."
            if responded_to_ping
            else "The Apps Script accepted the request but doesn't yet "
            "know about kind:'ping' — it appended a row instead. "
            "Redeploy the script (Apps Script editor → Deploy → "
            "Manage deployments → ✎ → New version) to pick up the "
            "ping handler. Real orders are flowing already."
        ),
    }


def _safe_host(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    try:
        return urlparse(url).netloc or None
    except Exception:
        return None
