UV ?= uv

.PHONY: install build up down restart ps logs dev-ai test seed-db clean

install:
	cd apps/orca-ai && $(UV) sync --extra dev

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
	docker compose logs -f orca-ai

dev-ai:
	cd apps/orca-ai && $(UV) run uvicorn main:app --reload --host 0.0.0.0 --port 8001

test:
	cd apps/orca-ai && $(UV) run --extra dev pytest

seed-db:
	cd apps/orca-ai && $(UV) run python ../../scripts/ingest/seed_db.py

clean:
	rm -rf apps/orca-ai/.pytest_cache apps/orca-ai/.coverage
