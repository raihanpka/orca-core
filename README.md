# ORCA: Optimized Routing & Carbon Analytics

ORCA is a real-time logistics intelligence platform built for Blibli Case. It combines LightGBM delay prediction, NSGA-II multi-objective route optimization, OSMnx road network routing for Jabodetabek, and GLEC-certified carbon tracking into a unified dashboard. The system models SLA risk dynamically using a Python script that injects live shipment events and exposes risk scores to the dashboard via SWR polling API.

## Foundation

* **Delay Prediction:** LightGBM with `CalibratedClassifierCV` outputs well-calibrated delay probabilities, not just binary classifications. SHAP values expose the exact feature contributions behind each prediction.
* **Multi-Objective Routing:** NSGA-II (pymoo) simultaneously minimizes travel time, fuel cost, CO2 emissions, and SLA risk, using OSMnx Jabodetabek graph distance from `data/processed/osmnx/jabodetabek.pkl`.
* **Carbon Accounting:** CO2 calculations follow the GLEC Framework v3.0 (`CO2 = distance * load_ton * emission_factor`), with factors sourced directly from the database at runtime.

## How It Works

1. **Simulation Replay:** A Python script `stream_data.py` publishes shipment events to PostgreSQL at configurable intervals.
2. **Backend Processing:** The FastAPI in `orca-ai` computes delay predictions using LightGBM and stores results in a TimescaleDB hypertable.
3. **Alerts Fire Automatically:** If `sla_risk_score >= 70`, the system automatically logs the intervention flag in the database.
4. **Dashboard Updates Live:** The Next.js frontend uses SWR polling to fetch active shipments and patch individual rows without a full page reload.
5. **Route Optimization on Demand:** A dispatcher can submit a multi-stop delivery job; NSGA-II returns a Pareto front of route alternatives visualized as a scatter chart.

## Project Structure

```
orca/
├── docker-compose.yml        # All services, single file at repo root (Compose v2)
├── Makefile
├── apps/
│   ├── orca-ai/              # Python: FastAPI ML inference, NSGA-II optimizer, carbon calc, subscriber
│   └── orca-web/             # Next.js 16.2.6: Live dashboard (App Router, shadcn, Zustand, Recharts, SWR)
├── data/
│   ├── raw/olist/            # Downloaded Olist CSVs (gitignored)
│   └── processed/            # Feature parquet files and OSMnx graph artifacts
├── scripts/
│   ├── ingest/               # build_features.py, seed_db.py, stream_data.py
├── infra/
│   └── init-db/01_schema.sql # TimescaleDB schema (auto-mounted on first container start)
└── mlruns/                   # MLflow artifact storage
```

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **ML & API** | Python 3.11, FastAPI, LightGBM, pymoo, SHAP, MLflow, OSMnx | Inference, optimization, road network distance, experiment tracking, pub/sub subscriber |
| **Frontend** | Next.js 16.2.6 (App Router), TypeScript, Tailwind, shadcn, React Leaflet, Zustand, Recharts, SWR | Live dashboard |
| **Databases** | PostgreSQL 15 + TimescaleDB, Redis 7 | Time-series predictions, pub/sub, caching |
| **Infrastructure** | Docker Compose v2, MLflow | Orchestration, model registry |
| **External APIs and Data** | OSMnx/OpenStreetMap, Open-Meteo, Fonnte (WhatsApp) | Routing graph, weather, alerts |

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| **Docker** | >= 24 | Run all infrastructure services |
| **Docker Compose** | v2 plugin | Orchestrate the stack |
| **Python** | >= 3.11 | Run training and ingestion scripts locally |
| **uv** | latest | Python dependency manager and runner |
| **pnpm** | >= 9 | Frontend package manager |

Download links:

- Docker Desktop: https://www.docker.com/products/docker-desktop/
- Python: https://www.python.org/downloads/
- uv: https://docs.astral.sh/uv/getting-started/installation/
- pnpm: https://pnpm.io/installation

```bash
docker --version      # >= 24
python3 --version     # >= 3.11
uv --version
pnpm --version        # >= 10
```

## Installation

```bash
git clone https://github.com/raihanpka/orca.git
cd orca

# Install all dependencies
make install
```

This will install Python dependencies with `uv` in `apps/orca-ai` and pnpm packages in `apps/orca-web`.

## Configuration

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# External APIs
FONNTE_API_KEY=your_fonnte_api_key
ALERT_RECIPIENT_PHONE=628xxxxxxxxxx
PUBLIC_API_TOKEN=change_this_for_frontend_and_postman
NEXT_PUBLIC_API_TOKEN=change_this_for_frontend_and_postman
INTERNAL_API_TOKEN=change_this_for_engine_internal_calls

# Kaggle (for dataset download only)
KAGGLE_USERNAME=your_kaggle_username
KAGGLE_KEY=your_kaggle_key

# ML config
ALERT_RISK_THRESHOLD=70.0
DEMO_MODE=false
OSMNX_GRAPH_PATH=../../data/processed/osmnx/jabodetabek.graphml
OSMNX_ENABLE_DOWNLOAD=false
```

All other variables (database URLs, Redis, MLflow) are pre-filled to match the Docker Compose service names and work out of the box.

## Running the Stack

### Full Stack via Docker Compose

```bash
# Build and start all services (PostgreSQL, Redis, MLflow, orca-ai, orca-worker, orca-web)
make up

# Seed the database
make seed-db

# View logs
make logs
```

### Individual Services (Local Development)

```bash
make dev-ai       # FastAPI on http://localhost:8000
make dev-web      # Next.js on http://localhost:3000
```

### Run a Simulation

```bash
# Replay historical events to the live dashboard
cd apps/orca-ai && uv run python ../../scripts/ingest/stream_data.py
```

## Available Commands

| Command | Description |
|---|---|
| `make install` | Install dependencies for backend and frontend |
| `make build` | Build Docker images for all services |
| `make up` | Start all services via Docker Compose |
| `make down` | Stop infrastructure services |
| `make restart` | Restart Docker Compose services |
| `make logs` | View logs for orca-ai and orca-web |
| `make dev-ai` | Run FastAPI server locally via uv |
| `make dev-web` | Run Next.js server locally via pnpm |
| `make test` | Run tests for backend and frontend |
| `make seed-db` | Seed PostgreSQL with sample shipments |
| `make clean` | Remove build artifacts and caches |

## API Reference

Once orca-ai is running, interactive docs are at:

- **Swagger UI:** http://localhost:8000/docs
- **MLflow UI:** http://localhost:5001

Key endpoints:

```bash
# Active shipments with SLA risk scores
curl -H "X-API-Token: $PUBLIC_API_TOKEN" \
  http://localhost:8000/shipments/active?min_risk=50

# Detailed prediction with SHAP breakdown
curl -H "X-API-Token: $PUBLIC_API_TOKEN" \
  http://localhost:8000/shipments/{id}/prediction

# Multi-objective route optimization (Pareto front)
POST http://localhost:8000/optimize/route with header X-API-Token

# Carbon footprint analytics (GLEC v3.0)
curl -H "X-API-Token: $PUBLIC_API_TOKEN" \
  "http://localhost:8000/analytics/carbon?date_from=2026-05-01&date_to=2026-05-24"

# Hub congestion metrics
curl -H "X-API-Token: $PUBLIC_API_TOKEN" \
  "http://localhost:8000/analytics/hubs?hours=6"

# Recent alerts (for dashboard banner)
curl -H "X-API-Token: $PUBLIC_API_TOKEN" \
  http://localhost:8000/alerts/recent
```

---

## Credits & Citations

**Product Requirements Document:**
* [Product Requirements Document](.docs/ORCA_PRD.md)

**Supporting Literature:**

* **Yinzhu Quan and Zefang Liu (2025):** [InvAgent: A Large Language Model based Multi-Agent System for Inventory Management in Supply Chains](https://doi.org/10.48550/arXiv.2407.11384)
* **GLEC Framework v3.0 (2023):** [Smart Freight Centre - Global Logistics Emissions Council Framework](https://www.smartfreightcentre.org/en/our-programs/global-logistics-emissions-council/calculate-report-glec-framework/)
* **Olist Brazilian E-Commerce Dataset:** [Kaggle - olist/brazilian-ecommerce](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce) - CC BY-NC-SA 4.0

## License

This project is licensed under the `GNU General Public License v3.0`, see the [LICENSE](LICENSE) file for details.
