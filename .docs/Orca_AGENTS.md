---
name: orca_agent
description: This document is a guide for AI coding agents working on the ORCA (Optimized Routing & Carbon Analytics) project. Read the entire document before making any changes to this repository.
author: github.com/raihanpka
date: 2026-05-24
---

You are a `Senior Full-Stack AI/ML Engineer` for this project. Read this entire
document before making any modifications in this repository.

## Table of Contents

- [Project Identity](#project-identity)
- [System Architecture Overview](#system-architecture-overview)
- [Technology Stack](#technology-stack)
- [Folder Architecture](#folder-architecture)
- [Service Contracts and API Endpoints](#service-contracts-and-api-endpoints)
- [Database Schema](#database-schema)
- [ML Pipeline Conventions](#ml-pipeline-conventions)
- [Data Sources and Ingestion](#data-sources-and-ingestion)
- [Architecture Patterns](#architecture-patterns)
- [Naming Conventions](#naming-conventions)
- [Environment Configuration](#environment-configuration)
- [Available Commands](#available-commands)
- [Agent Constraints](#agent-constraints)
- [Completion Checklist](#completion-checklist)

---

## Project Identity

| Attribute | Value |
|---|---|
| **Name** | ORCA (Optimized Routing & Carbon Analytics) |
| **Description** | AI-powered logistics intelligence platform for Blibli: delivery delay prediction, multi-objective carbon-aware route optimization, real-time SLA risk scoring, and hub congestion analytics |
| **Architecture Style** | Microservices Monorepo - three service layers communicating via REST HTTP; real-time push via WebSocket |
| **Primary Interface** | REST APIs (orca-ai + orca-engine internal), WebSocket (orca-engine to orca-web), Next.js dashboard (orca-web) |
| **Target Users** | Blibli logistics operations managers, fleet dispatchers, sustainability officers |
| **Target Scale** | Prototype: 10,000 to 50,000 simulated shipments per demo run |
| **Competition Context** | AI Open Innovation Challenge 2026, Blibli Case 1: AI-Powered Green and Resilient Logistics Network |

---

## System Architecture Overview

ORCA is composed of three application services and three infrastructure services, all
running in a single Docker Compose v2 stack. Infrastructure services (PostgreSQL and Redis)
are network-isolated - they are not reachable from the host machine, only from other
Docker services within the `orca-net` bridge network.

```
orca-web (Next.js :3000)
        |
        | HTTP REST (polling via SWR)
        | WebSocket ws://orca-engine:9090/ws (real-time push)
        v
orca-ai (FastAPI :8000)          <-- ML inference, NSGA-II optimizer, carbon calculator
        |                              MLflow model registry, feature engineering
        | REST HTTP (internal Docker network, no gRPC)
        v
orca-engine (Go :9090)           <-- Real-time shipment state machine, streaming simulation,
                                       alert dispatcher, SLA countdown tracker, WebSocket hub
        |
        | Redis Pub/Sub (internal only, no host port exposure)
        v
Redis (:6379) - internal only    <-- Prediction cache, SLA score cache, pub/sub broker
        |
        v
PostgreSQL + TimescaleDB (:5432) <-- Shipment records, predictions, carbon records,
- internal only                      route optimizations, hub metrics, alert logs
        |
        v
MLflow Tracking Server (:5001)   <-- Experiment tracking, model registry, artifact storage
```

### Data Flow for a Standard Prediction

```
Simulation script (Python)
  -> publishes shipment event JSON to Redis channel: orca:events:shipments
  -> orca-engine (Go) subscribes via Redis Pub/Sub
  -> orca-engine updates in-memory ShipmentStore (sync.RWMutex)
  -> orca-engine calls orca-ai REST: POST /internal/predict  {feature fields}
  -> orca-ai loads LightGBM model from MLflow (cached at startup), runs inference
  -> orca-ai returns { delay_probability, sla_risk_score, predicted_delay_hours, model_version }
  -> orca-engine persists prediction to PostgreSQL (shipment_predictions hypertable)
  -> orca-engine evaluates alert threshold: if sla_risk_score >= ALERT_RISK_THRESHOLD:
      -> orca-engine calls orca-ai REST: POST /alerts/dispatch
      -> orca-ai sends WhatsApp via Fonnte API
      -> orca-engine broadcasts WebSocket event: { type: "alert", shipment_id, sla_risk_score }
  -> orca-engine broadcasts WebSocket event: { type: "prediction_update", shipment_id, sla_risk_score }
  -> orca-web (Next.js) receives WebSocket message, updates Zustand store (no page reload)
  -> orca-web also polls GET /shipments/active every NEXT_PUBLIC_POLL_INTERVAL_MS as fallback
```

### Docker Network Isolation

```yaml
# All services share orca-net (bridge)
# Redis and PostgreSQL have NO host port mappings - internal only
# MLflow, orca-ai, orca-engine, orca-web expose ports to host for development

networks:
  orca-net:
    driver: bridge

services:
  postgres:  # No ports: key - host cannot reach 5432 directly
  redis:     # No ports: key - host cannot reach 6379 directly
  orca-ai:   # ports: ["8000:8000"]
  orca-engine: # ports: ["9090:9090"]
  orca-web:  # ports: ["3000:3000"]
  mlflow:    # ports: ["5001:5001"]
```

---

## Technology Stack

### Service: orca-ai (Python FastAPI)

| Technology | Version | Purpose |
|---|---|---|
| Python | >= 3.11 | Runtime |
| FastAPI | 0.111.x | REST API framework |
| Uvicorn | latest | ASGI server |
| Pydantic | v2 | Request/response validation and settings |
| LightGBM | 4.x | Delay prediction model |
| pymoo | 0.6.x | NSGA-II multi-objective route optimization |
| scikit-learn | 1.5.x | CalibratedClassifierCV, preprocessing, metrics |
| MLflow | 2.x | Model registry, experiment tracking |
| asyncpg | latest | Async PostgreSQL driver |
| redis-py | 5.x | Redis client (async mode) |
| httpx | latest | Async HTTP client for HERE Maps, BMKG, and orca-engine internal calls |
| pandas | 2.x | Data manipulation and feature engineering |
| uv | latest | Python dependency management and command runner |
| numpy | 1.26.x | Numerical operations |
| optuna | 3.x | Hyperparameter optimization for LightGBM |
| shap | 0.45.x | SHAP feature importance for model explainability |
| OSMnx | 1.9.x | OpenStreetMap road network for routing graph |
| python-dotenv | latest | Environment variable loading |

> **No gRPC dependencies.** `grpcio` and `grpcio-tools` are not used. All inter-service
> communication is standard REST HTTP over the Docker bridge network.

### Service: orca-engine (Go)

| Technology | Version | Purpose |
|---|---|---|
| Go | >= 1.23 | Runtime |
| go-redis/redis | v9 | Redis client, pub/sub subscription |
| jackc/pgx | v5 | PostgreSQL async driver |
| google/uuid | latest | UUID generation for shipment IDs |
| gorilla/websocket | latest | WebSocket server for dashboard real-time push |
| gin | 1.11.0 | HTTP server/router for orca-engine health and WebSocket endpoints |

> **No gRPC dependencies.** `google.golang.org/grpc` is not used. orca-engine calls
> orca-ai via HTTP POST to `/internal/predict`.

### Service: orca-web (Next.js)

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 14+ (App Router) | React SSR/SSG framework |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Utility-first styling |
| shadcn/ui | latest | Pre-built Radix UI component library |
| Recharts | latest | Pareto front chart, carbon trend charts |
| Zustand | 4.x | Lightweight state management |
| SWR | 2.x | Data fetching with polling and revalidation |
| pnpm | >= 9 | Frontend package manager and dev runtime |

> **No Bun for package management.** The frontend uses `pnpm` only. Do not add
> `bun.lockb`, Bun-specific Docker stages, or Bun commands.
>
> **No Nuxt.js or Vue.** The frontend is Next.js 14 with the App Router. Vue-specific
> concepts (composables, Pinia, `.vue` files) do not apply.

### Infrastructure

| Technology | Version | Purpose |
|---|---|---|
| PostgreSQL | >= 15 | Primary relational database |
| TimescaleDB | 2.x | Time-series extension for PostgreSQL |
| Redis | 7.x | Cache, pub/sub, SLA score TTL store |
| MLflow Tracking Server | 2.x | Model registry and experiment UI |
| Docker Compose | v2 | Multi-service orchestration (file at repo root: `docker-compose.yml`) |

---

## Folder Architecture

```
orca/
├── docker-compose.yml              # Single compose file at repo root (all services + infra)
├── Makefile
├── .env.example                    # Combined env example for all services
│
├── apps/
│   ├── orca-ai/                    # Python FastAPI ML inference server
│   │   ├── main.py                 # FastAPI app entry point with lifespan
│   │   ├── pyproject.toml          # Python dependencies (no grpcio)
│   │   ├── Dockerfile
│   │   ├── api/
│   │   │   ├── routers/
│   │   │   │   ├── shipments.py    # GET /shipments/active, GET /shipments/{id}/prediction
│   │   │   │   ├── optimize.py     # POST /optimize/route
│   │   │   │   ├── carbon.py       # GET /analytics/carbon
│   │   │   │   ├── hubs.py         # GET /analytics/hubs
│   │   │   │   ├── alerts.py       # POST /alerts/dispatch, GET /alerts/recent
│   │   │   │   └── internal.py     # POST /internal/predict  (called by orca-engine only)
│   │   │   └── schemas/
│   │   │       ├── shipment.py     # Pydantic models for shipment data
│   │   │       ├── prediction.py   # Pydantic models for ML outputs
│   │   │       └── optimize.py     # Pydantic models for route optimization
│   │   ├── ml/
│   │   │   ├── delay_predictor.py  # LightGBM model wrapper class
│   │   │   ├── sla_scorer.py       # SLA risk score computation
│   │   │   ├── carbon_calc.py      # GLEC Framework carbon footprint calculator
│   │   │   ├── route_optimizer.py  # NSGA-II via pymoo wrapper
│   │   │   └── features.py         # Feature engineering pipeline (shared: training + inference)
│   │   ├── training/
│   │   │   ├── train_delay.py      # LightGBM training script with MLflow logging
│   │   │   └── evaluate.py         # Evaluation metrics and calibration check
│   │   ├── db/
│   │   │   ├── connection.py       # asyncpg pool setup
│   │   │   └── queries.py          # Named query functions
│   │   ├── services/
│   │   │   ├── here_maps.py        # HERE Maps API client (async, with fallback)
│   │   │   ├── bmkg.py             # BMKG weather API client (async, with fallback)
│   │   │   └── fonnte.py           # WhatsApp alert via Fonnte API
│   │   └── core/
│   │       ├── config.py           # Pydantic settings (loads .env)
│   │       └── mlflow_client.py    # MLflow model loader with startup caching
│   │
│   ├── orca-engine/                # Go real-time engine
│   │   ├── main.go                 # HTTP + WebSocket server on :9090
│   │   ├── go.mod                  # No google.golang.org/grpc dependency
│   │   ├── Dockerfile
│   │   └── internal/
│   │       ├── state/
│   │       │   └── shipment_store.go  # In-memory shipment state map (sync.RWMutex)
│   │       ├── subscriber/
│   │       │   └── redis_sub.go       # Redis channel subscriber
│   │       ├── dispatcher/
│   │       │   └── alert.go           # Alert threshold evaluation and dispatch
│   │       ├── ai_client/
│   │       │   └── http_client.go     # HTTP REST client to orca-ai /internal/predict
│   │       ├── db/
│   │       │   └── postgres.go        # pgx pool and write helpers
│   │       └── ws/
│   │           └── hub.go             # WebSocket hub for dashboard real-time push
│   │
│   └── orca-web/                   # Next.js 14 App Router frontend
│       ├── package.json
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── Dockerfile
│       ├── app/
│       │   ├── layout.tsx          # Root layout - includes AlertBanner, nav
│       │   ├── page.tsx            # / - Active shipments SLA risk table
│       │   ├── optimize/
│       │   │   └── page.tsx        # /optimize - Route optimization Pareto chart
│       │   ├── carbon/
│       │   │   └── page.tsx        # /carbon - Carbon footprint analytics
│       │   └── hubs/
│       │       └── page.tsx        # /hubs - Hub congestion heatmap
│       ├── components/
│       │   ├── ShipmentTable.tsx   # Active shipments with SLA risk score badges
│       │   ├── ParetoChart.tsx     # Recharts scatter Pareto front visualization
│       │   ├── CarbonCard.tsx      # CO2 summary card with GLEC footnote
│       │   ├── HubHeatmap.tsx      # Hub status grid with congestion color coding
│       │   └── AlertBanner.tsx     # Fixed top banner - real-time alert strip
│       ├── hooks/
│       │   ├── useShipments.ts     # SWR polling for active shipments
│       │   ├── useCarbon.ts        # SWR fetching for carbon analytics
│       │   └── useWebSocket.ts     # WebSocket connection and message handler
│       └── store/
│           └── dashboard.ts        # Zustand store for shared dashboard state
│
├── data/
│   ├── raw/                        # Downloaded datasets (gitignored)
│   │   ├── olist/                  # Olist e-commerce CSV files
│   │   └── glec_emission_factors.csv
│   ├── processed/                  # Feature-engineered parquet files (gitignored)
│   │   ├── train_features.parquet
│   │   ├── test_features.parquet
│   │   └── simulation_stream.parquet
│   └── templates/
│       └── jakarta_graph.pkl       # OSMnx graph, cached after first download
│
├── scripts/
│   ├── ingest/
│   │   ├── download_olist.py       # Downloads Olist dataset from Kaggle API
│   │   ├── build_features.py       # Full feature engineering pipeline
│   │   └── seed_db.py              # Seeds PostgreSQL with processed data
│   └── simulate/
│       ├── stream_replay.py        # Replays historical data as real-time events to Redis
│       ├── demo_scenario_1.py      # Normal operations (50 low-risk shipments)
│       ├── demo_scenario_2.py      # SLA risk escalation (injects 5 high-risk shipments)
│       └── demo_scenario_3.py      # Hub congestion (artificially high dwell time)
│
├── infra/
│   └── init-db/
│       └── 01_schema.sql           # TimescaleDB schema initialization (mounted into postgres container)
│
├── mlruns/                         # MLflow artifact storage (gitignored except structure)
└── .docs/
    ├── architecture.md
    ├── api-reference.md
    └── datasets.md
```

> **No `libs/rpc-contracts/` directory.** There are no `.proto` files. The `make proto`
> command does not exist. All service contracts are defined as Pydantic schemas in
> `apps/orca-ai/api/schemas/` and mirrored as Go structs in `apps/orca-engine/pkg/models/`.

---

## Service Contracts and API Endpoints

### orca-ai REST API (FastAPI :8000)

All responses use the envelope format:
```json
{
  "success": true,
  "data": {},
  "error": null,
  "timestamp": "2026-05-24T10:00:00Z"
}
```

#### GET /shipments/active

Returns all shipments currently in-transit with real-time SLA risk scores.

Query params: `?hub_id=hub_01&min_risk=50&limit=50&cursor=<uuid>`

Response `data`:
```json
{
  "shipments": [
    {
      "id": "uuid",
      "external_id": "BLB-20260524-001",
      "origin_hub_id": "hub_jkt_barat",
      "destination_zone": "Depok",
      "vehicle_type": "van_diesel",
      "sla_deadline": "2026-05-24T18:00:00Z",
      "dispatched_at": "2026-05-24T09:00:00Z",
      "delay_probability": 0.73,
      "sla_risk_score": 84.2,
      "predicted_delay_hours": 2.4,
      "co2_kg": 1.82,
      "status": "in_transit",
      "intervention_recommended": "reroute_via_toll"
    }
  ],
  "next_cursor": "uuid",
  "total_at_risk": 127
}
```

#### GET /shipments/{shipment_id}/prediction

Returns detailed prediction with SHAP feature contribution breakdown.

Response `data`:
```json
{
  "shipment_id": "uuid",
  "delay_probability": 0.73,
  "sla_risk_score": 84.2,
  "predicted_delay_hours": 2.4,
  "model_version": "lgbm-v1.3.0",
  "shap_contributions": [
    {"feature": "historical_hub_delay_rate", "value": 0.42, "contribution": 0.18},
    {"feature": "weather_severity_score", "value": 2.0, "contribution": 0.12}
  ],
  "intervention_options": [
    "reroute_via_toll",
    "notify_customer_proactively",
    "escalate_to_courier_manager"
  ]
}
```

#### POST /optimize/route

Runs NSGA-II optimization and returns a Pareto front of route alternatives.

Request body:
```json
{
  "vehicle_id": "VH-042",
  "vehicle_type": "van_diesel",
  "load_weight_kg": 450.0,
  "origin_hub_id": "hub_jkt_barat",
  "delivery_stops": [
    {
      "shipment_id": "uuid",
      "destination_lat": -6.2146,
      "destination_lng": 106.8451,
      "sla_deadline": "2026-05-24T18:00:00Z",
      "weight_kg": 45.0
    }
  ],
  "current_traffic_level": "heavy"
}
```

Response `data`:
```json
{
  "request_id": "opt-uuid",
  "vehicle_id": "VH-042",
  "pareto_solutions": [
    {
      "index": 0,
      "label": "fastest",
      "stops_order": ["uuid-3", "uuid-1", "uuid-2"],
      "travel_time_min": 87,
      "co2_kg": 3.24,
      "fuel_cost_idr": 28500,
      "sla_risk_score": 12.4
    },
    {
      "index": 1,
      "label": "lowest_emission",
      "stops_order": ["uuid-1", "uuid-3", "uuid-2"],
      "travel_time_min": 104,
      "co2_kg": 2.41,
      "fuel_cost_idr": 22800,
      "sla_risk_score": 28.7
    }
  ],
  "optimization_time_ms": 2340,
  "sla_compliance_guaranteed": true
}
```

#### GET /analytics/carbon

Returns carbon footprint aggregated by day and vehicle type.

Query params: `?date_from=2026-05-01&date_to=2026-05-24&group_by=day`

Response `data`:
```json
{
  "total_co2_kg": 4821.34,
  "avg_co2_per_shipment_kg": 1.94,
  "vs_baseline_pct": -11.2,
  "by_day": [
    {"date": "2026-05-24", "co2_kg": 412.3, "shipment_count": 213}
  ],
  "by_vehicle_type": [
    {"vehicle_type": "van_diesel", "co2_kg": 2410.5, "shipment_count": 1240}
  ],
  "glec_version": "3.0"
}
```

#### GET /analytics/hubs

Returns hub congestion metrics for the past N hours.

Query params: `?hours=6`

Response `data`:
```json
{
  "hubs": [
    {
      "hub_id": "hub_jkt_barat",
      "hub_name": "Jakarta Barat Hub",
      "current_inbound_volume": 342,
      "avg_dwell_time_min": 47.2,
      "delay_rate_7d": 0.18,
      "congestion_level": "high",
      "alert": true
    }
  ]
}
```

#### GET /alerts/recent

Returns the 10 most recent alert log entries. Used by `AlertBanner` in orca-web.

Response `data`:
```json
{
  "alerts": [
    {
      "id": "uuid",
      "shipment_id": "uuid",
      "external_id": "BLB-20260524-001",
      "alert_type": "sla_risk",
      "sla_risk_score": 84.2,
      "intervention": "reroute_via_toll",
      "created_at": "2026-05-24T10:00:00Z"
    }
  ]
}
```

#### POST /alerts/dispatch

Dispatches a WhatsApp alert for a high-risk shipment. Called by orca-engine.

Request body:
```json
{
  "shipment_id": "uuid",
  "alert_type": "sla_risk",
  "sla_risk_score": 84.2,
  "intervention": "reroute_via_toll",
  "recipient_phone": "628xxxxxxxxxx"
}
```

#### POST /internal/predict  _(orca-engine internal only)_

This endpoint is called exclusively by orca-engine over the Docker bridge network.
It is not exposed to orca-web or external clients. It replaces the former gRPC PredictDelay RPC.

Request body:
```json
{
  "shipment_id": "uuid",
  "distance_km": 28.4,
  "estimated_delivery_days": 2.0,
  "day_of_week": 3,
  "hour_of_day": 14,
  "hub_zone": "013",
  "weather_severity_score": 1.0,
  "historical_hub_delay_rate": 0.18,
  "historical_driver_rate": 0.87,
  "item_count": 3,
  "product_weight_g": 1400.0,
  "remaining_hours_to_sla": 6.5
}
```

Response `data`:
```json
{
  "shipment_id": "uuid",
  "delay_probability": 0.73,
  "sla_risk_score": 84.2,
  "predicted_delay_hours": 2.4,
  "model_version": "lgbm-v1.3.0"
}
```

### WebSocket Contract (orca-engine :9090)

The WebSocket endpoint is at `ws://orca-engine:9090/ws` (or `ws://localhost:9090/ws` from host).

orca-engine broadcasts JSON messages on two event types:

```json
{ "type": "prediction_update", "shipment_id": "uuid", "sla_risk_score": 84.2, "delay_probability": 0.73 }
```

```json
{ "type": "alert", "shipment_id": "uuid", "external_id": "BLB-20260524-001", "sla_risk_score": 84.2, "intervention": "reroute_via_toll" }
```

orca-web handles these in `hooks/useWebSocket.ts`. On `prediction_update`, it mutates
the Zustand dashboard store for the matching shipment. On `alert`, it pushes to the
alert queue consumed by `AlertBanner`.

---

## Database Schema

The database uses PostgreSQL 15 with the TimescaleDB extension. All DDL lives in
`infra/init-db/01_schema.sql` and runs automatically on first container start via the
`volumes` mount in `docker-compose.yml`.

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- GLEC emission factor reference table (seeded at startup)
CREATE TABLE IF NOT EXISTS glec_emission_factors (
  vehicle_type          VARCHAR(30) PRIMARY KEY,
  fuel_type             VARCHAR(20)  NOT NULL,
  emission_factor       DECIMAL(8,6) NOT NULL, -- kg CO2 per ton-km
  glec_version          VARCHAR(10)  NOT NULL DEFAULT '3.0',
  notes                 TEXT
);

INSERT INTO glec_emission_factors VALUES
  ('scooter_electric', 'electric', 0.025000, '3.0', 'Urban last-mile electric scooter'),
  ('van_diesel',       'diesel',   0.243000, '3.0', 'Diesel van < 3.5t GVW'),
  ('truck_lt35t',      'diesel',   0.218000, '3.0', 'Diesel truck < 3.5t GVW'),
  ('truck_35_75t',     'diesel',   0.178000, '3.0', 'Diesel truck 3.5 to 7.5t GVW'),
  ('truck_gt75t',      'diesel',   0.147000, '3.0', 'Diesel truck > 7.5t GVW')
ON CONFLICT DO NOTHING;

-- Core shipments table
CREATE TABLE IF NOT EXISTS shipments (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id          VARCHAR(100) UNIQUE,
  origin_hub_id        VARCHAR(50)  NOT NULL,
  destination_zone     VARCHAR(50),
  customer_lat         DECIMAL(9,6),
  customer_lng         DECIMAL(9,6),
  vehicle_type         VARCHAR(30)  NOT NULL REFERENCES glec_emission_factors(vehicle_type),
  load_weight_kg       DECIMAL(10,2),
  item_count           INT,
  sla_deadline         TIMESTAMPTZ  NOT NULL,
  dispatched_at        TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  status               VARCHAR(20)  NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'in_transit', 'delivered', 'failed')),
  distance_km          DECIMAL(8,2),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_hub ON shipments(origin_hub_id);
CREATE INDEX IF NOT EXISTS idx_shipments_sla ON shipments(sla_deadline) WHERE status = 'in_transit';

-- Time-series prediction records (hypertable)
CREATE TABLE IF NOT EXISTS shipment_predictions (
  time                 TIMESTAMPTZ  NOT NULL,
  shipment_id          UUID         NOT NULL REFERENCES shipments(id),
  delay_probability    DECIMAL(5,4) NOT NULL,
  sla_risk_score       DECIMAL(5,2) NOT NULL,
  predicted_delay_hrs  DECIMAL(6,2),
  model_version        VARCHAR(50),
  features_json        JSONB
);
SELECT create_hypertable('shipment_predictions', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_predictions_shipment ON shipment_predictions(shipment_id, time DESC);

-- Carbon records (one per shipment, append-only)
CREATE TABLE IF NOT EXISTS carbon_records (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id          UUID         NOT NULL UNIQUE REFERENCES shipments(id),
  route_distance_km    DECIMAL(8,2) NOT NULL,
  co2_kg               DECIMAL(8,4) NOT NULL,
  vehicle_type         VARCHAR(30)  NOT NULL,
  load_weight_ton      DECIMAL(8,4) NOT NULL,
  emission_factor      DECIMAL(8,6) NOT NULL,
  glec_version         VARCHAR(10)  NOT NULL DEFAULT '3.0',
  calculated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Route optimization Pareto front records
CREATE TABLE IF NOT EXISTS route_optimizations (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id           VARCHAR(100) NOT NULL,
  vehicle_id           VARCHAR(50),
  shipment_ids         UUID[]       NOT NULL,
  pareto_solutions     JSONB        NOT NULL,
  selected_index       INT,
  optimization_ms      INT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Hub metrics time-series (hypertable)
CREATE TABLE IF NOT EXISTS hub_metrics (
  time                 TIMESTAMPTZ  NOT NULL,
  hub_id               VARCHAR(50)  NOT NULL,
  inbound_volume       INT          NOT NULL DEFAULT 0,
  avg_dwell_time_min   DECIMAL(6,2),
  delay_rate           DECIMAL(5,4),
  active_shipments     INT          NOT NULL DEFAULT 0
);
SELECT create_hypertable('hub_metrics', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_hub_metrics_hub ON hub_metrics(hub_id, time DESC);

-- Alert logs (idempotency guard for WhatsApp dispatch)
CREATE TABLE IF NOT EXISTS alert_logs (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id          UUID         NOT NULL REFERENCES shipments(id),
  alert_type           VARCHAR(50)  NOT NULL,
  sla_risk_score       DECIMAL(5,2),
  intervention         VARCHAR(100),
  notified_via         TEXT[]       DEFAULT '{}',
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_logs_shipment ON alert_logs(shipment_id, created_at DESC);
```

---

## ML Pipeline Conventions

### Model Registry (MLflow)

All trained models must be registered in MLflow before being loaded by orca-ai.
The MLflow tracking server runs at `http://mlflow:5001` inside Docker (or `http://localhost:5001` from host).

- Experiment name: `orca-delay-prediction`
- Run tags: `{"dataset_version": "olist-v1", "feature_version": "v1"}`
- Registered model name: `delay-predictor`
- Model stages: `Staging` (after training), `Production` (after validation)

**Loading convention in orca-ai:**

```python
# In apps/orca-ai/core/mlflow_client.py
import mlflow.sklearn

def load_production_model():
    model_uri = "models:/delay-predictor/Production"
    model = mlflow.sklearn.load_model(model_uri)  # CalibratedClassifierCV wrapping LightGBM
    return model
```

The model must be loaded once at application startup and cached in `app.state`.

### Feature Engineering Contract

All features are computed in `apps/orca-ai/ml/features.py`. This is the single source
of truth for feature logic, shared between `training/train_delay.py` and the inference
path in `/internal/predict`.

**Feature vector (in order for LightGBM input):**

| Feature | Type | Description | Source |
|---|---|---|---|
| `distance_km` | float | Route distance origin to destination | HERE Maps API or 30.0 fallback |
| `estimated_delivery_days` | float | SLA window in days | Shipment record |
| `day_of_week_sin` | float | sin(2π·day/7) cyclical encoding | Derived from dispatched_at |
| `day_of_week_cos` | float | cos(2π·day/7) cyclical encoding | Derived from dispatched_at |
| `hour_of_day_sin` | float | sin(2π·hour/24) cyclical encoding | Derived from dispatched_at |
| `hour_of_day_cos` | float | cos(2π·hour/24) cyclical encoding | Derived from dispatched_at |
| `hub_zone_encoded` | int | Label-encoded hub zone (first 3 digits of zip) | LabelEncoder, fitted at training |
| `weather_severity_score` | float | 0=clear, 1=cloudy, 2=rain, 3=heavy | BMKG API with 0.0 fallback |
| `historical_hub_delay_rate` | float | 7-day rolling delay rate for hub | Computed from hub_metrics table |
| `historical_driver_rate` | float | Historical on-time completion rate | Simulated from Olist seller data |
| `item_count` | int | Number of items in shipment | Shipment record |
| `product_weight_g` | float | Total shipment weight in grams | Shipment record (kg × 1000) |

### SLA Risk Score Formula

Computed in `apps/orca-ai/ml/sla_scorer.py`.

```python
def compute_sla_risk(delay_probability: float, remaining_hours: float) -> float:
    if remaining_hours > 24:
        urgency_weight = 0.5
    elif remaining_hours > 8:
        urgency_weight = 0.8
    else:
        urgency_weight = 1.2
    raw_score = delay_probability * urgency_weight * 100
    return min(raw_score, 100.0)
```

Alert threshold: `sla_risk_score >= 70.0` (configurable via `ALERT_RISK_THRESHOLD` env var).

Urgency levels: `"low"` (0-39), `"medium"` (40-69), `"high"` (70-100).

### Carbon Calculation Formula

```python
def compute_co2(distance_km, load_weight_kg, vehicle_type, emission_factors) -> float:
    load_weight_ton = load_weight_kg / 1000.0
    factor = emission_factors[vehicle_type]  # kg CO2 per ton-km from DB
    return distance_km * load_weight_ton * factor
```

### NSGA-II Optimizer

```python
from pymoo.algorithms.moo.nsga2 import NSGA2
from pymoo.core.problem import Problem

class RoutingProblem(Problem):
    # n_var: number of delivery stops (permutation)
    # n_obj: 4 (travel_time_min, fuel_cost_idr, co2_kg, avg_sla_risk)
    # n_constr: 1 (SLA compliance hard constraint via penalty 1e9)
    pass
```

Population size: `100`, generations: `200` for full runs.
When `DEMO_MODE=true`: population `50`, generations `100` (target < 5s response time).

---

## Data Sources and Ingestion

### Primary Dataset: Olist Brazilian E-Commerce

**Manual placement:** Download Kaggle `olistbr/brazilian-ecommerce` manually and extract
all CSV files into `data/raw/olist/`. The helper script `scripts/ingest/download_olist.py`
exists only as an optional convenience when Kaggle credentials are configured.

| Olist CSV File | ORCA Concept | Key Columns |
|---|---|---|
| `olist_orders_dataset.csv` | Shipment records | `order_id`, `order_status`, timestamps |
| `olist_order_items_dataset.csv` | Shipment items | `order_id`, `seller_id`, `product_id` |
| `olist_customers_dataset.csv` | Delivery destinations | `customer_id`, `customer_zip_code_prefix`, city |
| `olist_sellers_dataset.csv` | Origin hubs | `seller_id`, `seller_zip_code_prefix`, city |
| `olist_geolocation_dataset.csv` | Lat/lng lookup | zip prefix, lat, lng |
| `olist_products_dataset.csv` | Item weight | `product_id`, `product_weight_g` |

**Delay label:** `is_delayed = int((delivered_date - estimated_date).total_seconds() / 3600 > 0)`

**Hub zone:** first 3 digits of `seller_zip_code_prefix` → ~20-30 distinct zones.

### External APIs

- **HERE Maps** (free tier, 250K req/month): route distance + travel time; cache in Redis TTL 24h
- **BMKG Open Data** (no key): weather severity per city; cache in Redis TTL 3h; fallback 0.0
- **OSMnx** (no key): Jakarta road network graph; cached at `data/templates/jakarta_graph.pkl`
- **Fonnte API**: WhatsApp message dispatch for SLA alerts; key in `FONNTE_API_KEY`

---

## Architecture Patterns

### 1. Feature Engineering is Centralized

`apps/orca-ai/ml/features.py` is the single source of truth. Training and inference
both import from this module. Never duplicate feature logic.

### 2. ML Model is Loaded Once at Startup

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.delay_model, app.state.label_encoder = load_production_model()
    app.state.db_pool = await asyncpg.create_pool(settings.DATABASE_URL)
    app.state.redis = await aioredis.from_url(settings.REDIS_URL)
    yield
```

Never call `mlflow.sklearn.load_model()` inside a request handler.

### 3. Go Engine Owns Real-Time State, Python Owns ML

orca-engine is the source of truth for live shipment status. orca-ai is the source
of truth for model predictions. orca-engine calls orca-ai via HTTP POST `/internal/predict`
on a 15-minute cycle per shipment, or immediately on new Redis events.

### 4. Fallback Mechanism for External APIs

When HERE Maps or BMKG is unavailable, return a logged fallback value rather than
propagating an error. Fallback: `distance_km = 30.0`, `weather_severity_score = 0.0`.
Log at WARN level with affected shipment ID. Never fail a request due to external API unavailability.

### 5. SLA Compliance is Always a Hard Constraint in NSGA-II

Constraint violation triggers penalty `1e9` added to all objectives. Never filter
solutions post-hoc. Let NSGA-II domination handle it.

### 6. Carbon Records Are Append-Only

Never UPDATE a `carbon_records` row. Check for existing record before insert; skip if found.

### 7. Alert Dispatch is Idempotent

Before calling Fonnte, check `alert_logs` for the same `(shipment_id, alert_type)` within
the past 2 hours. If found, return the existing alert ID without sending a new WhatsApp message.

### 8. Pagination is Always Cursor-Based

All list endpoints use `shipment.id` as the cursor. Never use offset-based pagination.

---

## Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Python module | snake_case | `delay_predictor.py` |
| Python class | PascalCase | `DelayPredictor` |
| Python function | snake_case | `compute_sla_risk` |
| FastAPI router prefix | kebab-case | `/optimize/route` |
| Go package | snake_case | `shipment_store` |
| Go struct | PascalCase | `ShipmentState` |
| Go function | PascalCase (exported) | `SubscribeToShipments` |
| Next.js component | PascalCase | `ParetoChart.tsx` |
| Next.js route | kebab-case dir | `app/carbon/page.tsx` |
| Next.js hook | camelCase with `use` | `useShipments.ts` |
| PostgreSQL table | snake_case | `shipment_predictions` |
| PostgreSQL index | `idx_{table}_{column}` | `idx_shipments_status` |
| Redis key | `orca:{domain}:{identifier}` | `orca:prediction:cache:{shipment_id}` |
| Redis channel | `orca:events:{type}` | `orca:events:shipments` |
| MLflow experiment | kebab-case | `orca-delay-prediction` |
| MLflow model | kebab-case | `delay-predictor` |
| Environment variable | UPPER_SNAKE_CASE | `ALERT_RISK_THRESHOLD` |
| Docker service name | kebab-case | `orca-ai`, `orca-engine`, `orca-web` |

---

## Environment Configuration

All service environment variables are documented in the repo-root `.env.example`.
Use one repo-root `.env` for Docker Compose and local development. Do not add
per-service `.env.example` files under `apps/`.

```env
APP_ENV=development
APP_PORT=8000
DEBUG=true

DATABASE_URL=postgresql://orca:orca_pass@postgres:5432/orca_db
DEV_DATABASE_URL=postgresql://orca:orca_pass@localhost:5432/orca_db
REDIS_URL=redis://redis:6379
DEV_REDIS_URL=redis://localhost:6379
PREDICTION_CACHE_TTL_SECONDS=900
INTERNAL_API_TOKEN=change_me_for_local_dev
PUBLIC_API_TOKEN=change_me_for_public_api
PUBLIC_RATE_LIMIT_PER_MINUTE=120

MLFLOW_TRACKING_URI=http://mlflow:5001
MLFLOW_MODEL_NAME=delay-predictor
MLFLOW_MODEL_STAGE=Production

AI_SERVICE_URL=http://orca-ai:8000
PREDICTION_INTERVAL_SECONDS=900
ALERT_RISK_THRESHOLD=70.0
WS_PORT=9090
WS_ALLOWED_ORIGINS=http://localhost:3000

NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_WS_BASE=ws://localhost:9090
NEXT_PUBLIC_POLL_INTERVAL_MS=15000
NEXT_PUBLIC_API_TOKEN=change_me_for_public_api

HERE_MAPS_API_KEY=
BMKG_API_BASE_URL=https://data.bmkg.go.id/DataMKG/MEWS/DigitalForecast
FONNTE_API_KEY=
FONNTE_API_URL=https://api.fonnte.com/send
ALERT_RECIPIENT_PHONE=

DEMO_MODE=true
NSGA2_POPULATION_SIZE=50
NSGA2_GENERATIONS=100

KAGGLE_USERNAME=
KAGGLE_KEY=
```

Inside the Compose stack, services reference each other by **service name**. All Compose
services use `env_file: ./.env`. Local scripts that run outside Docker may use the
`DEV_DATABASE_URL` and `DEV_REDIS_URL` overrides.

---

## Available Commands

```bash
# Infrastructure
make infra-up       # docker compose up -d postgres redis mlflow
make infra-down     # docker compose down
make dev            # docker compose up -d (all services)
make dev-down       # docker compose down

# Individual services (local, without Docker)
make dev-ai         # cd apps/orca-ai && uv run uvicorn main:app --reload --port 8000
make dev-engine     # go run ./apps/orca-engine/main.go
make dev-web        # cd apps/orca-web && pnpm dev

# Data pipeline
make download-data  # cd apps/orca-ai && uv run python ../../scripts/ingest/download_olist.py
make build-features # cd apps/orca-ai && uv run python ../../scripts/ingest/build_features.py
make seed-db        # cd apps/orca-ai && uv run python ../../scripts/ingest/seed_db.py

# ML training
make train          # placeholder handoff; cd apps/orca-ai && uv run python training/train_delay.py
make evaluate       # placeholder handoff; cd apps/orca-ai && uv run python training/evaluate.py

# Simulation
make simulate       # cd apps/orca-ai && uv run python ../../scripts/simulate/stream_replay.py

# Testing
make test           # Run all tests
make test-ai        # pytest apps/orca-ai/ --cov
make test-engine    # cd apps/orca-engine && go test ./...

# Cleanup
make clean          # Remove build artifacts, cached models, parquet files
```

> **No `make proto` command.** There are no gRPC stubs to generate.

---

## Agent Constraints

### Always Do

- Load the ML model from MLflow at application startup, never inside a request handler.
- Use the centralized `apps/orca-ai/ml/features.py` for all feature computation.
- Apply fallback (log at WARN) when HERE Maps or BMKG API is unavailable.
- Check `alert_logs` for duplicate alerts before dispatching to Fonnte API.
- Use TimescaleDB hypertables for `shipment_predictions` and `hub_metrics`.
- Cache HERE Maps responses in Redis: key `orca:route:cache:{origin_zip}:{dest_zip}` TTL 24h.
- Enforce SLA compliance as a hard constraint in NSGA-II via penalty function.
- Keep `carbon_records` append-only.
- Use `asyncpg` for all PostgreSQL operations in Python.
- Use cursor-based pagination for all list endpoints.
- Write structured logs as JSON: `timestamp`, `service`, `level`, `action`, `shipment_id`, `duration_ms`.
- Call orca-ai from orca-engine using the `AI_SERVICE_URL` env var, never a hardcoded address.

### Ask First

- Before adding a new Python dependency to `pyproject.toml`.
- Before adding a new Go module to `go.mod`.
- Before changing the feature vector order or adding new features without incrementing version.
- Before changing the TimescaleDB schema after Phase 1 is complete.
- Before changing the MLflow model stage promotion criteria.

### Never Do

- Never add gRPC dependencies (`grpcio`, `grpcio-tools`, `google.golang.org/grpc`). This project uses REST.
- Never use Bun for the frontend. Use `pnpm` for install, dev, and build.
- Never use raw `pip`, `python -m venv`, or ad-hoc virtualenv commands for project workflows. Use `uv`.
- Never add per-service `.env.example` files. Keep environment documentation centralized in root `.env.example`.
- Public REST endpoints must require `X-API-Token` from `PUBLIC_API_TOKEN`, while internal engine endpoints must require `X-Internal-Token`.
- Do not make WebSocket origin checks strict in development. In non-development environments, use `WS_ALLOWED_ORIGINS`.
- Never create or reference `.proto` files. No protobuf in this codebase.
- Never call HERE Maps or BMKG APIs synchronously. Always use `httpx.AsyncClient`.
- Never store `delay_probability` or `sla_risk_score` in the `shipments` table.
- Never run NSGA-II synchronously for more than 10 stops without `DEMO_MODE=true`.
- Never call `mlflow.sklearn.load_model()` more than once per process lifecycle.
- Never log raw API keys, phone numbers, or shipment payload contents.
- Never use offset-based pagination.
- Never hardcode GLEC emission factors. Always read from the database.
- Never use regular PostgreSQL tables for `shipment_predictions` or `hub_metrics`.
- Never dispatch a WhatsApp alert without the idempotency check in `alert_logs`.
- Never remove or overwrite carbon records.
- Never expose Redis or PostgreSQL ports in `docker-compose.yml` (no `ports:` key on those services).

---

## Completion Checklist

- [ ] `make infra-up` starts PostgreSQL, TimescaleDB, Redis, and MLflow without errors.
- [ ] `make seed-db` completes and `glec_emission_factors` table has 5 rows.
- [ ] Backend phase: `make train` and `make evaluate` are explicit placeholders for the modeling owner.
- [ ] Modeling phase: implemented training produces a registered MLflow model in `Production`.
- [ ] `make dev-ai` starts FastAPI on :8000 without errors; `GET /docs` shows all endpoints.
- [ ] `make dev-engine` starts Go engine, logs successful Redis and PostgreSQL connections.
- [ ] `make dev-web` starts Next.js on :3000 without TypeScript or build errors.
- [ ] `make simulate` replays events; dashboard shows live-updating shipment table.
- [ ] `GET /shipments/active` returns shipments with `sla_risk_score` populated.
- [ ] `POST /internal/predict` returns prediction within 200ms from orca-engine call.
- [ ] `POST /optimize/route` returns at least 2 Pareto solutions within 5 seconds.
- [ ] `GET /analytics/carbon` returns aggregated CO2 data with `glec_version: "3.0"`.
- [ ] WebSocket at `ws://localhost:9090/ws` delivers `prediction_update` events to orca-web.
- [ ] A shipment with `sla_risk_score >= 70` triggers a WhatsApp message to `ALERT_RECIPIENT_PHONE`.
- [ ] Pareto chart in orca-web renders correctly with at least 2 data points.
- [ ] Carbon summary card displays non-zero CO2 values after simulation runs.
- [ ] Redis and PostgreSQL are NOT reachable from the host machine (no `ports:` mappings).
- [ ] No hardcoded API keys, secrets, or phone numbers in any source file.
- [ ] All test commands pass: `make test-ai` and `make test-engine`.
