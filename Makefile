UV ?= uv
PNPM ?= pnpm

.PHONY: install install-ai install-web build up down restart ps logs dev-ai dev-web test test-ai test-web seed-db clean

install: install-ai install-web

install-ai:
	cd apps/orca-ai && $(UV) sync --extra dev

install-web:
	cd apps/orca-web && $(PNPM) install --ignore-workspace

build:
	docker compose build

up:
	docker compose up -d --build

down:
	docker compose down

restart: down up

ps:
	docker compose ps

logs:
	docker compose logs -f orca-ai orca-web

dev-ai:
	cd apps/orca-ai && $(UV) run uvicorn main:app --reload --host 0.0.0.0 --port 8001

dev-web:
	cd apps/orca-web && $(PNPM) dev

test: test-ai test-web

test-ai:
	cd apps/orca-ai && $(UV) run --extra dev pytest

test-web:
	cd apps/orca-web && $(PNPM) build

seed-db:
	cd apps/orca-ai && $(UV) run python ../../scripts/ingest/seed_db.py

clean:
	rm -rf apps/orca-ai/.pytest_cache apps/orca-ai/.coverage apps/orca-web/.next
