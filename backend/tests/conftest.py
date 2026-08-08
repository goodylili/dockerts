"""Shared test fixtures.

DB-backed tests run only when ``TEST_DATABASE_URL`` points at a Postgres
instance; otherwise they are skipped so that ``pytest -q`` still passes on a
machine with no database available. Pure validation tests always run.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Iterator
from typing import Any

import pytest

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

if TEST_DATABASE_URL:
    # Make the application read the same database as the tests.
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

requires_db = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL is not set; skipping database-backed tests",
)


def sample_payload(**overrides: Any) -> dict[str, Any]:
    """Return a valid create payload, with optional field overrides."""
    payload: dict[str, Any] = {
        "full_name": "Ada Lovelace",
        "email": "ada@example.com",
        "phone": "+2348012345678",
        "date_of_birth": "1990-05-02",
        "sex": "female",
        "height_cm": 170.0,
        "weight_kg": 62.5,
        "blood_type": "O+",
        "allergies": None,
        "medical_notes": None,
        "country": "NG",
    }
    payload.update(overrides)
    return payload


@pytest.fixture(scope="session")
def _database() -> Iterator[None]:
    """Create a clean schema for the whole test session."""
    if not TEST_DATABASE_URL:  # pragma: no cover - guarded by requires_db
        pytest.skip("TEST_DATABASE_URL is not set")

    from alembic import command
    from alembic.config import Config
    from sqlalchemy import text

    from biodata.db import get_engine
    from biodata.models import Base

    engine = get_engine()
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
    Base.metadata.drop_all(engine)

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    config = Config(os.path.join(root, "alembic.ini"))
    config.set_main_option("script_location", os.path.join(root, "alembic"))
    config.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
    command.upgrade(config, "head")

    yield

    Base.metadata.drop_all(engine)
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE IF EXISTS alembic_version"))


@pytest.fixture
def clean_tables(_database: None) -> Iterator[None]:
    """Truncate ``bio_records`` before each database-backed test."""
    from sqlalchemy import text

    from biodata.db import get_engine

    with get_engine().begin() as connection:
        connection.execute(text("TRUNCATE TABLE bio_records"))
    yield


@pytest.fixture
async def client(clean_tables: None) -> AsyncIterator[Any]:
    """Return an httpx client bound to the ASGI app."""
    import httpx

    from biodata.main import create_app

    app = create_app()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as http_client:
        yield http_client
