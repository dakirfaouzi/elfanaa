"""
Cryptographic helpers used by the backend.

   • `sign_payload`   — outbound webhook signature (HMAC-SHA256), shape
                        compatible with the storefront's TS implementation.
   • `hash_for_capi`  — SHA-256 lowercase-trim hashing for Meta / TikTok /
                        Snapchat user-data fields. Deterministic and
                        idempotent: hashing an already-hashed value is
                        detected and skipped.
"""

from __future__ import annotations

import hashlib
import hmac


def sign_payload(body: str, secret: str, timestamp: int) -> str:
    """Return `sha256=<hex-digest>` for the given body and timestamp.

    Uses `t=<ts>.<body>` as the signed material — same shape as Stripe and
    the storefront's `lib/webhooks/verify.ts`. The recipient verifies by
    re-computing the HMAC and constant-time-comparing the signature.
    """
    if not secret:
        raise ValueError("webhook secret is empty")
    msg = f"t={timestamp}.{body}".encode("utf-8")
    digest = hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


_HASH_RE_LEN = 64


def hash_for_capi(value: str | None) -> str | None:
    """Return SHA-256 hex of trimmed-lowercased value, or pass through if
    the input already looks like a SHA-256 hex digest.

    Used for `email`, `phone` (E.164 *without* leading `+`), `first_name`,
    etc. — every PII field Meta / TikTok / Snapchat want hashed.
    """
    if value is None:
        return None
    v = value.strip().lower()
    if not v:
        return None
    if len(v) == _HASH_RE_LEN and all(c in "0123456789abcdef" for c in v):
        # Already hashed — don't double-hash.
        return v
    return hashlib.sha256(v.encode("utf-8")).hexdigest()
