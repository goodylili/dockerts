"""Health endpoint tests that do not need a real database."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import httpx
import pytest

from biodata import main
from biodata.db import get_session


def _fake_session() -> Iterator[Any]:
    yield object()


@pytest.mark.parametrize(
    "healthy,expected_status,expected_body",
    [
        (True, 200, {"status": "ok", "database": "ok"}),
        (False, 503, {"status": "error", "database": "error"}),
    ],
)
async def test_health_reflects_database_ping(
    monkeypatch: pytest.MonkeyPatch,
    healthy: bool,
    expected_status: int,
    expected_body: dict[str, str],
) -> None:
    monkeypatch.setattr(main, "ping", lambda _session: healthy)
    app = main.create_app()
    app.dependency_overrides[get_session] = _fake_session

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/health")

    assert response.status_code == expected_status
    assert response.json() == expected_body
