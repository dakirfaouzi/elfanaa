"""
Saudi phone validation.

Accepts the three forms a Saudi customer commonly types:
   • `05XXXXXXXX`         (most common — 10 digits, leading 0)
   • `5XXXXXXXX`          (without the leading 0)
   • `+9665XXXXXXXX`      (E.164 — what we store)
   • `009665XXXXXXXX`     (alt international form)

Returns a validated, E.164-normalised number ready for the database
and pixel CAPIs (Meta strips the `+` before hashing).
"""

from __future__ import annotations

from dataclasses import dataclass

import phonenumbers


_KSA_REGION = "SA"


@dataclass(frozen=True)
class PhoneCheck:
    ok: bool
    e164: str | None = None
    national: str | None = None
    reason: str | None = None


def validate_saudi_phone(raw: str | None) -> PhoneCheck:
    """Strict KSA mobile validator. Mobile-only — fixed-line rejected."""
    if not raw or not raw.strip():
        return PhoneCheck(ok=False, reason="empty")

    cleaned = raw.strip().replace(" ", "").replace("-", "")
    try:
        parsed = phonenumbers.parse(cleaned, _KSA_REGION)
    except phonenumbers.NumberParseException:
        return PhoneCheck(ok=False, reason="parse_error")

    if not phonenumbers.is_valid_number(parsed):
        return PhoneCheck(ok=False, reason="invalid")

    region = phonenumbers.region_code_for_number(parsed)
    if region != _KSA_REGION:
        return PhoneCheck(ok=False, reason="not_saudi")

    number_type = phonenumbers.number_type(parsed)
    if number_type not in {
        phonenumbers.PhoneNumberType.MOBILE,
        phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE,
    }:
        return PhoneCheck(ok=False, reason="not_mobile")

    return PhoneCheck(
        ok=True,
        e164=phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164),
        national=phonenumbers.format_number(
            parsed, phonenumbers.PhoneNumberFormat.NATIONAL
        ).replace(" ", ""),
    )
