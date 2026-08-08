# biodata

A small full-stack app for capturing and listing **biodata records** (name, contact,
date of birth, sex, height/weight, blood type, notes). It is deliberately built as
three separable pieces so the whole thing runs with one `docker compose up`:

- **`backend/`** — Python 3.12 / FastAPI service backed by Postgres 16
  (SQLAlchemy 2.x, psycopg 3, Alembic, pydantic v2). Owns the data and the
  validation rules.
- **`frontend/`** — Next.js 15 App Router UI (TypeScript strict, Tailwind CSS v4).
  The browser **never** talks to the Python service directly; the Next app proxies
  through its own route handlers under `/api/*`.
- **`db`** — Postgres 16, one named volume, published on host port **5433** so it
  does not collide with a Postgres you may already run locally.

The one behaviour worth calling out up front: **creating a record is replay-safe**.
See [Idempotency](#idempotency-guarantee).

---

## Architecture

```mermaid
flowchart LR
    subgraph browser["Browser"]
        UI["Next.js UI<br/>(client components)"]
    end

    subgraph frontendc["frontend container :3000"]
        RH["Route handlers<br/>/api/bio-records"]
    end

    subgraph backendc["backend container :8000"]
        API["FastAPI<br/>/api/v1/bio-records<br/>/health"]
        MIG["Alembic migrations<br/>(run at startup)"]
    end

    subgraph dbc["db container :5432 → host 5433"]
        PG[("Postgres 16<br/>bio_records")]
    end

    UI -->|"fetch + Idempotency-Key"| RH
    RH -->|"BACKEND_URL=http://backend:8000"| API
    API -->|"DATABASE_URL (psycopg 3)"| PG
    MIG --> PG

    classDef box fill:#0d1117,stroke:#30363d,color:#e6edf3;
```

Startup order is enforced by compose: `db` must pass its `pg_isready`
healthcheck before `backend` starts, and `backend` must pass `/health` before
`frontend` starts.

---

## Quickstart (Docker)

Requires Docker Engine 24+ with the Compose v2 plugin.

```bash
cp .env.example .env      # defaults work as-is for local use
make up                   # == docker compose up -d --build
```

Then:

| what              | where                                   |
|-------------------|-----------------------------------------|
| UI                | http://localhost:3000                   |
| API health        | http://localhost:8000/health            |
| API records       | http://localhost:8000/api/v1/bio-records|
| Postgres          | `localhost:5433` (user/pass `biodata`)  |

Useful targets:

```bash
make logs      # follow all service logs
make migrate   # run `alembic upgrade head` against the running stack
make build     # build both images
make down      # stop and drop volumes
make clean     # down + remove local images and caches
```

The backend container runs migrations then serves, via the compose `command`:

```
sh -c "uv run alembic upgrade head && uv run python -m biodata"
```

---

## Local dev without Docker

Start just Postgres, then run each service on the host:

```bash
docker compose up -d db          # Postgres on localhost:5433
```

**Backend** (cwd `backend/`, needs [uv](https://docs.astral.sh/uv/)):

```bash
uv sync --frozen
export DATABASE_URL=postgresql+psycopg://biodata:biodata@localhost:5433/biodata
uv run alembic upgrade head
uv run uvicorn biodata.app:app --reload --port 8000
```

**Frontend** (cwd `frontend/`, Node 22):

```bash
npm ci
BACKEND_URL=http://localhost:8000 npm run dev
```

Checks, mirroring CI exactly:

```bash
# backend/
uv run ruff check . && uv run ruff format --check . && uv run mypy src && uv run pytest -q
# frontend/
npm run lint && npm run typecheck && npm run build && npm test
# both, from the repo root:
make lint && make test
```

---

## Environment variables

Copy `.env.example` → `.env`. Nothing secret is committed; compose reads `.env`
and falls back to the defaults shown below.

| variable             | service   | default                                                      | notes |
|----------------------|-----------|--------------------------------------------------------------|-------|
| `POSTGRES_USER`      | db        | `biodata`                                                    | |
| `POSTGRES_PASSWORD`  | db        | `biodata`                                                    | change for anything non-local |
| `POSTGRES_DB`        | db        | `biodata`                                                    | |
| `POSTGRES_HOST_PORT` | db        | `5433`                                                       | host port mapped to container `5432` |
| `DATABASE_URL`       | backend   | `postgresql+psycopg://biodata:biodata@db:5432/biodata`       | SQLAlchemy URL; use `localhost:5433` off-compose |
| `CORS_ORIGINS`       | backend   | `http://localhost:3000`                                      | comma separated |
| `LOG_LEVEL`          | backend   | `INFO`                                                       | |
| `BACKEND_HOST_PORT`  | backend   | `8000`                                                       | |
| `BACKEND_URL`        | frontend  | `http://backend:8000`                                        | **server-side only**, never exposed to the browser |
| `FRONTEND_HOST_PORT` | frontend  | `3000`                                                       | |
| `TEST_DATABASE_URL`  | tests/CI  | see `.env.example`                                           | database the backend test suite targets |

---

## HTTP API

Backend, prefix `/api/v1` (health is bare `/health`):

| method | path                       | notes |
|--------|----------------------------|-------|
| GET    | `/health`                  | `200 {"status":"ok","database":"ok"}`; `503` with `"database":"error"` if the DB ping fails |
| POST   | `/api/v1/bio-records`      | requires `Idempotency-Key` header (8..128 chars). `201` created · `200` replay of an identical body · `409` same key with a *different* body · `422` validation error |
| GET    | `/api/v1/bio-records`      | `?limit=` (1..100, default 20) `&offset=` (>= 0, default 0) → `{"items":[…],"total":int,"limit":int,"offset":int}`, ordered `created_at DESC` |
| GET    | `/api/v1/bio-records/{id}` | `200` record · `404` unknown id |

Frontend proxy route handlers (what the browser actually calls):

| method | path                  | forwards to |
|--------|-----------------------|-------------|
| POST   | `/api/bio-records`    | `POST /api/v1/bio-records`, passing through the client-generated `Idempotency-Key` and the backend's status + JSON verbatim |
| GET    | `/api/bio-records`    | `GET /api/v1/bio-records?limit=&offset=` |

A record stores the columns of `bio_records`; `age` and `bmi` are **derived on
read** and never stored.

Example:

```bash
curl -i -X POST http://localhost:8000/api/v1/bio-records \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "full_name": "Ada Lovelace",
    "email": "ada@example.com",
    "date_of_birth": "1990-05-02",
    "sex": "female",
    "height_cm": 170.0,
    "weight_kg": 62.5,
    "blood_type": "O+",
    "country": "NG"
  }'
```

---

## Idempotency guarantee

`POST /api/v1/bio-records` is safe to retry. The client generates an
`Idempotency-Key` (`crypto.randomUUID()`) once per logical submission and sends it
on every attempt, including retries.

- The table has a **UNIQUE constraint on `idempotency_key`**, and the insert uses
  on-conflict handling — not a read-then-write, which would race under concurrency.
- First request with a key → **`201`** and the new record.
- Same key, byte-identical body → **`200`** and the *same* record, unchanged. No
  duplicate row, no second side effect.
- Same key, different body → **`409 idempotency_key_reuse`**, so a key is never
  silently reused for different data.

This is verified in CI, not just documented: the `compose-smoke` job POSTs the same
payload twice with one key against the real stack and fails unless the first is
`201`, the second is `200`, and both return an identical `id`.

---

## How CI works

`.github/workflows/ci.yml` runs on every push and pull request, with
`concurrency` cancelling superseded runs and `permissions: contents: read`.

| job             | what it does |
|-----------------|--------------|
| `backend`       | `postgres:16` service container (health-gated), `TEST_DATABASE_URL` set, uv installed via `astral-sh/setup-uv` with caching, then `uv sync --frozen` → `ruff check` → `ruff format --check` → `mypy src` → `pytest -q` |
| `frontend`      | `actions/setup-node@v4`, Node 22, npm cache, then `npm ci` → `npm run lint` → `npm run typecheck` → `npm run build` → `npm test` |
| `docker`        | builds **both** images with buildx / `docker/build-push-action` using GitHub Actions layer cache. **Build only — nothing is pushed.** |
| `compose-smoke` | needs the three above; `docker compose up -d --build`, waits for `/health` and the frontend to answer, runs the idempotent-replay assertion, dumps `docker compose logs` on failure, and `docker compose down -v` always |

`.github/dependabot.yml` keeps uv, npm, Docker base images and GitHub Actions
up to date on a weekly cadence.

---

## Repo layout

```
backend/            FastAPI service (src/biodata, alembic/, tests/)
  Dockerfile        multi-stage, uv install, non-root, healthchecked
frontend/           Next.js app (src/app, route handlers under /api)
  Dockerfile        multi-stage node:22-alpine, non-root
docker-compose.yml  db + backend + frontend
Makefile            up / down / logs / migrate / test / lint / build / clean
.github/            CI workflow + dependabot
.env.example        every knob, with safe local defaults
CONTRACT.md         the shared spec all three services are built against
```
# tsexample
