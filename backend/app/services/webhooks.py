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

    CRITICAL: `follow_redirects=True`. A POST to
    `https://script.google.com/macros/s/<id>/exec` returns `302 Found`
    pointing to `https://script.googleusercontent.com/macros/echo?...`
    where the script actually runs. Without redirect following, the
    request returns the 302, looks like "non-2xx", and the row is never
    appended. This is the most common reason Apps Script webhooks
    fail silently.
    """
    if not url:
        log.info("sheets webhook skipped — GOOGLE_SHEETS_WEBHOOK_URL not set")
        return {"ok": True, "skipped": True}

    target = f"{url}{'&' if '?' in url else '?'}apiKey={api_key}" if api_key else url
    safe_target = (target.split("?")[0] if "?" in target else target) + (
        "?apiKey=***" if api_key else ""
    )
    kind = row.get("kind", "order")
    order_id = row.get("orderId", "")

    log.info(
        "sheets webhook → request start",
        extra={
            "kind": kind,
            "order_id": order_id,
            "endpoint": safe_target,
            "payload_keys": sorted(row.keys()),
        },
    )
    # Full payload at DEBUG only — Arabic names in INFO logs are fine but
    # noisy; flip your service log level to DEBUG when reproducing issues.
    log.debug("sheets webhook → payload", extra={"order_id": order_id, "payload": row})

    try:
        async with httpx.AsyncClient(
            timeout=10.0, follow_redirects=True
        ) as client:
            res = await client.post(
                target,
                json=row,
                headers={"Content-Type": "application/json"},
            )
        transport_ok = res.is_success
        body_preview = (res.text or "")[:300]

        # Apps Script ALWAYS replies HTTP 200, even for auth/JSON errors.
        # The real success signal is `{"ok": true, ...}` in the JSON body.
        # A 200 with `{"ok": false, "error": "unauthorized"}` means the
        # API key is wrong — the row was NOT appended. Treat that as a
        # failure so production logs surface the real reason silently
        # dropped orders aren't landing in the sheet.
        parsed: Optional[Dict[str, Any]] = None
        try:
            parsed = json.loads(body_preview) if body_preview else None
        except json.JSONDecodeError:
            parsed = None
        app_ok = (
            parsed is not None
            and isinstance(parsed, dict)
            and parsed.get("ok") is True
        )
        ok = transport_ok and (True if parsed is None else app_ok)

        if ok:
            log.info(
                "sheets webhook ← response",
                extra={
                    "order_id": order_id,
                    "kind": kind,
                    "status": res.status_code,
                    "final_url_host": res.url.host if res.url else None,
                    "body": body_preview,
                },
            )
        elif not transport_ok:
            log.warning(
                "sheets webhook ← non-2xx",
                extra={
                    "order_id": order_id,
                    "kind": kind,
                    "status": res.status_code,
                    "final_url_host": res.url.host if res.url else None,
                    "body": body_preview,
                },
            )
        else:
            # 200 OK transport, but Apps Script reported a logical error
            # (unauthorized / invalid_json / setup failure). This is the
            # most common production failure mode — log loudly with a
            # remediation hint so the operator can act in seconds.
            app_error = (
                parsed.get("error", "unknown")
                if isinstance(parsed, dict)
                else "unknown"
            )
            hint = (
                "GOOGLE_SHEETS_API_KEY does not match API_KEY in "
                "webhook-script.js. Update one to match the other and "
                "redeploy the Apps Script (Deploy → Manage deployments "
                "→ ✎ → New version)."
                if app_error == "unauthorized"
                else "Open the Apps Script editor → Executions tab → "
                "inspect the failing run."
            )
            log.error(
                "sheets webhook ← app-level failure (HTTP 200, ok=false)",
                extra={
                    "order_id": order_id,
                    "kind": kind,
                    "status": res.status_code,
                    "final_url_host": res.url.host if res.url else None,
                    "app_error": app_error,
                    "body": body_preview,
                    "hint": hint,
                },
            )
        return {
            "ok": ok,
            "status": res.status_code,
            "body": body_preview,
            "app_ok": app_ok if parsed is not None else None,
        }
    except Exception as exc:
        log.error(
            "sheets webhook ← exception",
            extra={
                "order_id": order_id,
                "kind": kind,
                "endpoint": safe_target,
                "error": str(exc),
                "error_type": exc.__class__.__name__,
            },
        )
        return {"ok": False, "error": str(exc)}


# ── Dynamic order-row formatter ─────────────────────────────────────────────
#
# Mirrors `buildOrderRow` in `lib/webhooks/google-sheets.ts`.
#
# Output is FULLY DYNAMIC — one slash-separated segment per accepted line.
# There is NO fixed 3-slot ceiling, NO empty-slot padding, and NO
# collapsing of multiple lines into a single slot. A 6-line order
# produces a 6-segment row.
#
# Ordering rule (deterministic regardless of insertion order):
#   1. base       (insertion order preserved within bucket)
#   2. upsell     (insertion order preserved within bucket)
#   3. cross_sell (insertion order preserved within bucket)
#
# Unknown source values collapse to "base" so a typo can never silently
# drop a line.

_SOURCE_RANK = {"base": 0, "upsell": 1, "cross_sell": 2}


def build_order_row(items: list[Dict[str, Any]]) -> Dict[str, str]:
    """Build the dynamic slash-joined row fields from a list of items.

    Each `item` is a dict shaped::

        {
          "sku": str,           # FN-...
          "name": str,          # Arabic title
          "quantity": int,
          "url": str,           # canonical per-product URL (relative or absolute)
          "source": "base" | "upsell" | "cross_sell",
        }

    Returns::

        {
          "sku": "S1/S2/S3/...",
          "productName": "n1/n2/n3/...",
          "totalQuantity": "q1/q2/q3/...",
          "productUrl": "u1/u2/u3/...",
        }

    Properties guaranteed:
      • One segment per input item — never collapsed.
      • Order is deterministic (base → upsell → cross_sell) with stable
        insertion order inside each bucket.
      • Empty `items` → all fields are `""` (so a downstream empty-cell
        check still works without a special case).
    """
    normalised: list[tuple[int, int, Dict[str, Any]]] = []
    for idx, it in enumerate(items):
        raw_src = it.get("source") or "base"
        src = raw_src if raw_src in _SOURCE_RANK else "base"
        rank = _SOURCE_RANK[src]
        normalised.append((rank, idx, {**it, "source": src}))

    normalised.sort(key=lambda triple: (triple[0], triple[1]))
    ordered = [triple[2] for triple in normalised]

    return {
        "sku": "/".join(str(it.get("sku") or "") for it in ordered),
        "productName": "/".join(str(it.get("name") or "") for it in ordered),
        "totalQuantity": "/".join(str(int(it.get("quantity") or 0)) for it in ordered),
        "productUrl": "/".join(str(it.get("url") or "") for it in ordered),
    }


# ── Legacy three-slot formatter (deprecated) ────────────────────────────────
#
# Kept only so any caller still importing `build_three_slot_row` keeps
# working during the transition. The new contract (one segment per line,
# unbounded count) is what every production path now uses. This shim
# routes through `build_order_row` so it inherits the same dynamic
# behaviour — a 4-line order through this function produces a 4-segment
# row, NOT a truncated 3-slot one.

_SLOT_INNER_SEP = " + "


def build_three_slot_row(items: list[Dict[str, Any]]) -> Dict[str, str]:
    """DEPRECATED. Use `build_order_row` instead.

    Backwards-compat wrapper. Preserves the old return shape (sku /
    productName / totalQuantity — no productUrl) so callers can migrate
    incrementally, but the underlying serialization is now the dynamic
    `build_order_row`. As a result this function no longer drops lines
    when the order has 2+ upsells (the live regression that motivated
    the rewrite).
    """
    dyn = build_order_row(
        [
            {
                "sku": it.get("sku"),
                "name": it.get("name"),
                "quantity": it.get("quantity"),
                "url": "",
                "source": it.get("source"),
            }
            for it in items
        ]
    )
    return {
        "sku": dyn["sku"],
        "productName": dyn["productName"],
        "totalQuantity": dyn["totalQuantity"],
    }


def build_sheets_order_row(
    *,
    order_id: str,
    order_date_ksa: str,
    full_name: str,
    phone_digits: str,
    full_address: str,
    items: list[Dict[str, Any]],
    total_minor: int,
    currency: str = "SAR",
    fallback_product_url: str = "",
) -> Dict[str, Any]:
    """Flat payload for a single new-order row.

    Mirrors `SheetsOrderRow` in `lib/webhooks/google-sheets.ts` and the
    column layout in `Fanaa_Store Orders - Feuille 1.csv`. The Apps Script
    side reads each field by name (NOT by index), so adding optional
    columns later is forward-compatible.

    `items` is a list of `{sku, name, quantity, url, source}` dicts.
    The per-product `url` is what populates the new "Product URL"
    multi-segment cell; `fallback_product_url` (typically the request
    referer) is used as a single-segment fallback ONLY when every item
    omitted its own URL — preserving the legacy single-URL behaviour
    for callers that haven't migrated yet.
    """
    dyn = build_order_row(items)
    product_url = dyn["productUrl"]
    if not product_url.strip("/"):
        product_url = fallback_product_url or ""
    return {
        "kind": "order",
        "orderId": order_id,
        "orderDate": order_date_ksa,
        "country": "KSA",
        "fullName": full_name,
        "phone": phone_digits,
        "fullAddress": full_address,
        "productUrl": product_url,
        "sku": dyn["sku"],
        "productName": dyn["productName"],
        "totalQuantity": dyn["totalQuantity"],
        "variantPrice": round(total_minor / 100),
        "currency": currency or "SAR",
    }


def build_sheets_order_update_row(
    *,
    order_id: str,
    items: list[Dict[str, Any]],
    total_minor: int,
    currency: str = "SAR",
) -> Dict[str, Any]:
    """Full-state rewrite payload for an existing row.

    Sent whenever an order grows after its initial Sheets append:
    post-purchase upsell accepted, additional offers accepted, etc.
    Carries the COMPLETE final state of every line on the order so the
    Apps Script can overwrite SKU / Product name / Total quantity /
    Product URL / Variant price atomically — no slot-position
    arithmetic, no fixed-shape assumptions.

    Supports an unbounded number of segments per cell.
    """
    dyn = build_order_row(items)
    return {
        "kind": "order_update",
        "orderId": order_id,
        "sku": dyn["sku"],
        "productName": dyn["productName"],
        "totalQuantity": dyn["totalQuantity"],
        "productUrl": dyn["productUrl"],
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
    """DEPRECATED. Use `build_sheets_order_update_row` instead.

    Kept so any in-flight caller (e.g. the stateless Next.js fallback
    that can't reconstruct the full order) still produces a payload the
    Apps Script understands. New production code paths emit
    `kind: "order_update"` with the FULL final state — the only way to
    support unbounded multi-upsell + multi-cross-sell stacking.
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


def compose_full_address(city: Optional[str], address: Optional[str]) -> str:
    """Compose a single "City — Address" string for the Sheets
    "Full Address" column. Mirrors `composeFullAddress` in
    `lib/webhooks/google-sheets.ts` so the FastAPI and Next.js
    fallback routes produce identical strings for the same inputs.

    Empty / whitespace-only inputs collapse to `""` (per the brief:
    no address → empty string in the sheet).
    """
    c = (city or "").strip()
    a = (address or "").strip()
    if not c and not a:
        return ""
    if c and a:
        return f"{c} — {a}"
    return c or a
