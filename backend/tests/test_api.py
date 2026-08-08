"""End-to-end API tests. Require ``TEST_DATABASE_URL``."""

from __future__ import annotations

import uuid
from typing import Any

import httpx
import pytest

from tests.conftest import requires_db, sample_payload

pytestmark = requires_db

PATH = "/api/v1/bio-records"


def _key() -> str:
    return str(uuid.uuid4())


async def _create(client: httpx.AsyncClient, key: str, **overrides: Any) -> httpx.Response:
    return await client.post(
        PATH, json=sample_payload(**overrides), headers={"Idempotency-Key": key}
    )


async def test_health_reports_ok(client: httpx.AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


async def test_create_returns_201_with_derived_fields(client: httpx.AsyncClient) -> None:
    response = await _create(client, _key())
    assert response.status_code == 201
    body = response.json()
    assert body["full_name"] == "Ada Lovelace"
    assert body["email"] == "ada@example.com"
    assert body["height_cm"] == 170.0
    assert body["bmi"] == 21.6
    assert isinstance(body["age"], int)
    assert "request_hash" not in body
    assert "idempotency_key" not in body
    uuid.UUID(body["id"])


async def test_missing_idempotency_key_is_422(client: httpx.AsyncClient) -> None:
    response = await client.post(PATH, json=sample_payload())
    assert response.status_code == 422


async def test_short_idempotency_key_is_422(client: httpx.AsyncClient) -> None:
    response = await _create(client, "short")
    assert response.status_code == 422


async def test_invalid_body_is_422(client: httpx.AsyncClient) -> None:
    response = await _create(client, _key(), sex="unknown")
    assert response.status_code == 422


async def test_replay_returns_200_with_identical_body(client: httpx.AsyncClient) -> None:
    key = _key()
    first = await _create(client, key)
    assert first.status_code == 201

    second = await _create(client, key)
    assert second.status_code == 200
    assert second.json() == first.json()

    listing = await client.get(PATH)
    assert listing.json()["total"] == 1


async def test_reused_key_with_different_body_is_409(client: httpx.AsyncClient) -> None:
    key = _key()
    assert (await _create(client, key)).status_code == 201

    conflict = await _create(client, key, weight_kg=99.0)
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "idempotency_key_reuse"

    listing = await client.get(PATH)
    assert listing.json()["total"] == 1


async def test_semantically_identical_body_is_a_replay(client: httpx.AsyncClient) -> None:
    key = _key()
    first = await _create(client, key)
    replay = await _create(client, key, email="ADA@EXAMPLE.COM", country="ng")
    assert replay.status_code == 200
    assert replay.json()["id"] == first.json()["id"]


async def test_get_by_id_and_404(client: httpx.AsyncClient) -> None:
    created = (await _create(client, _key())).json()

    found = await client.get(f"{PATH}/{created['id']}")
    assert found.status_code == 200
    assert found.json()["id"] == created["id"]

    missing = await client.get(f"{PATH}/{uuid.uuid4()}")
    assert missing.status_code == 404
    assert missing.json()["detail"]["code"] == "not_found"


async def test_get_by_malformed_id_is_422(client: httpx.AsyncClient) -> None:
    response = await client.get(f"{PATH}/not-a-uuid")
    assert response.status_code == 422


async def test_pagination_defaults_and_ordering(client: httpx.AsyncClient) -> None:
    names = [f"Person {index}" for index in range(5)]
    for name in names:
        assert (await _create(client, _key(), full_name=name)).status_code == 201

    default_page = await client.get(PATH)
    body = default_page.json()
    assert body["limit"] == 20
    assert body["offset"] == 0
    assert body["total"] == 5
    assert len(body["items"]) == 5
    assert [item["full_name"] for item in body["items"]] == list(reversed(names))

    page = await client.get(PATH, params={"limit": 2, "offset": 2})
    sliced = page.json()
    assert sliced["limit"] == 2
    assert sliced["offset"] == 2
    assert sliced["total"] == 5
    assert [item["full_name"] for item in sliced["items"]] == list(reversed(names))[2:4]


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 101}, {"offset": -1}])
async def test_invalid_pagination_is_422(client: httpx.AsyncClient, params: dict[str, int]) -> None:
    response = await client.get(PATH, params=params)
    assert response.status_code == 422
