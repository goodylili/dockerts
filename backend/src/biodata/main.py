"""FastAPI application factory."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends, FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from biodata.api.routes import router as api_router
from biodata.config import Settings, get_settings
from biodata.db import get_session, ping
from biodata.logging import configure_logging

API_PREFIX = "/api/v1"


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="biodata",
        version="0.1.0",
        summary="Biodata records service",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["ops"])
    def health(
        response: Response,
        session: Annotated[Session, Depends(get_session)],
    ) -> dict[str, Any]:
        """Report service and database liveness."""
        healthy = ping(session)
        if not healthy:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            return {"status": "error", "database": "error"}
        return {"status": "ok", "database": "ok"}

    app.include_router(api_router, prefix=API_PREFIX)
    return app


app = create_app()
