# dockerts

A small FastAPI service, packaged so it builds into a wheel and drops cleanly into a container.

## Layout

```
pyproject.toml        # hatchling build backend, deps, entrypoint
src/dockerts/
  app.py              # create_app() + routes
  config.py           # env-driven settings (HOST, PORT, APP_ENV)
  __main__.py         # `dockerts` console script -> uvicorn
tests/test_app.py
```

## Local run

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
dockerts                    # or: uvicorn dockerts.app:app --reload
```

## Build

```bash
pip install build
python -m build             # -> dist/dockerts-0.1.0-py3-none-any.whl
```

## Test

```bash
pytest
```

## Endpoints

| Method | Path            | Response                                        |
| ------ | --------------- | ----------------------------------------------- |
| GET    | `/healthz`      | `{"status":"ok","version":"0.1.0","env":"..."}` |
| GET    | `/hello/{name}` | `{"message":"Hello, {name}!"}`                  |

## Environment

| Var       | Default       |
| --------- | ------------- |
| `HOST`    | `0.0.0.0`     |
| `PORT`    | `8000`        |
| `APP_ENV` | `development` |

## Containerising

No Dockerfile here — that's yours. Notes that may help:

- `python -m build` produces a wheel; `pip install dist/*.whl` then `dockerts` is a clean two-stage setup.
- The app already binds `0.0.0.0` and reads `PORT`, so no code changes needed.
- `/healthz` works as a `HEALTHCHECK` target.
- `.dockerignore` is already in place.
# dockerts
