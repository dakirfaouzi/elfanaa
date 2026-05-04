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

# Importing models registers them on `Base.metadata`. DO NOT remove this
# import even though it looks unused — it has the side-effect of populating
# the metadata that `create_all()` reads.
from app.db import models  # noqa: F401

log = logging.getLogger(__name__)


async def run_migrations() -> None:
    """Idempotent — creates only what doesn't exist. Safe to run on every boot."""
    log.info("running migrations on startup")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("migrations done", extra={"tables": list(Base.metadata.tables.keys())})
