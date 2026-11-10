# biodata backend

FastAPI service backing the biodata app. Python 3.12, SQLAlchemy 2.x, Alembic,
Postgres 16, managed with [uv](https://docs.astral.sh/uv/).

## Layout

```
src/biodata/
  config.py       pydantic-settings configuration
  db.py           engine, session factory, health ping
  models.py       SQLAlchemy 2.0 declarative models
  schemas.py      pydantic v2 request/response models (derived age + bmi)
  repository.py   data access (INSERT ... ON CONFLICT DO NOTHING)
  service.py      business logic, idempotency handling
  api/routes.py   HTTP routes mounted at /api/v1
  main.py         app factory, CORS, /health
  __main__.py     uvicorn entrypoint
alembic/          migrations
tests/            pytest suite
```

## Environment

| variable       | default                                                      |
|----------------|--------------------------------------------------------------|
| `DATABASE_URL` | `postgresql+psycopg://biodata:biodata@localhost:5433/biodata` |
| `CORS_ORIGINS` | `http://localhost:3000` (comma separated)                     |
| `LOG_LEVEL`    | `INFO`                                                        |

## Running

```bash
uv sync
uv run alembic upgrade head
uv run python -m biodata          # serves on 0.0.0.0:8000
```

## Idempotency

`POST /api/v1/bio-records` requires an `Idempotency-Key` header (8..128 chars).

The write is replay-safe by construction: `bio_records.idempotency_key` carries a
UNIQUE constraint and inserts go through `INSERT ... ON CONFLICT (idempotency_key)
DO NOTHING`, so a replay or a concurrent duplicate can never create a second row.
The row also stores `request_hash`, a SHA-256 of the canonicalised (validated,
key-sorted) request body. On conflict the stored hash is compared with the
incoming one:

- same key, same body → `200` with the original record
- same key, different body → `409 {"detail":{"code":"idempotency_key_reuse",...}}`

`request_hash` is an internal column and is never exposed in API responses.

## Quality gates

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy src
uv run pytest -q
```

Database-backed tests run only when `TEST_DATABASE_URL` is set (CI supplies a
Postgres service); without it they are skipped and the pure validation tests
still run.
