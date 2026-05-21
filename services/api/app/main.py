"""
FastAPI entry point.

What lives here:
   • Lifespan manager (startup migrations, graceful shutdown).
   • CORS configuration (storefront origins from settings).
   • Route registration (orders, health).
   • Global exception handlers (consistent JSON shape).

Everything else lives in `app/api`, `app/services`, or `app/db`.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.api.routes import diagnostics, geo, health, orders
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.migrations import run_migrations


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup + shutdown hooks."""
    settings = get_settings()
    configure_logging(settings.log_level)
    log = logging.getLogger("app.boot")
    log.info(
        "starting",
        extra={"env": settings.app_env, "version": __version__},
    )
    await run_migrations()
    yield
    log.info("shutting down")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="ELFANAA API",
        version=__version__,
        description="Order intake + post-purchase upsell + pixel CAPI for elfanaa.com",
        lifespan=lifespan,
        # Hide /docs in production unless explicitly enabled — premium DTC
        # rarely wants the world poking at the schema.
        docs_url="/docs" if settings.is_dev else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.is_dev else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logging.getLogger("app.error").exception(
            "unhandled error",
            extra={"path": str(request.url.path), "method": request.method},
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_error",
                "message": "Something went wrong on our side. Please retry shortly.",
            },
        )

    app.include_router(health.router)
    app.include_router(orders.router)
    app.include_router(geo.router)
    app.include_router(diagnostics.router)
    return app


app = create_app()
