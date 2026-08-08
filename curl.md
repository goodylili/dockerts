# curl reference

Every endpoint the service exposes, as a runnable `curl` call.

Set the base URL once, then paste any block below:

```bash
export BASE=http://localhost:8000
```

`8000` is the default for a local `dockerts` / `uvicorn` run. Under
`docker compose` the api service publishes `8000:9000`, so reach it on
`http://localhost:9000` — or fix the mapping to `8000:8000`, since the
container listens on `PORT=8000`.

## Endpoints

| Method | Path            | Purpose                              |
| ------ | --------------- | ------------------------------------ |
| GET    | `/healthz`      | Liveness + version + environment     |
| GET    | `/hello/{name}` | Greeting                             |
| POST   | `/contacts`     | Create a contact (idempotent)        |
| GET    | `/contacts`     | List all contacts, ordered by `id`   |
| GET    | `/openapi.json` | OpenAPI schema (FastAPI built-in)    |
| GET    | `/docs`         | Swagger UI (FastAPI built-in)        |
| GET    | `/redoc`        | ReDoc UI (FastAPI built-in)          |

---

## GET /healthz

```bash
curl -s "$BASE/healthz"
```

```json
{ "status": "ok", "version": "0.1.0", "env": "development" }
```

Useful as a readiness gate in scripts — `-f` makes a non-2xx exit non-zero:

```bash
curl -sf "$BASE/healthz" >/dev/null && echo up || echo down
```

Wait for the service to come up (handy right after `docker compose up -d`):

```bash
until curl -sf "$BASE/healthz" >/dev/null; do sleep 1; done; echo ready
```

## GET /hello/{name}

```bash
curl -s "$BASE/hello/world"
```

```json
{ "message": "Hello, world!" }
```

Names with spaces or other characters need URL encoding — `--get --data-urlencode`
can't build a path segment, so let curl encode it:

```bash
curl -s "$BASE/hello/$(printf 'Ada Lovelace' | jq -sRr @uri)"
# {"message":"Hello, Ada Lovelace!"}
```

## POST /contacts

Creates a contact. `name` is 1–100 chars, `phone` is 5–32 chars; both are
stripped of surrounding whitespace before storage.

```bash
curl -s -X POST "$BASE/contacts" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada Lovelace","phone":"+2348012345678"}'
```

`201 Created` on first write:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "phone": "+2348012345678",
  "created_at": "2026-08-08T11:20:31.482913+00:00"
}
```

The write is idempotent on `(name, phone)`. Replaying the exact same body
returns the **same** row with `200 OK` instead of `201`, and inserts nothing:

```bash
# run twice — watch the status code change 201 -> 200, and `id` stay the same
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/contacts" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada Lovelace","phone":"+2348012345678"}'
```

Show the status code alongside the body:

```bash
curl -s -w '\nHTTP %{http_code}\n' -X POST "$BASE/contacts" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Grace Hopper","phone":"+15551234567"}'
```

### Validation failures

A too-short `phone` (under 5 chars) fails validation with `422`:

```bash
curl -s -X POST "$BASE/contacts" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","phone":"123"}'
```

```json
{
  "detail": [
    {
      "type": "string_too_short",
      "loc": ["body", "phone"],
      "msg": "String should have at least 5 characters",
      "input": "123",
      "ctx": { "min_length": 5 }
    }
  ]
}
```

An empty `name` fails the same way:

```bash
curl -s -X POST "$BASE/contacts" \
  -H 'Content-Type: application/json' \
  -d '{"name":"","phone":"+15551234567"}'
```

A missing field:

```bash
curl -s -X POST "$BASE/contacts" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada"}'
```

### Body from a file

```bash
cat > /tmp/contact.json <<'JSON'
{"name":"Alan Turing","phone":"+441234567890"}
JSON

curl -s -X POST "$BASE/contacts" \
  -H 'Content-Type: application/json' \
  --data-binary @/tmp/contact.json
```

## GET /contacts

```bash
curl -s "$BASE/contacts"
```

```json
[
  {
    "id": 1,
    "name": "Ada Lovelace",
    "phone": "+2348012345678",
    "created_at": "2026-08-08T11:20:31.482913+00:00"
  },
  {
    "id": 2,
    "name": "Grace Hopper",
    "phone": "+15551234567",
    "created_at": "2026-08-08T11:21:02.117640+00:00"
  }
]
```

Pretty-print and count:

```bash
curl -s "$BASE/contacts" | jq .
curl -s "$BASE/contacts" | jq 'length'
```

## FastAPI built-ins

Generated automatically — no route code in `app.py`.

```bash
curl -s "$BASE/openapi.json" | jq '.paths | keys'
# ["/contacts","/healthz","/hello/{name}"]

curl -s "$BASE/docs"     # Swagger UI (HTML)
curl -s "$BASE/redoc"     # ReDoc (HTML)
```

---

## Full smoke test

Exercises every route in order, including the idempotency replay.

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE=${BASE:-http://localhost:8000}

echo "waiting for $BASE ..."
until curl -sf "$BASE/healthz" >/dev/null; do sleep 1; done

curl -s "$BASE/healthz" | jq .
curl -s "$BASE/hello/world" | jq .

BODY='{"name":"Ada Lovelace","phone":"+2348012345678"}'

echo "first write (expect 201):"
curl -s -o /dev/null -w '  %{http_code}\n' -X POST "$BASE/contacts" \
  -H 'Content-Type: application/json' -d "$BODY"

echo "replay (expect 200, no new row):"
curl -s -o /dev/null -w '  %{http_code}\n' -X POST "$BASE/contacts" \
  -H 'Content-Type: application/json' -d "$BODY"

echo "invalid payload (expect 422):"
curl -s -o /dev/null -w '  %{http_code}\n' -X POST "$BASE/contacts" \
  -H 'Content-Type: application/json' -d '{"name":"Ada","phone":"123"}'

echo "contacts:"
curl -s "$BASE/contacts" | jq .
```

## Handy curl flags

| Flag                        | Effect                                          |
| --------------------------- | ----------------------------------------------- |
| `-s`                        | Silent — no progress meter                      |
| `-f`                        | Non-zero exit on HTTP >= 400                    |
| `-i`                        | Include response headers in the output          |
| `-w '%{http_code}\n'`       | Print just the status code                      |
| `-o /dev/null`              | Discard the body (pair with `-w`)               |
| `--data-binary @file.json`  | Send a file verbatim as the body                |
| `-m 5`                      | Give up after 5 seconds                         |
