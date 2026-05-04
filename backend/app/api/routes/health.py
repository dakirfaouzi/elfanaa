"""Liveness + readiness probes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import __version__
from app.db.database import get_session

router = APIRouter(tags=["health"])


@router.get("/health")
async def liveness() -> dict:
    """Cheap liveness check — never touches the DB."""
    return {"ok": True, "version": __version__}


@router.get("/health/ready")
async def readiness(session: AsyncSession = Depends(get_session)) -> dict:
    """Readiness check — verifies DB connectivity (`SELECT 1`)."""
    await session.execute(text("SELECT 1"))
    return {"ok": True, "db": "ready"}
