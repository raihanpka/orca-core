# ORCA Development Roadmap

**Document Version**: 2.0
**Last Updated**: May 24, 2026
**Project**: ORCA (Optimized Routing & Carbon Analytics)
**Author**: Raihan Putra Kirana

---

## Table of Contents

- [Development Rules](#development-rules)
- [Product Requirement Document](#product-requirement-document)
- [Day 1: Infrastructure, Monorepo, and Data Pipeline](#day-1-infrastructure-monorepo-and-data-pipeline)
- [Day 2: ML Training, Python API Core](#day-2-ml-training-python-api-core)
- [Day 3: Python Subscriber, Alert System, API Completion](#day-3-go-engine-alert-system-api-completion)
- [Day 4: Next.js Dashboard, SWR polling, Demo Scenarios](#day-4-nextjs-dashboard-websocket-demo-scenarios)

---

## Development Rules

### Global Flow

- [ ] Each task has a clear scope, acceptance criteria, and output artifact
- [ ] No day begins before the previous day's test gate is green
- [ ] Feature engineering code in training and inference must always be identical (same module)
- [ ] All secrets and API keys live only in `.env` files, never in source code
- [ ] No gRPC dependencies at any point in the codebase

### Definition of Done

- [ ] Task output is functional and observable (via logs, API response, or UI)
- [ ] No broken imports or missing dependency errors
- [ ] Environment variables for new services are documented in `.env.example`

---

## Product Requirement Document

- [x] Add `.docs/ORCA_PRD.md` as the product source of truth for MVP scope, enterprise proposal framing, UI/UX mockup guidance, backend API contracts, ML handoff, constraints, acceptance criteria, and research validation gaps.
- [x] Track implementation gaps against the PRD in this roadmap while ML training is deferred.
- [x] Link PRD from `README.md` and `.docs/Orca_AGENTS.md`.
- [x] Start Next.js dashboard foundation with shadcn `dashboard-01` block, shadcn chart component, white dashboard shell, route optimizer, shipment detail, carbon analytics, and hub analytics MVP screens.
- [ ] Upgrade Next.js from `14.2.3` to a patched release before demo publication, then rerun `pnpm build`.
- [ ] Replace internal SVG map adapter with real MapCN MapLibre components after route geometry contract is finalized.
- [ ] Add SWR polling browser client for live dashboard row updates.
- [ ] Keep the PRD updated when UI flow, API contract, security boundary, or ML output changes.

### MVP Implementation Gap Tracker

Assumption: production ML integration is deferred while the ML role trains and registers the final model.
Frontend visual direction must stay close to the official shadcn `dashboard-01` block with monochrome shadcn theme.

| No | Gap | Area | Priority | Status | Completion Criteria |
|---|---|---|---|---|---|
| 1 | Next.js major upgrade | Frontend | High | Done | Upgrade to `next@16.2.6`, React 19, approve required `sharp` build, set Turbopack root, then rerun `pnpm build` |
| 2 | Real MapCN integration | Frontend | High | Done | MapCN MapLibre component installed, route and hub maps use `Map`, `MapRoute`, and `MapMarker` |
| 3 | Route geometry API | Backend | High | Done | `/optimize/route` returns `route_geometry.coordinates` per Pareto solution |
| 4 | SWR polling browser client | Frontend | High | Done | UI connects to engine SWR polling and patches dashboard risk rows |
| 5 | Shipment event history | Backend | High | Done | `shipment_events` table, engine insert, API endpoint, and shipment detail timeline are implemented |
| 6 | Alert management page | Frontend | Medium | Done | `/alerts` page includes filter, status, intervention, and alert history table |
| 7 | Settings page | Frontend | Medium | Done | `/settings` shows API base, token presence, polling interval, and SWR polling status |
| 8 | Carbon export | Frontend | Medium | Done | Carbon dashboard can export CSV |
| 9 | Hub detail panel | Frontend | Medium | Done | Selecting a hub opens a detail panel with dwell, inbound, delay rate, and affected shipment placeholder |
| 10 | Backend API contract tests | Backend | High | Done | Added tests for public token and internal token boundaries |
| 11 | Redis to SWR polling integration test | Backend | High | Pending | Requires live Redis, database, and engine process; keep for integration test phase |
| 12 | Recharts v3 upgrade | Frontend | Low | Done | Upgraded to `recharts@3.8.1` and patched shadcn chart tooltip and legend types |

### Deferred ML Work

| No | Item | Owner | Status | Needed Output |
|---|---|---|---|---|
| 1 | Train calibrated delay model | ML | Deferred | Registered MLflow production model |
| 2 | Validate feature parity | ML and Backend | Deferred | Same feature columns for training and inference |
| 3 | Generate real SHAP values | ML | Deferred | Contribution list consumable by shipment detail UI |
| 4 | Calibrate risk thresholds | ML and Product | Deferred | Low, medium, high risk boundary |
| 5 | Produce model card | ML | Deferred | Dataset, metrics, limitations, drift risks |

---

## Day 1: Infrastructure, Monorepo, and Data Pipeline

**Objective**: Stand up the full Docker stack, scaffold all three service skeletons,
document manual Olist dataset placement, feature-engineer the dataset after it is placed,
and prepare the simulation stream.

**Exit Criteria**: `make infra-up` starts all infrastructure services cleanly,
`make build-features` produces `data/processed/train_features.parquet` and
`data/processed/test_features.parquet`, `make seed-db` populates PostgreSQL with
GLEC factors and 1,000 sample shipments, all three services start without errors.

---

### 1.1 Monorepo Structure and Docker Compose

- [ ] Initialize folder structure as defined in `AGENTS.md` under Folder Architecture
- [ ] Create `docker-compose.yml` at the **repo root** with the following services:

  **Infrastructure services** (no `ports:` mappings - internal only):
  - `postgres`: image `timescale/timescaledb:latest-pg15`, volumes for persistence and
    `./infra/init-db:/docker-entrypoint-initdb.d` mount for schema auto-init
  - `redis`: image `redis:7-alpine`

  **Application and tooling services** (with `ports:` mappings):
  - `mlflow`: image `ghcr.io/mlflow/mlflow:v2.13.0`, port `5001:5001`,
    command `mlflow server --host 0.0.0.0 --port 5001 --backend-store-uri /mlruns`,
    volume `./mlruns:/mlruns`
  - `orca-ai`: build from `./apps/orca-ai/Dockerfile`, port `8000:8000`,
    depends_on `postgres` and `redis` and `mlflow`
  - `orca-ai/subscriber`: build from `./apps/orca-ai/subscriber/Dockerfile`, port `9090:9090`,
    depends_on `postgres`, `redis`, and `orca-ai`
  - `orca-web`: build from `./apps/orca-web/Dockerfile`, port `3000:3000`,
    depends_on `orca-ai` and `orca-ai/subscriber`

  All services share network `orca-net` (bridge driver, defined under `networks:` at bottom of file).
  The compose file must use Docker Compose v2 format (no `version:` key at the top).

  ```yaml
  # docker-compose.yml (v2 format - no version key)
  services:
    postgres:
      image: timescale/timescaledb:latest-pg15
      environment:
        POSTGRES_USER: orca
        POSTGRES_PASSWORD: orca_pass
        POSTGRES_DB: orca_db
      volumes:
        - postgres_data:/var/lib/postgresql/data
        - ./infra/init-db:/docker-entrypoint-initdb.d
      networks: [orca-net]
      # No ports: - not accessible from host, only within Docker network
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U orca -d orca_db"]
        interval: 10s
        timeout: 5s
        retries: 5

    redis:
      image: redis:7-alpine
      networks: [orca-net]
      # No ports: - not accessible from host, only within Docker network
      healthcheck:
        test: ["CMD", "redis-cli", "ping"]
        interval: 10s
        timeout: 5s
        retries: 5

    mlflow:
      image: ghcr.io/mlflow/mlflow:v2.13.0
      command: mlflow server --host 0.0.0.0 --port 5001 --backend-store-uri /mlruns
      ports: ["5001:5001"]
      volumes: ["./mlruns:/mlruns"]
      networks: [orca-net]

    orca-ai:
      build: ./apps/orca-ai
      ports: ["8000:8000"]
      env_file: ./.env
      depends_on:
        postgres: {condition: service_healthy}
        redis: {condition: service_healthy}
        mlflow: {condition: service_started}
      networks: [orca-net]

    orca-ai/subscriber:
      build: ./apps/orca-ai/subscriber
      ports: ["9090:9090"]
      env_file: ./.env
      depends_on:
        postgres: {condition: service_healthy}
        redis: {condition: service_healthy}
        orca-ai: {condition: service_started}
      networks: [orca-net]

    orca-web:
      build: ./apps/orca-web
      ports: ["3000:3000"]
      env_file: ./.env
      depends_on:
        orca-ai: {condition: service_started}
        orca-ai/subscriber: {condition: service_started}
      networks: [orca-net]

  volumes:
    postgres_data:

  networks:
    orca-net:
      driver: bridge
  ```

- [ ] Write `infra/init-db/01_schema.sql` with the complete DDL from `AGENTS.md` Database Schema section
- [ ] Create `Makefile` with all commands from `AGENTS.md` Available Commands
- [ ] Verify `make infra-up` (which starts only postgres, redis, mlflow) starts cleanly
- [ ] Verify `SELECT COUNT(*) FROM glec_emission_factors` returns 5 after startup

### 1.2 orca-ai Python Project Initialization

- [ ] Create `apps/orca-ai/pyproject.toml` for `uv` with dependencies:
  `fastapi`, `uvicorn[standard]`, `pydantic-settings`, `lightgbm>=4`, `pymoo>=0.6`,
  `scikit-learn>=1.5`, `mlflow>=2`, `asyncpg`, `redis[asyncio]>=5`, `httpx`,
  `pandas>=2`, `numpy<2`, `optuna>=3`, `shap>=0.45`, `osmnx>=1.9`, `python-dotenv`

  > Do NOT add `grpcio` or `grpcio-tools`. This project uses REST only.

- [x] Document all service variables in the repo-root `.env.example`; do not create per-service env examples
- [x] Add `PUBLIC_API_TOKEN`, `NEXT_PUBLIC_API_TOKEN`, `PUBLIC_RATE_LIMIT_PER_MINUTE`, `INTERNAL_API_TOKEN`, and `WS_ALLOWED_ORIGINS`
- [ ] Create `apps/orca-ai/core/config.py` as Pydantic `BaseSettings` loading all env vars
- [ ] Create `apps/orca-ai/main.py` with FastAPI app skeleton:
  - `lifespan` context manager with placeholder log lines for model loading and DB pool setup
  - `GET /` health check returning `{"status": "ok", "service": "orca-ai"}`
  - CORS middleware allowing `http://localhost:3000`
- [ ] Create `apps/orca-ai/Dockerfile`:
  - Base image `python:3.11-slim`
  - Install dependencies via `uv pip install --system .`
  - `CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`
- [ ] Verify `make dev-ai` starts uvicorn on port 8000 and `GET /` returns health check JSON

### 1.3 orca-ai/subscriber Go Project Initialization

- [x] Create `apps/orca-ai/subscriber/go.mod` with module path `orca/engine` and Go `>= 1.23`
- [ ] Add Go dependencies:
  - `github.com/go-redis/redis/v9`
  - `github.com/jackc/pgx/v5`
  - `github.com/google/uuid`
  - `github.com/gin-gonic/gin`

  > Do NOT add `google.golang.org/grpc`. All calls to orca-ai use standard REST API.

- [ ] Create `apps/orca-ai/subscriber/main.go` with startup stub that:
  - Reads env vars `REDIS_URL`, `DATABASE_URL`, `AI_SERVICE_URL` from environment
  - Connects to Redis (ping check) and PostgreSQL (ping check)
  - Prints `"[orca-ai/subscriber] Redis connected"` and `"[orca-ai/subscriber] PostgreSQL connected"`
  - Starts an HTTP server on `:WS_PORT` with a placeholder `GET /health` handler
- [ ] Create `apps/orca-ai/subscriber/Dockerfile`:
  - Multi-stage: `golang:1.23-alpine` builder → `alpine:latest` runner
  - `COPY go.mod go.sum ./` then `RUN go mod download`
  - `EXPOSE 9090`
- [ ] Verify `make dev-engine` starts the Go binary and logs successful connections

### 1.4 orca-web Next.js Project Initialization

- [ ] Scaffold with `pnpm create next-app apps/orca-web --typescript --tailwind --app --no-src-dir --import-alias "@/*"`
- [ ] Install dependencies with `pnpm add zustand swr recharts` and initialize shadcn/ui with `pnpm dlx shadcn@latest init` when the full UI phase begins
- [x] Document frontend variables in the repo-root `.env.example`:
  ```
  NEXT_PUBLIC_API_BASE=http://localhost:8000
  NEXT_PUBLIC_WS_BASE=ws://localhost:9090
  NEXT_PUBLIC_POLL_INTERVAL_MS=15000
  ```
- [ ] Create placeholder `app/page.tsx` that fetches `GET /shipments/active` via SWR
  and renders a `<pre>` block with the raw JSON (full UI comes in Day 4)
- [ ] Create `app/layout.tsx` with a nav bar linking to `/`, `/optimize`, `/carbon`, `/hubs`
- [ ] Create `apps/orca-web/Dockerfile`:
  - Multi-stage: `node:20-alpine` builder → `node:20-alpine` runner
  - `RUN corepack enable && pnpm install && pnpm build`
  - `CMD ["node", "server.js"]` (Next.js standalone output)
- [ ] Verify `make dev-web` starts Next.js on port 3000 without build errors

### 1.5 Olist Dataset Placement

- [ ] Document manual dataset placement in `data/raw/olist/README.md`
- [ ] User downloads Kaggle `olistbr/brazilian-ecommerce`, extracts CSV files, and places them in `data/raw/olist/`
- [ ] Verify all 9 Olist CSV files exist in `data/raw/olist/`

### 1.6 Feature Engineering Pipeline

- [ ] Write `apps/orca-ai/ml/features.py` with `build_feature_vector(row: dict) -> dict`:
  - Computes all 12 features defined in `AGENTS.md` ML Pipeline Conventions
  - `distance_km`: placeholder `30.0` with `# TODO: HERE Maps integration`
  - `weather_severity_score`: default `0.0` with `# TODO: Open-Meteo integration`
  - All cyclical encodings, hub zone label encoding, historical rates as specified
- [ ] Write `scripts/ingest/build_features.py`:
  - Loads all required Olist CSVs into pandas DataFrames
  - Merges on `order_id`, `customer_id`, `seller_id`, `product_id`, zip prefix
  - Filters to `order_status == 'delivered'` with non-null `order_delivered_customer_date`
  - Computes `is_delayed` target and all 12 features via `features.build_feature_vector`
  - Fits and saves `LabelEncoder` for hub zone to `data/processed/hub_zone_encoder.pkl`
  - Temporal 80/20 split by `order_purchase_timestamp`
  - Saves `train_features.parquet`, `test_features.parquet`, `simulation_stream.parquet`
  - Prints class balance of `is_delayed` for both splits
- [ ] Run `make build-features`; verify both parquet files exist with at least 80,000 rows total
- [ ] Verify `is_delayed` positive rate is between 5% and 40% in training split

### 1.7 Simulation Stream Preparation

- [ ] Write `scripts/simulate/stream_replay.py`:
  - Loads `data/processed/simulation_stream.parquet`
  - Iterates rows in `order_purchase_timestamp` order with configurable `REPLAY_SPEED_FACTOR=60`
  - Publishes each row as JSON to Redis channel `orca:events:shipments`
  - Prints a summary log every 100 events published
- [ ] Run `make simulate` for 30 seconds; verify events arrive in `redis-cli SUBSCRIBE orca:events:shipments`

### 1.8 Database Seeding

- [ ] Write `scripts/ingest/seed_db.py`:
  - Connects via `asyncpg` to `DATABASE_URL`
  - Inserts the first 1,000 rows from `simulation_stream.parquet` into `shipments` with `status = 'in_transit'`
  - Prints the count of successfully inserted rows
- [ ] Run `make seed-db`; verify `SELECT COUNT(*) FROM shipments` returns 1,000

### Day 1 Test Gate

- [ ] `make infra-up` starts postgres, redis, mlflow with all healthchecks green
- [ ] `SELECT COUNT(*) FROM glec_emission_factors` returns 5
- [ ] `make build-features` produces both parquet files without pandas warnings
- [ ] `make simulate` publishes events visible in redis-cli
- [ ] `make seed-db` inserts 1,000 rows into `shipments`
- [ ] `make dev-ai` starts on port 8000; `GET /` returns `{"status": "ok"}`
- [ ] `make dev-engine` starts and logs Redis and PostgreSQL connections
- [ ] `make dev-web` starts on port 3000 without TypeScript errors
- [ ] `redis-cli` from host cannot reach Redis (no port mapped); `psql` from host cannot reach PostgreSQL

---

## Day 2: ML Training, Python API Core

**Objective**: Train and register the LightGBM model in MLflow, implement all orca-ai
REST endpoints (shipments, optimize, carbon, hubs, alerts, internal predict), and verify
end-to-end predictions.

**Exit Criteria**: `GET /shipments/active` returns populated predictions after simulation,
`POST /optimize/route` returns a Pareto front within 5 seconds, `GET /analytics/carbon`
returns CO2 data, `POST /internal/predict` returns a valid prediction JSON.

---

### 2.1 LightGBM Model Training

- [ ] Write `apps/orca-ai/training/train_delay.py`:
  - Loads `train_features.parquet` and `hub_zone_encoder.pkl`
  - Starts an MLflow run under experiment `orca-delay-prediction`
  - Logs tags `dataset_version=olist-v1`, `feature_version=v1`
  - Runs Optuna 50-trial hyperparameter search (5-fold stratified CV, optimizing F1):
    - `num_leaves`: 20-150, `learning_rate`: 0.01-0.3, `n_estimators`: 100-1000,
      `max_depth`: 3-12, `min_child_samples`: 10-100
  - Trains final LightGBM with best params on full training set
  - Wraps with `CalibratedClassifierCV(method='sigmoid', cv=5)`
  - Logs model with `mlflow.sklearn.log_model`, registers as `delay-predictor` in `Staging`
  - Logs best params and calibration curve plot as MLflow artifacts
- [ ] Write `apps/orca-ai/training/evaluate.py`:
  - Loads `Staging` model from MLflow
  - Runs prediction on `test_features.parquet`
  - Prints F1, precision, recall, AUC-ROC, calibration error
  - If F1 > 0.75: promotes model to `Production`
  - Saves confusion matrix to `data/processed/evaluation_plot.png`
- [ ] Backend phase: leave `make train` and `make evaluate` as explicit modeling handoff placeholders
- [ ] Modeling phase owner later implements LightGBM training/evaluation and MLflow promotion

### 2.2 MLflow Model Loader

- [ ] Write `apps/orca-ai/core/mlflow_client.py`:
  - `load_production_model() -> tuple[model, LabelEncoder]` loading from `models:/delay-predictor/Production`
  - Module-level `_cached_model = None`, `_cached_version = None`
  - `get_model()` returning cached model, loading if not present
- [ ] Update `apps/orca-ai/main.py` lifespan to call `load_production_model()` at startup,
  store in `app.state.delay_model` and `app.state.label_encoder`
- [ ] Verify startup log shows: `LightGBM model loaded: delay-predictor vX (Production)`

### 2.3 Internal Predict Endpoint

This endpoint replaces the former gRPC `PredictDelay` RPC. It is the exclusive channel
through which orca-ai/subscriber requests predictions from orca-ai.

- [ ] Write `apps/orca-ai/api/routers/internal.py`:
  - `POST /internal/predict`: receives all 12 feature fields plus `remaining_hours_to_sla`
  - Calls `DelayPredictor.predict(features)` → `delay_probability`, `predicted_delay_hours`
  - Calls `compute_sla_risk(delay_probability, remaining_hours_to_sla)` → `sla_risk_score`
  - Returns: `{ shipment_id, delay_probability, sla_risk_score, predicted_delay_hours, model_version }`
  - This endpoint should not appear in the public Swagger UI (use `include_in_schema=False`)
- [ ] Write `apps/orca-ai/ml/delay_predictor.py` with class `DelayPredictor`:
  - `predict(features: dict) -> dict` using `app.state.delay_model`
  - Returns `{ delay_probability, predicted_delay_hours, model_version }`
- [ ] Write `apps/orca-ai/ml/sla_scorer.py` with `compute_sla_risk(delay_probability, remaining_hours)`:
  - Implements the exact formula from `AGENTS.md`
  - Returns `(score: float, urgency_level: str)`
- [ ] Verify `curl -X POST http://localhost:8000/internal/predict -H "Content-Type: application/json" -d '{...}'`
  returns a valid prediction within 200ms

### 2.4 Shipments API

- [ ] Write `apps/orca-ai/db/connection.py`: `asyncpg.create_pool` from `settings.DATABASE_URL`
- [ ] Write `apps/orca-ai/db/queries.py` with named async query functions:
  - `get_active_shipments(pool, limit, cursor, hub_id, min_risk)` - cursor-based
  - `get_latest_prediction(pool, shipment_id)`
  - `upsert_prediction_cache(pool, shipment_id, prediction_dict)`
- [ ] Write `apps/orca-ai/api/routers/shipments.py`:
  - `GET /shipments/active`: joins `shipments` with latest `shipment_predictions` per shipment,
    returns paginated list (cursor on `shipment.id`), runs prediction if no cached prediction in Redis
    and performs fallback prediction/carbon writes in batch when cache is missing
  - `GET /shipments/{shipment_id}/prediction`: returns detailed prediction with SHAP values
    computed via `shap.TreeExplainer` (top 5 features by absolute contribution)
- [ ] Wire all routers into `main.py`; verify `GET /docs` shows all endpoints

### 2.5 Carbon Calculator

- [ ] Write `apps/orca-ai/ml/carbon_calc.py`:
  - `load_emission_factors(db_pool) -> dict` - loads from `glec_emission_factors` table
  - `compute_co2(distance_km, load_weight_kg, vehicle_type, emission_factors) -> float`
    using the GLEC formula from `AGENTS.md`
  - `write_carbon_record(db_pool, ...)` - appends to `carbon_records` (skip if exists)
- [ ] Write `apps/orca-ai/api/routers/carbon.py`:
  - `GET /analytics/carbon`: aggregates `SUM(co2_kg)` by day and vehicle type,
    computes `vs_baseline_pct`, returns `glec_version: "3.0"`

### 2.6 HERE Maps and Open-Meteo Clients

- [ ] Write `apps/orca-ai/services/here_maps.py` with async class `HereMapsClient`:
  - Checks Redis cache (`orca:route:cache:{origin_zip}:{dest_zip}` TTL 24h) first
  - Calls HERE Maps REST API on cache miss
  - Fallback `{ distance_km: 30.0, travel_time_min: 60.0 }` with WARN log on any failure
- [ ] Write `apps/orca-ai/services/bmkg.py` with async class `Open-MeteoClient`:
  - Maps Open-Meteo precipitation descriptions to severity 0-3
  - Redis cache TTL 3h, fallback `0.0` on failure

### 2.7 NSGA-II Route Optimizer

- [ ] Write `apps/orca-ai/ml/route_optimizer.py`:
  - Class `RoutingProblem(Problem)` with 4 objectives and 1 SLA constraint (penalty `1e9`)
  - `optimize_route(stops, vehicle_type, load_weight_kg, origin_hub) -> list[dict]` async function
  - Labels fastest and lowest-emission Pareto solutions
- [ ] Write `apps/orca-ai/api/routers/optimize.py`:
  - `POST /optimize/route`: validates input, calls `optimize_route`, writes to `route_optimizations` table

### 2.8 Hub Analytics and Alerts Endpoints

- [ ] Write `apps/orca-ai/api/routers/hubs.py`:
  - `GET /analytics/hubs`: queries latest `hub_metrics`, computes congestion level:
    - `high`: `avg_dwell_time_min > 60` AND `delay_rate > 0.25`
    - `medium`: `avg_dwell_time_min > 40`
    - else `low`
  - Alert flag: `true` when congestion is `high`
- [ ] Write `apps/orca-ai/services/fonnte.py` with `FonnteClient.send_alert(phone, message) -> bool`
- [ ] Write `apps/orca-ai/api/routers/alerts.py`:
  - `POST /alerts/dispatch`: idempotency check in `alert_logs` (same `shipment_id` + `alert_type`
    within 2 hours), call `FonnteClient.send_alert` on new alert, insert to `alert_logs`
  - `GET /alerts/recent`: returns last 10 rows from `alert_logs` joined with `shipments.external_id`
- [ ] Add global exception handler in `main.py` returning `{"success": false, "error": "message"}`
- [x] Add public API token middleware and simple in-memory rate limiting for public REST endpoints
- [x] Keep CORS permissive for frontend development while requiring API token headers
- [ ] Verify `GET /docs` shows all endpoints with correct schemas

### Day 2 Test Gate

- [ ] Backend phase does not require training/evaluation; FastAPI uses fallback predictor when MLflow Production model is absent
- [ ] Modeling phase later requires `make train` and `make evaluate` to register/promote the model
- [ ] `POST /internal/predict` returns prediction JSON within 200ms
- [ ] `GET /shipments/active` returns at least 10 shipments with `sla_risk_score` after `make simulate`
- [ ] `POST /optimize/route` with 3-stop payload returns at least 2 Pareto solutions within 5 seconds
- [ ] `GET /analytics/carbon` returns non-zero `total_co2_kg` after seeding and simulation
- [ ] `GET /analytics/hubs` returns hub objects with `congestion_level` field
- [ ] Manual `POST /alerts/dispatch` delivers WhatsApp to `ALERT_RECIPIENT_PHONE`
- [ ] Second identical dispatch within 2 hours returns existing alert ID without re-sending

---

## Day 3: Python Subscriber, Alert System, API Completion

**Objective**: Implement the complete orca-ai/subscriber - Redis subscriber, REST client to orca-ai,
in-memory state machine, SWR polling hub, PostgreSQL writes, and alert threshold evaluation.
Verify the full prediction pipeline from Redis event to database.

**Exit Criteria**: orca-ai/subscriber logs prediction results for every simulated shipment event,
SWR polling broadcasts prediction updates to connected clients, and WhatsApp alerts are
triggered for high-risk shipments automatically.

---

### 3.1 Shared Go Models

- [x] Write `apps/orca-ai/subscriber/pkg/models/shipment.go` with Go structs:
  - `ShipmentEvent` - JSON-deserialized from Redis `orca:events:shipments` channel
  - `PredictRequest` - matches `POST /internal/predict` request body
  - `PredictResponse` - matches `POST /internal/predict` response data
  - `WSMessage` - `{ Type, ShipmentID, SLARiskScore, DelayProbability, ExternalID, Intervention }`

### 3.2 HTTP Client to orca-ai

This replaces gRPC. All prediction requests from orca-ai/subscriber go through standard HTTP.

- [x] Write `apps/orca-ai/subscriber/internal/ai_client/http_client.go`:
  - `NewAIClient(baseURL string) *AIClient` constructor (reads `AI_SERVICE_URL` env var)
  - `Predict(ctx context.Context, req PredictRequest) (*PredictResponse, error)`:
    - Marshals `req` to JSON, POSTs to `{AI_SERVICE_URL}/internal/predict`
    - Unmarshals response `data` field
    - Implements 3-retry with exponential backoff (100ms, 200ms, 400ms) on 5xx or network errors
    - Times out each attempt after 5 seconds
    - Logs `WARN` on retry, `ERROR` on final failure

### 3.3 Redis Subscriber and Prediction Loop

- [x] Write `apps/orca-ai/subscriber/internal/subscriber/redis_sub.go`:
  - `Subscribe(ctx, redisClient, aiClient, store, db, wsHub)` goroutine that:
    1. Subscribes to `orca:events:shipments`
    2. On each message: deserializes `ShipmentEvent` JSON
    3. Stores event in `ShipmentStore` (thread-safe, step 3.4)
    4. Builds `PredictRequest` from event fields, calls `aiClient.Predict`
    5. On success: calls `db.InsertPrediction` (step 3.5)
    6. Calls `wsHub.Broadcast` with `prediction_update` message (step 3.6)
    7. Evaluates `sla_risk_score >= ALERT_RISK_THRESHOLD`:
       - If true: calls `dispatcher.DispatchAlert` (step 3.7)
    8. Logs JSON: `{ timestamp, service: "orca-ai/subscriber", level, action: "prediction_stored", shipment_id, duration_ms }`

### 3.4 In-Memory Shipment Store

- [x] Write `apps/orca-ai/subscriber/internal/state/shipment_store.go`:
  - `ShipmentStore` struct with `sync.RWMutex` and `map[string]ShipmentState`
  - `Set(id string, state ShipmentState)`, `Get(id string)`, `Delete(id string)`, `All() []ShipmentState`
  - `ShipmentState` embeds `ShipmentEvent` plus `LastRiskScore`, `LastPredictedAt`

### 3.5 PostgreSQL Write Helpers

- [x] Write `apps/orca-ai/subscriber/internal/db/postgres.go`:
  - `NewPool(ctx, databaseURL) (*pgxpool.Pool, error)`
  - `InsertPrediction(ctx, pool, shipmentID, delayProb, riskScore, predictedDelayHrs, modelVersion) error`
    - inserts into `shipment_predictions` hypertable with `time = NOW()`
  - `InsertAlertLog(ctx, pool, shipmentID, alertType, riskScore, intervention) error`
  - `InsertHubMetric(ctx, pool, hubID, inboundVolume, avgDwellMin, delayRate) error`

### 3.6 SWR polling Hub

- [x] Write `apps/orca-ai/subscriber/internal/ws/hub.go`:
  - `Hub` struct managing API endpoints for frontend SWR polling clients.
  - `Register(conn)`, `Unregister(conn)`, `Broadcast(msg WSMessage)` methods
  - `Run()` goroutine that processes register, unregister, and broadcast channels
  - Connection handler: upgrade HTTP → SWR polling at `GET /ws`, register client, read loop
    (client-to-server messages are ignored for MVP)
  - On broadcast: marshal `WSMessage` to JSON, send to all registered clients;
    on send error, unregister the client
- [x] Update `apps/orca-ai/subscriber/main.go`:
  - Start `Hub.Run()` goroutine
  - Register `GET /ws` handler for SWR polling upgrades
  - Register `GET /health` handler returning `{"status": "ok"}` via Gin
  - Start all subscriber goroutines
  - Block with Gin `router.Run(":9090")`

### 3.7 Alert Dispatcher

- [x] Write `apps/orca-ai/subscriber/internal/dispatcher/alert.go`:
  - `DispatchAlert(ctx, aiClient, shipmentID, externalID, riskScore, intervention) error`:
    - POSTs to `{AI_SERVICE_URL}/alerts/dispatch` with the alert payload
    - On success: broadcasts SWR polling `alert` event via `wsHub.Broadcast`
    - Logs alert dispatch with `shipment_id` and `sla_risk_score`
  - Note: idempotency guard lives in orca-ai; orca-ai/subscriber always calls dispatch,
    orca-ai de-duplicates

### 3.8 Hub Metric Publisher

- [x] Write a goroutine in `main.go` that runs every 60 seconds:
  - Reads all shipments from `ShipmentStore`
  - Groups by `origin_hub_id`, counts active shipments per hub
  - Estimates `avg_dwell_time_min` from `(NOW - dispatched_at).Minutes()` per shipment
  - Calls `db.InsertHubMetric` for each hub
  - This feeds the `GET /analytics/hubs` endpoint with fresh time-series data
- [x] Use development-only permissive SWR polling origin checks; non-development uses `WS_ALLOWED_ORIGINS`

### 3.9 Integration Smoke Test

- [ ] Run `make infra-up`, manually place dataset, `make build-features`, and `make seed-db`; skip model training during backend-only phase
- [ ] Start `make dev-ai`, then `make dev-engine`, then `make simulate`
- [ ] Verify orca-ai/subscriber logs `action: "prediction_stored"` with `sla_risk_score` for each event
- [ ] Open `wscat -c ws://localhost:9090/ws` and verify `prediction_update` messages arrive
- [ ] Inject a high-risk shipment manually via `redis-cli PUBLISH orca:events:shipments '{...high-risk payload...}'`
  and verify a WhatsApp message arrives on `ALERT_RECIPIENT_PHONE`

### Day 3 Test Gate

- [ ] orca-ai/subscriber logs `prediction_stored` for every Redis event without panics or goroutine leaks
- [ ] `POST /internal/predict` is called by orca-ai/subscriber with correct payload (verify via orca-ai access log)
- [ ] Predictions are written to `shipment_predictions` hypertable (verify `SELECT COUNT(*) FROM shipment_predictions`)
- [ ] SWR polling clients receive `prediction_update` JSON within 1 second of Redis event
- [ ] High-risk event (risk >= 70) triggers `alert` SWR polling message and WhatsApp delivery
- [ ] `GET /analytics/hubs` returns at least one hub with non-null `avg_dwell_time_min`

---

## Day 4: Next.js Dashboard, SWR polling, Demo Scenarios

**Objective**: Build all four dashboard pages in Next.js 14 with real-time SWR polling updates,
implement the alert banner, record three demo scenarios, finalize documentation.

**Exit Criteria**: All four pages render correctly with live data during `make simulate`,
Demo Scenario 2 can be replayed end-to-end in under 5 minutes, and the submission
package is complete.

---

### 4.1 Zustand Store and Data Fetching Foundation

- [ ] Write `apps/orca-web/store/dashboard.ts` with Zustand store:
  - `shipments: Shipment[]` - active shipments list
  - `alerts: Alert[]` - recent alert queue for AlertBanner
  - `actions.setShipments(shipments)`, `actions.updateShipment(id, patch)`,
    `actions.pushAlert(alert)`, `actions.dismissAlert(id)`
- [ ] Write `apps/orca-web/hooks/useShipments.ts`:
  - Uses SWR with `refreshInterval: NEXT_PUBLIC_POLL_INTERVAL_MS` to poll `GET /shipments/active`
  - Updates Zustand store on success
  - Accepts optional `minRisk` and `hubId` filter params
- [ ] Write `apps/orca-web/hooks/useSWR polling.ts`:
  - Connects to `NEXT_PUBLIC_WS_BASE/ws` on mount, reconnects on disconnect (3-second delay)
  - On `prediction_update`: calls `store.actions.updateShipment` for the matching shipment
  - On `alert`: calls `store.actions.pushAlert`
  - Cleans up connection on unmount
- [ ] Write `apps/orca-web/hooks/useCarbon.ts`:
  - SWR fetch for `GET /analytics/carbon` with configurable `date_from` / `date_to` params

### 4.2 Shipments Dashboard Page (Main Page)

- [ ] Write `apps/orca-web/components/ShipmentTable.tsx`:
  - Table columns: `external_id`, `origin_hub_id`, `destination_zone`, `vehicle_type`,
    `sla_deadline` (formatted as local time), `sla_risk_score` (colored badge), `delay_probability` (%), `status`
  - Risk badge: green (0-39), yellow (40-69), red (70-100)
  - Pagination: 20 rows per page with next/previous buttons using cursor from API
  - Click row → modal with `GET /shipments/{id}/prediction` SHAP breakdown
- [ ] Write `apps/orca-web/app/page.tsx`:
  - Summary bar: total active, total at-risk (score >= 70), highest-risk `external_id` with score
  - Renders `ShipmentTable`
  - Mounts `useSWR polling` so real-time updates patch rows without full page refetch

### 4.3 Route Optimization Page

- [ ] Write `apps/orca-web/components/ParetoChart.tsx`:
  - Recharts `ScatterChart` - X: CO2 kg, Y: travel time minutes
  - Each point is one Pareto solution; tooltip shows all 4 objectives
  - Fastest point in blue, lowest-emission in green
  - Click point → sidebar with stop order for that solution
- [ ] Write `apps/orca-web/app/optimize/page.tsx`:
  - Form: origin hub dropdown, up to 5 stop inputs (lat/lng), vehicle type dropdown, load weight
  - On submit: `POST /optimize/route`, render `ParetoChart` with results
  - Show optimization time ms and SLA compliance status

### 4.4 Carbon Analytics Page

- [ ] Write `apps/orca-web/components/CarbonCard.tsx`:
  - Summary card: `total_co2_kg`, `avg_co2_per_shipment_kg`, `vs_baseline_pct` (green arrow if negative)
  - Footnote: `GLEC Framework v3.0 certified methodology`
- [ ] Write `apps/orca-web/app/carbon/page.tsx`:
  - Date range picker (default: last 7 days)
  - `CarbonCard` at top
  - Recharts `BarChart` for CO2 by day
  - Recharts `PieChart` for CO2 by vehicle type

### 4.5 Hub Congestion Page

- [ ] Write `apps/orca-web/components/HubHeatmap.tsx`:
  - Grid of hub cards from `GET /analytics/hubs`
  - Each card: hub name, inbound volume, avg dwell time, congestion badge
  - Card border: green (low), yellow (medium), red (high)
  - Cards with `alert: true` have pulsing red border animation (Tailwind `animate-pulse`)
- [ ] Write `apps/orca-web/app/hubs/page.tsx`:
  - SWR with `refreshInterval: 60000`
  - Renders `HubHeatmap`

### 4.6 Alert Banner

- [ ] Write `apps/orca-web/components/AlertBanner.tsx`:
  - Fixed top strip showing the 3 most recent alerts from Zustand store
  - Initial load: fetches `GET /alerts/recent` to seed the store
  - Each alert: `external_id`, risk score, intervention, timestamp
  - X button dismisses (client-side only via `store.actions.dismissAlert`)
  - Dismissed alerts are not re-shown on same browser session (store in `sessionStorage`)
- [ ] Add `AlertBanner` and `useSWR polling` init to `app/layout.tsx`

### 4.7 Demo Scenario Scripts

**Scenario 1** - Normal Operations:
- [ ] Write `scripts/simulate/demo_scenario_1.py`:
  - Seeds 50 low-risk shipments (`sla_risk_score < 40`, `weather_severity_score = 0.0`,
    `historical_hub_delay_rate = 0.05`)
  - Replays them over 60 seconds
  - Expected: dashboard shows all green rows, carbon analytics shows consistent daily CO2

**Scenario 2** - SLA Risk Escalation:
- [ ] Write `scripts/simulate/demo_scenario_2.py`:
  - Seeds 20 normal shipments, replays for 30 seconds
  - Then injects 5 high-risk shipments: `sla_deadline = NOW + 2h`,
    `historical_hub_delay_rate = 0.45`, `weather_severity_score = 3.0`
  - Expected: risk scores jump to red (70+), `AlertBanner` shows, WhatsApp delivered,
    dispatcher can click a row → SHAP breakdown → navigate to optimize → Pareto front returned

**Scenario 3** - Hub Congestion:
- [ ] Write `scripts/simulate/demo_scenario_3.py`:
  - Seeds hub metrics for `hub_jkt_barat` with `avg_dwell_time_min = 75.0`, `delay_rate = 0.35`
  - Expected: hubs page shows `hub_jkt_barat` with red border and alert flag,
    downstream shipments from this hub show elevated risk scores

### 4.8 End-to-End Integration Test

- [ ] Run `make infra-up`, manually place dataset, `make build-features`, and `make seed-db`; skip model training during backend-only phase
- [ ] Start all services: `make dev-ai`, `make dev-engine`, `make dev-web`
- [ ] Run `python scripts/simulate/demo_scenario_2.py` and verify:
  - Shipment table shows red risk badges within 30 seconds of injection
  - WhatsApp alert received on `ALERT_RECIPIENT_PHONE`
  - Route optimization page returns Pareto front for the high-risk hub
  - Carbon analytics shows non-zero total CO2
  - Hub congestion shows at least one non-low hub
- [ ] Verify no console errors in Chrome DevTools on any of the four pages

### 4.9 Documentation and Submission Artifacts

- [ ] Update `README.md` with accurate project description, tech stack (no gRPC),
  and installation instructions that work on a clean environment
- [ ] Write `.docs/architecture.md` with ASCII architecture diagram matching `AGENTS.md`
- [ ] Write `.docs/api-reference.md` with example `curl` commands for all public endpoints
  plus `POST /internal/predict`
- [ ] Write `.docs/datasets.md` listing Olist (CC BY-NC-SA 4.0), HERE Maps (free tier),
  Open-Meteo (public domain), GLEC (cited)
- [ ] Record a 3-5 minute screen recording of Demo Scenario 2 (simulation start → alert delivery)
- [ ] Verify with `git grep -rn "api_key\|API_KEY\|fonnte\|FONNTE" -- "*.py" "*.go" "*.tsx"`:
  no hardcoded secrets in any source file

### Day 4 Test Gate

- [ ] All four Next.js pages render without TypeScript errors or React console warnings
- [ ] `ShipmentTable` shows at least 10 rows with colored risk badges after running demo scenario
- [ ] `ParetoChart` renders at least 2 non-overlapping data points after form submit
- [ ] `CarbonCard` shows non-zero `total_co2_kg` with GLEC footnote
- [ ] `HubHeatmap` shows at least one hub with non-green badge after Scenario 3
- [ ] `AlertBanner` shows alerts and does not re-display a dismissed alert on the same session
- [ ] SWR polling delivers `prediction_update` to the browser (verify in DevTools → Network → WS)
- [ ] Demo Scenario 2 can be replayed from a clean database in under 5 minutes setup time
- [ ] WhatsApp alert received within 60 seconds of high-risk shipment injection
- [ ] `make test-ai` and `make test-engine` pass
- [ ] No hardcoded secrets in any committed file

---

## Appendix: Key Decisions

### Why REST instead of gRPC?

gRPC adds significant setup cost: proto files, code generation tooling (`make proto`),
separate ports, and debugging friction. For an MVP with a single prediction endpoint
(`/internal/predict`) called at ≤1 req/sec per shipment, standard HTTP POST over the
Docker bridge network is identical in performance and far faster to build with AI assistance.

### Why Next.js instead of Nuxt.js?

Next.js 14 with App Router has broader AI coding tool support, better TypeScript-native
tooling, and the same capability set (SSR, file-based routing, API routes). `shadcn/ui`
gives production-quality components without design time. The mental model is simpler for
React-familiar developers.

### Why no host port for Redis and PostgreSQL?

The simulation, training, and seeding scripts run from the host during development.
To support this without exposing Redis/Postgres, those scripts read `DATABASE_URL` and
`REDIS_URL` from `.env` and use `localhost:5432` / `localhost:6379` during local dev runs
(overriding the Docker internal service names). `uv` is the required Python runner for
all local Python commands. `pnpm` is the required frontend package manager. For future
modeling work in `make train` and `make evaluate`,
add a `DEV_DATABASE_URL=postgresql://orca:orca_pass@localhost:5432/orca_db` override
in the `.env.example` with clear comments.

Alternatively: expose only during development by adding a `docker-compose.dev.yml` override:
```yaml
services:
  postgres:
    ports: ["5432:5432"]
  redis:
    ports: ["6379:6379"]
```
And run `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` locally.
The production `docker-compose.yml` at root remains clean with no host port exposure.
