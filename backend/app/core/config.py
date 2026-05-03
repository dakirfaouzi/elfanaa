"""
Settings — single source of truth for runtime configuration.

Pydantic-settings reads from environment variables (and an optional
`.env` file in development), validates types, and raises early on
misconfiguration. Every other module imports `get_settings()` rather
than touching `os.environ` directly.

Why a function (not a module-level constant): the lru_cache lets us
treat settings as a singleton in production while still making it
trivial to override in tests via `get_settings.cache_clear()`.
"""

from functools import lru_cache
from typing import Annotated, List

from pydantic import AnyHttpUrl, BeforeValidator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _split_csv(value: str | List[str] | None) -> List[str]:
    """Accept a comma-separated string OR a JSON list for env-var ergonomics."""
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    return [v.strip() for v in str(value).split(",") if v.strip()]


CsvList = Annotated[List[str], BeforeValidator(_split_csv)]


class Settings(BaseSettings):
    """Runtime settings — every value has a sensible default for local dev."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Service ──────────────────────────────────────────────────────────────
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"

    # ── Database ─────────────────────────────────────────────────────────────
    # asyncpg-style URL: postgresql+asyncpg://user:pass@host:5432/db
    database_url: str = (
        "postgresql+asyncpg://elfanaa:elfanaa@elfanaa_database:5432/elfanaa"
    )

    # ── CORS — accepts comma-separated string from env ───────────────────────
    cors_origins: CsvList = ["http://localhost:3000", "https://elfanaa.com"]

    # ── Outbound webhooks ────────────────────────────────────────────────────
    webhook_secret: str = ""
    orders_webhook_url: str | None = None
    shipping_webhook_url: str | None = None
    google_sheets_webhook_url: str | None = None
    google_sheets_api_key: str | None = None

    # ── Server-side pixel APIs (CAPI) ────────────────────────────────────────
    meta_pixel_id: str | None = None
    meta_capi_access_token: str | None = None
    meta_capi_test_event_code: str | None = None

    tiktok_pixel_id: str | None = None
    tiktok_events_access_token: str | None = None
    tiktok_test_event_code: str | None = None

    snapchat_pixel_id: str | None = None
    snapchat_capi_access_token: str | None = None

    _LOCAL_DEV_DB_URL: str = (
        "postgresql+asyncpg://elfanaa:elfanaa@elfanaa_database:5432/elfanaa"
    )

    @model_validator(mode="after")
    def _require_explicit_db_url_in_production(self) -> "Settings":
        if (
            self.app_env == "production"
            and self.database_url == self._LOCAL_DEV_DB_URL
        ):
            raise ValueError(
                "DATABASE_URL must be set explicitly in production. "
                "Refusing to boot with the local-dev default. "
                "Set DATABASE_URL in EasyPanel's env-var UI."
            )
        return self

    @property
    def is_dev(self) -> bool:
        return self.app_env.lower() in {"dev", "development", "local"}


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor. Call `cache_clear()` in tests to reload."""
    return Settings()
