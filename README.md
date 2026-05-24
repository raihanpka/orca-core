# ORCA: Optimized Routing & Carbon Analytics

ORCA is a real-time logistics intelligence platform built for Blibli. It combines LightGBM delay prediction, NSGA-II multi-objective route optimization, and GLEC-certified carbon tracking into a unified dashboard. The system models SLA risk dynamically — not as a static snapshot — using a Go concurrency engine that listens to live shipment events and pushes risk scores to the dashboard via WebSocket.

## Foundation

* **Delay Prediction:** LightGBM with `CalibratedClassifierCV` outputs well-calibrated delay probabilities, not just binary classifications. SHAP values expose the exact feature contributions behind each prediction.
* **Multi-Objective Routing:** NSGA-II (pymoo) simultaneously minimizes travel time, fuel cost, CO₂ emissions, and SLA risk — treating SLA compliance as a hard constraint via penalty, not a post-hoc filter.
* **Carbon Accounting:** CO₂ calculations follow the GLEC Framework v3.0 (`CO₂ = distance × load_ton × emission_factor`), with factors sourced directly from the database at runtime.

## How It Works

1. **Simulation Replay:** A Python script publishes historical Olist shipment events to a Redis channel at configurable speed.
2. **Go Engine Subscribes:** The orca-engine picks up each event, calls orca-ai for a delay prediction via REST, stores results in a TimescaleDB hypertable, and broadcasts the updated risk score over WebSocket.
3. **Alerts Fire Automatically:** If `sla_risk_score ≥ 70`, the engine calls orca-ai to dispatch a WhatsApp alert via Fonnte — with an idempotency guard so no shipment gets double-notified.
4. **Dashboard Updates Live:** The Next.js frontend receives WebSocket pushes and patches individual rows without a full page refetch. SWR polling serves as a fallback.
5. **Route Optimization on Demand:** A dispatcher can submit a multi-stop delivery job; NSGA-II returns a Pareto front of route alternatives visualized as a scatter chart (time vs CO₂).

---

## Project Structure

```
orca/
├── docker-compose.yml        # All services, single file at repo root (Compose v2)
├── Makefile
├── apps/
│   ├── orca-ai/              # Python: FastAPI ML inference, NSGA-II optimizer, carbon calc
│   ├── orca-engine/          # Go: Real-time state machine, WebSocket hub, alert dispatcher
│   └── orca-web/             # Next.js 14: Live dashboard (App Router, Zustand, Recharts)
├── data/
│   ├── raw/olist/            # Downloaded Olist CSVs (gitignored)
│   └── processed/            # Feature-engineered parquet files (gitignored)
├── scripts/
│   ├── ingest/               # download_olist.py, build_features.py, seed_db.py
│   └── simulate/             # stream_replay.py, demo_scenario_1–3.py
├── infra/
│   └── init-db/01_schema.sql # TimescaleDB schema (auto-mounted on first container start)
└── mlruns/                   # MLflow artifact storage
```

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **ML & API** | Python 3.11, FastAPI, LightGBM, pymoo, SHAP, MLflow | Inference, optimization, experiment tracking |
| **Real-Time Engine** | Go 1.22, gorilla/websocket, pgx, go-redis | Event loop, WebSocket hub, alert dispatch |
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind, Recharts, Zustand, SWR | Live dashboard |
| **Databases** | PostgreSQL 15 + TimescaleDB, Redis 7 | Time-series predictions, pub/sub, caching |
| **Infrastructure** | Docker Compose v2, MLflow | Orchestration, model registry |
| **External APIs** | HERE Maps, BMKG, Fonnte (WhatsApp), Olist (Kaggle) | Distance, weather, alerts, training data |

> **No gRPC.** All inter-service communication is standard REST over the Docker bridge network.
> Redis and PostgreSQL have no host port mappings — only reachable within the Docker network.

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| **Docker** | >= 24 | Run all infrastructure services |
| **Docker Compose** | v2 (plugin) | Orchestrate the stack |
| **Python** | >= 3.11 | Run training and ingestion scripts locally |
| **Go** | >= 1.22 | Local orca-engine development |
| **uv** | latest | Python dependency manager and runner |
| **pnpm** | >= 9 | Frontend package manager |

```bash
docker --version      # >= 24
python3 --version     # >= 3.11
go version            # >= 1.22
uv --version
pnpm --version        # >= 9
```

## Installation

```bash
git clone https://github.com/raihanpka/orca.git
cd orca

# Install all dependencies
make install
```

This will install Python dependencies with `uv`, Go modules in `apps/orca-engine`, and pnpm packages in `apps/orca-web`.

## Configuration

```bash
cp apps/orca-ai/.env.example apps/orca-ai/.env
cp apps/orca-engine/.env.example apps/orca-engine/.env
cp apps/orca-web/.env.local.example apps/orca-web/.env.local
```

Edit `apps/orca-ai/.env` with your credentials:

```env
# External APIs
HERE_MAPS_API_KEY=your_here_maps_api_key
FONNTE_API_KEY=your_fonnte_api_key
ALERT_RECIPIENT_PHONE=628xxxxxxxxxx

# Kaggle (for dataset download only)
KAGGLE_USERNAME=your_kaggle_username
KAGGLE_KEY=your_kaggle_key

# ML config
ALERT_RISK_THRESHOLD=70.0
DEMO_MODE=false
```

All other variables (database URLs, Redis, MLflow) are pre-filled to match the Docker Compose service names and work out of the box.

## Running the Stack

### Full Stack via Docker Compose

```bash
# Start infrastructure (PostgreSQL, Redis, MLflow)
make infra-up

# Put the manually downloaded Olist CSV files in data/raw/olist/ first.
# See data/raw/olist/README.md for the required filenames.
make build-features
make seed-db

# Backend phase can run without training; orca-ai uses a fallback predictor.
# The modeling owner can later implement:
# make train
# make evaluate

# Start all application services
make dev
```

### Individual Services (Local Development)

```bash
make dev-ai       # FastAPI on http://localhost:8000
make dev-engine   # Go engine on http://localhost:9090
make dev-web      # Next.js on http://localhost:3000
```

### Run a Simulation

```bash
# Replay historical events to the live dashboard
make simulate

# Or run a specific demo scenario
cd apps/orca-ai && uv run python ../../scripts/simulate/demo_scenario_2.py
```

## Available Commands

| Command | Description |
|---|---|
| `make infra-up` | Start PostgreSQL, Redis, MLflow |
| `make infra-down` | Stop infrastructure services |
| `make dev` | Start all services via Docker Compose |
| `make download-data` | Optional Kaggle download helper; manual placement in `data/raw/olist/` is supported |
| `make build-features` | Run feature engineering pipeline |
| `make seed-db` | Seed PostgreSQL with 1,000 sample shipments |
| `make train` | Modeling handoff placeholder for LightGBM + MLflow |
| `make evaluate` | Modeling handoff placeholder for validation + promotion |
| `make simulate` | Replay simulation stream to Redis |
| `make test-ai` | Python pytest with coverage |
| `make test-engine` | Go test ./... |
| `make clean` | Remove build artifacts and cached models |

## API Reference

Once orca-ai is running, interactive docs are at:

- **Swagger UI:** http://localhost:8000/docs
- **MLflow UI:** http://localhost:5001

Key endpoints:

```bash
# Active shipments with SLA risk scores
GET  http://localhost:8000/shipments/active?min_risk=50

# Detailed prediction with SHAP breakdown
GET  http://localhost:8000/shipments/{id}/prediction

# Multi-objective route optimization (Pareto front)
POST http://localhost:8000/optimize/route

# Carbon footprint analytics (GLEC v3.0)
GET  http://localhost:8000/analytics/carbon?date_from=2026-05-01&date_to=2026-05-24

# Hub congestion metrics
GET  http://localhost:8000/analytics/hubs?hours=6

# Recent alerts (for dashboard banner)
GET  http://localhost:8000/alerts/recent
```

---

## Credits & Citations

**Supporting Literature:**

* **Yinzhu Quan and Zefang Liu (2025):** [InvAgent: A Large Language Model based Multi-Agent System for Inventory Management in Supply Chains](https://doi.org/10.48550/arXiv.2407.11384)
* **GLEC Framework v3.0 (2023):** [Smart Freight Centre — Global Logistics Emissions Council Framework](https://www.smartfreightcentre.org/en/our-programs/global-logistics-emissions-council/calculate-report-glec-framework/)
* **Olist Brazilian E-Commerce Dataset:** [Kaggle — olist/brazilian-ecommerce](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce) — CC BY-NC-SA 4.0

## License

This project is licensed under the `GNU General Public License v3.0`, see the [LICENSE](LICENSE) file for details.
