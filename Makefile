UV ?= uv
PNPM ?= pnpm

.PHONY: install infra-up infra-down dev dev-ml dev-down dev-ai dev-engine dev-web download-data download-delhivery build-features build-delhivery seed-db train evaluate validate-shap evaluate-segments evaluate-full setup-osmnx simulate test test-ai test-engine clean

install:
	cd apps/orca-ai && $(UV) sync --extra dev
	cd apps/orca-engine && go mod download
	cd apps/orca-web && $(PNPM) install

infra-up:
	docker compose up -d postgres redis mlflow

infra-down:
	docker compose down

dev:
	docker compose up -d

dev-ml:
	docker compose up -d postgres redis mlflow orca-ai orca-engine

dev-down:
	docker compose down

dev-ai:
	cd apps/orca-ai && $(UV) run uvicorn main:app --reload --host 0.0.0.0 --port 8000

dev-engine:
	cd apps/orca-engine && go run .

dev-web:
	cd apps/orca-web && $(PNPM) dev

download-data:
	cd apps/orca-ai && $(UV) run python ../../scripts/ingest/download_olist.py

download-delhivery:
	cd apps/orca-ai && $(UV) run python ../../scripts/ingest/download_delhivery.py

build-features:
	cd apps/orca-ai && $(UV) run python ../../scripts/ingest/build_features.py

build-delhivery:
	cd apps/orca-ai && $(UV) run python ../../scripts/ingest/build_delhivery_features.py

setup-osmnx:
	cd apps/orca-ai && $(UV) run python ../../scripts/setup/download_jakarta_graph.py

seed-db:
	cd apps/orca-ai && $(UV) run python ../../scripts/ingest/seed_db.py

train:
	cd apps/orca-ai && $(UV) run python training/train_delay.py

evaluate:
	cd apps/orca-ai && $(UV) run python training/evaluate.py

validate-shap:
	cd apps/orca-ai && $(UV) run python training/validate_shap.py

evaluate-segments:
	cd apps/orca-ai && $(UV) run python training/evaluate_segments.py

evaluate-full: evaluate validate-shap evaluate-segments
	@echo ""
	@echo "==============================================================="
	@echo "  COMPREHENSIVE EVALUATION COMPLETE"
	@echo "  Artifacts in data/processed/:"
	@echo "    - evaluation_plot.png      (Lapis 1-2: confusion + ROC + calibration)"
	@echo "    - shap_summary.png         (Lapis 3: feature attribution)"
	@echo "    - evaluation_segments.json (Lapis 4-5: segments + business impact)"
	@echo "    - optimal_threshold.json   (Production threshold metadata)"
	@echo "==============================================================="

simulate:
	cd apps/orca-ai && $(UV) run python ../../scripts/simulate/stream_replay.py

test: test-ai test-engine

test-ai:
	cd apps/orca-ai && $(UV) run pytest --cov=.

test-engine:
	cd apps/orca-engine && go test ./...

clean:
	rm -rf apps/orca-ai/.pytest_cache apps/orca-ai/.coverage apps/orca-ai/**/__pycache__ data/processed/*.parquet data/processed/*.pkl data/processed/*.png data/processed/*.json
