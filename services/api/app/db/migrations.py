"""
Lightweight startup migrations.

For an MVP funnel, full Alembic ceremony adds friction without value —
the schema iterates fast, and EasyPanel restarts are cheap. So we use
SQLAlchemy's `metadata.create_all()` to create missing tables on boot.

When the project graduates to multi-tenant / multi-developer cadence,
swap this for Alembic by:
   1. `alembic init alembic`
   2. Replace `run_migrations()` with `command.upgrade(cfg, "head")`.
   3. Wire `DATABASE_URL` into `alembic.ini`.

Until then, this is the right amount of infra.
"""

from __future__ import annotations

import logging

from app.db.base import Base
from app.db.database import engine
from app.db.admin_migrations import run_admin_migrations

# Importing models registers them on `Base.metadata`. DO NOT remove this
# import even though it looks unused — it has the side-effect of populating
# the metadata that `create_all()` reads.
from app.db import models  # noqa: F401

log = logging.getLogger(__name__)


async def run_migrations() -> None:
    """Idempotent — creates only what doesn't exist. Safe to run on every boot.

    Runs both tiers in the same lifespan window:
      1. SQLAlchemy `create_all()` — orders / order_items / order_events.
      2. Admin analytics schema — visitor / session / event / order_mirror /
         order_mirror_item / traffic_quality / admin_audit (sourced from
         `admin_schema.sql`).
    """
    log.info("running migrations on startup")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Reuse the same connection — keeps both tiers inside one transaction
        # so a partial failure on the admin schema doesn't leave orders half-
        # applied. Idempotent on retries: every statement is IF NOT EXISTS
        # or wrapped in an EXCEPTION-swallowing DO block.
        await run_admin_migrations(conn)
    log.info(
        "migrations done",
        extra={
            "orm_tables": list(Base.metadata.tables.keys()),
            "admin_tables_source": "admin_schema.sql",
        },
    )
