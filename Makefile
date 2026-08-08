SHELL := /bin/bash
COMPOSE ?= docker compose

.DEFAULT_GOAL := help
.PHONY: help up down logs migrate test lint build clean

help: ## Show available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

up: ## Build and start the whole stack in the background
	$(COMPOSE) up -d --build
	@echo "backend  -> http://localhost:8000/health"
	@echo "frontend -> http://localhost:3000"

down: ## Stop the stack and remove volumes
	$(COMPOSE) down -v --remove-orphans

logs: ## Follow logs for all services
	$(COMPOSE) logs -f

migrate: ## Run Alembic migrations against the running stack
	$(COMPOSE) run --rm backend uv run alembic upgrade head

test: ## Run backend and frontend test suites
	cd backend && uv run pytest -q
	cd frontend && npm test

lint: ## Lint and type-check both services
	cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy src
	cd frontend && npm run lint && npm run typecheck

build: ## Build both container images
	$(COMPOSE) build

clean: ## Remove containers, volumes, images and local caches
	-$(COMPOSE) down -v --remove-orphans --rmi local
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -rf backend/.pytest_cache backend/.mypy_cache backend/.ruff_cache
	rm -rf frontend/.next frontend/coverage
