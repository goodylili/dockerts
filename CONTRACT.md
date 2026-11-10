# Shared Contract — biodata app

This file is the single source of truth all agents build against. **Do not change it.**
If something here seems wrong, note it in your final report instead of editing.

## Repo layout (strict — stay inside your own directory)

```
backend/          # Python FastAPI service   (backend agent owns)
frontend/         # Next.js app              (frontend agent owns)
.github/          # workflows                (devops agent owns)
docker-compose.yml, .dockerignore, .gitignore, Makefile, README.md   (devops agent owns)
backend/Dockerfile        (devops agent owns — backend agent does NOT write it)
frontend/Dockerfile       (devops agent owns — frontend agent does NOT write it)
```

## Ports

| service  | container port | host port |
|----------|----------------|-----------|
| postgres | 5432           | 5433      |
| backend  | 8000           | 8000      |
| frontend | 3000           | 3000      |

## Env vars

Backend:
- `DATABASE_URL` — e.g. `postgresql+psycopg://biodata:biodata@db:5432/biodata`
- `CORS_ORIGINS` — comma separated, default `http://localhost:3000`
- `LOG_LEVEL` — default `INFO`

Frontend:
- `BACKEND_URL` — server-side only, e.g. `http://backend:8000` (in compose) / `http://localhost:8000` (local dev)

The browser never talks to the Python service directly. The Next.js app proxies
through its own route handlers under `/api/*`.

## Data model — `bio_records` table

| column           | type          | notes |
|------------------|---------------|-------|
| id               | uuid PK       | server generated |
| idempotency_key  | text          | UNIQUE, NOT NULL |
| full_name        | text          | NOT NULL, 1..200 |
| email            | text          | NOT NULL, valid email, lowercased |
| phone            | text NULL     | max 32 |
| date_of_birth    | date          | NOT NULL, must be in the past, age <= 130 |
| sex              | text          | NOT NULL, one of: `male`, `female`, `intersex`, `prefer_not_to_say` |
| height_cm        | numeric(5,2)  | NOT NULL, 30..300 |
| weight_kg        | numeric(5,2)  | NOT NULL, 2..650 |
| blood_type       | text NULL     | one of: `A+ A- B+ B- AB+ AB- O+ O-` |
| allergies        | text NULL     | max 2000 |
| medical_notes    | text NULL     | max 5000 |
| country          | text NULL     | ISO-3166 alpha-2, uppercased |
| request_hash     | text          | NOT NULL, internal — SHA-256 of the canonical validated payload. Never appears in any API response. Exists so `Idempotency-Key` reuse with a changed body can be detected and rejected with 409. |
| created_at       | timestamptz   | NOT NULL default now() |
| updated_at       | timestamptz   | NOT NULL default now() |

Derived, computed on read (never stored): `age` (int), `bmi` (float, 1 dp).

## HTTP API (backend, prefix `/api/v1`)

### `GET /health`  (no prefix — bare `/health`)
`200 {"status":"ok","database":"ok"}` — returns 503 with `"database":"error"` if the DB ping fails.

### `POST /api/v1/bio-records`
Header: `Idempotency-Key: <string 8..128>` — **required**.
Body: JSON with the writable columns above (no `id`, no timestamps).

- `201` — created. Body = BioRecord resource.
- `200` — replay: same `Idempotency-Key` seen before **and** the request body hashes
  identical → returns the previously created record unchanged.
- `409` — same `Idempotency-Key` reused with a *different* body.
  `{"detail":{"code":"idempotency_key_reuse","message":"..."}}`
- `422` — validation error (FastAPI default shape).

Replay safety is mandatory: implement with a UNIQUE constraint on `idempotency_key`
plus insert-on-conflict handling, not a read-then-write race.

### `GET /api/v1/bio-records?limit=&offset=`
`limit` 1..100 default 20, `offset` >= 0 default 0.
`200 {"items":[BioRecord],"total":int,"limit":int,"offset":int}` ordered `created_at DESC`.

### `GET /api/v1/bio-records/{id}`
`200` BioRecord, `404` if unknown.

### BioRecord resource shape

```json
{
  "id": "uuid",
  "full_name": "Ada Lovelace",
  "email": "ada@example.com",
  "phone": "+2348012345678",
  "date_of_birth": "1990-05-02",
  "sex": "female",
  "height_cm": 170.0,
  "weight_kg": 62.5,
  "blood_type": "O+",
  "allergies": null,
  "medical_notes": null,
  "country": "NG",
  "age": 36,
  "bmi": 21.6,
  "created_at": "2026-08-08T10:00:00Z",
  "updated_at": "2026-08-08T10:00:00Z"
}
```

## Frontend route handlers (proxy)

- `POST /api/bio-records` → forwards to backend `POST /api/v1/bio-records`,
  forwarding the `Idempotency-Key` header the client generated (`crypto.randomUUID()`).
  Passes the backend status + JSON straight through.
- `GET /api/bio-records?limit=&offset=` → forwards to backend list endpoint.

## Commands CI must be able to run

Backend (cwd `backend/`):
- `uv sync --frozen` (uv-managed; `uv.lock` committed)
- `uv run ruff check .`
- `uv run ruff format --check .`
- `uv run mypy src`
- `uv run pytest -q`

Frontend (cwd `frontend/`):
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test` (vitest, must pass with zero tests tolerated only if none exist — write some)

## Versions

- Python 3.12, FastAPI, SQLAlchemy 2.x, psycopg 3, Alembic, pydantic v2, pytest, ruff, mypy, uv.
- Node 22, **Next.js 16 App Router** (`create-next-app@latest` ships 16.3 / React 19.2 —
  this spec originally said 15; 16 is what is built and verified), TypeScript strict,
  Tailwind CSS v4, vitest.
- Postgres 16.

## Notes settled during implementation

- `CORS_ORIGINS` is a comma separated string. The field is annotated `NoDecode` so
  pydantic-settings does not JSON-decode it before the splitting validator runs —
  without that, the documented comma form raises `SettingsError` and the service
  never starts. A JSON array is also tolerated; malformed JSON is rejected loudly.
  Covered by `backend/tests/test_config.py`.
- Migrations are applied by the compose `command` (`alembic upgrade head`) before the
  app starts, not by the Dockerfile entrypoint.
- The frontend proxy rejects a missing or out-of-range `Idempotency-Key` itself with
  `400 {"detail":{"code":"idempotency_key_invalid"}}` rather than forwarding it, and
  clamps `limit`/`offset` to the backend's bounds instead of provoking a 422.
- `GET /health` returns `{"status":"error","database":"error"}` with 503 when the DB
  ping fails; the container healthcheck treats that as unhealthy.
- `country` is validated as `^[A-Z]{2}$`, not against the real ISO-3166 list.
