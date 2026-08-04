import os

import psycopg
import pytest
from fastapi.testclient import TestClient

from dockerts.app import create_app
from dockerts.config import Settings

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://app:app@localhost:5433/dockerts",
)


@pytest.fixture(scope="session")
def database_url() -> str:
    try:
        with psycopg.connect(TEST_DATABASE_URL, connect_timeout=3):
            pass
    except psycopg.OperationalError as exc:
        pytest.skip(
            f"Postgres not reachable at {TEST_DATABASE_URL} "
            f"(start it with `docker compose up -d db`): {exc}"
        )
    return TEST_DATABASE_URL


@pytest.fixture
def client(database_url: str) -> TestClient:
    settings = Settings(
        host="127.0.0.1",
        port=8000,
        env="test",
        database_url=database_url,
    )
    app = create_app(settings)
    with psycopg.connect(database_url) as conn:
        conn.execute("TRUNCATE contacts RESTART IDENTITY")
        conn.commit()
    with TestClient(app) as test_client:
        yield test_client
