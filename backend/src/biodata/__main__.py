"""Uvicorn entrypoint: ``python -m biodata``."""

from __future__ import annotations

import uvicorn

from biodata.config import get_settings
from biodata.logging import configure_logging


def main() -> None:
    """Run the ASGI server."""
    settings = get_settings()
    configure_logging(settings.log_level)
    uvicorn.run(
        "biodata.main:app",
        host=settings.host,
        port=settings.port,
        log_config=None,
    )


if __name__ == "__main__":
    main()
