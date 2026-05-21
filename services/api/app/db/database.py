"""
Async SQLAlchemy engine + session factory.

A single `AsyncEngine` lives for the lifetime of the FastAPI process; each
request gets its own `AsyncSession` injected via `Depends(get_session)`.
The pool keeps a few connections warm so cold-start latency stays low on
EasyPanel restarts.

No ORM models live here — see `models.py` so this module can be imported
freely without bringing the whole schema with it.
"""

from __future__ import annotations

from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings


_settings = get_settings()


engine: AsyncEngine = create_async_engine(
    _settings.database_url,
    echo=_settings.is_dev,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
)


SessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding a session per request."""
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
