# syntax=docker/dockerfile:1.7

########################################
# Stage 1 — builder: resolve + install dependencies with uv
########################################
FROM python:3.13-slim AS builder

# uv binary, copied from the official distroless image (no curl/build tools needed)
COPY --from=ghcr.io/astral-sh/uv:0.5.29 /uv /uvx /usr/local/bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv

WORKDIR /app

# --- dependency layer -------------------------------------------------------
# Only the lock + manifest, so this layer is cached until dependencies change.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

# --- project layer ----------------------------------------------------------
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

########################################
# Stage 2 — runtime: slim, non-root, no build toolchain
########################################
FROM python:3.13-slim AS runtime

# uv is kept only as a thin launcher (`uv run ...`); it pulls in no toolchain.
COPY --from=ghcr.io/astral-sh/uv:0.5.29 /uv /usr/local/bin/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH" \
    VIRTUAL_ENV=/app/.venv \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    UV_NO_SYNC=1 \
    UV_PYTHON_DOWNLOADS=never \
    LOG_LEVEL=INFO

RUN groupadd --system --gid 1001 app \
    && useradd --system --uid 1001 --gid app --create-home --home-dir /home/app app

WORKDIR /app

COPY --from=builder --chown=1001:1001 /app /app

USER 1001:1001

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
    CMD ["python", "-c", "import sys,urllib.request;sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"]

CMD ["uvicorn", "biodata.main:app", "--host", "0.0.0.0", "--port", "8000"]
