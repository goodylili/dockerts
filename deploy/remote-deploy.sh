#!/usr/bin/env bash
# Runs on the EC2 box in /opt/dockerts, shipped there by the deploy job.
#
# Required in the environment:
#   BACKEND_IMAGE FRONTEND_IMAGE IMAGE_TAG PUBLIC_HOST GHCR_USER GHCR_TOKEN
#
# Replay-safe: rewrites .env to the same bytes for the same inputs, pulls the
# same digests, converges the same containers, and `alembic upgrade head` is a
# no-op once the schema is current.
set -euo pipefail

: "${BACKEND_IMAGE:?BACKEND_IMAGE is required}"
: "${FRONTEND_IMAGE:?FRONTEND_IMAGE is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"
: "${PUBLIC_HOST:?PUBLIC_HOST is required}"
: "${GHCR_USER:?GHCR_USER is required}"
: "${GHCR_TOKEN:?GHCR_TOKEN is required}"

cd /opt/dockerts

# .env is git-ignored and there is none in the repo, so it is written from
# scratch here rather than patched in place. The database password is the one
# value that must outlive a redeploy: an existing one is reused, and a fresh one
# is minted only on the very first deploy.
POSTGRES_USER=biodata
POSTGRES_DB=biodata
if [ -f .env ] && grep -q '^POSTGRES_PASSWORD=' .env; then
	POSTGRES_PASSWORD="$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)"
else
	POSTGRES_PASSWORD="$(openssl rand -hex 24)"
fi

umask 077
cat > .env <<EOF
BACKEND_IMAGE=${BACKEND_IMAGE}
FRONTEND_IMAGE=${FRONTEND_IMAGE}
IMAGE_TAG=${IMAGE_TAG}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
CORS_ORIGINS=http://${PUBLIC_HOST}
LOG_LEVEL=INFO
EOF

echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin
trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker image prune -f
docker compose -f docker-compose.prod.yml ps
