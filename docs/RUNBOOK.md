# ORCA Platform — Runbook

How to run the entire ORCA platform from scratch.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker + Docker Compose | 20.10+ | [docker.com](https://docker.com) |
| Python | 3.11+ | [python.org](https://python.org) |
| uv | latest | `pip install uv` |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| pnpm | 9+ | `npm i -g pnpm` |
| make | any | Pre-installed on Linux/macOS; Windows: [GnuWin32](http://gnuwin32.sourceforge.net/packages/make.htm) or Git Bash |

---

## Quick Start (Docker — full stack)

```bash
# 1. Clone & configure
cp .env.example .env
# Edit .env with your API keys (FONNTE_API_KEY, TOMTOM_API_KEY, etc.)

# 2. Install dependencies
make install

# 3. Start everything
make up
# or: docker compose up -d --build

# Services:
#   postgres (TimescaleDB)  → localhost:5432
#   redis                   → localhost:6380
#   orca-ai (FastAPI)       → localhost:8000
#   orca-web (Next.js)      → localhost:3000
```

---

## Manual Start (Development — assuming model is already trained)

### Step 1: Infrastructure (DB + Redis)

```bash
docker compose up -d postgres redis
```

Wait ~10s for Postgres to initialize the schema (`infra/init-db/01_schema.sql`).

### Step 2: Seed Database (demo shipments)

```bash
make seed-db
# or manually:
cd apps/orca-ai && uv run python ../../scripts/ingest/seed_db.py
```

### Step 3: Start Backend (FastAPI + ML model)

```bash
make dev-ai
# or manually:
cd apps/orca-ai && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Verify the model loaded correctly:
```bash
curl http://localhost:8001/health
# → {"status": "Orca API and AI Engine are running", "model_version": "lgbm-v2", ...}
```

Swagger UI: http://localhost:8001/docs

### Step 4: Start Frontend (Next.js)

```bash
make dev-web
# or manually:
cd apps/orca-web && pnpm dev -- -p 3001
```

Open http://localhost:3001

### Step 5: Stream Demo Data (optional — triggers real-time predictions)

```bash
# From repo root (no make target yet, run manually):
cd apps/orca-ai && uv run python ../../scripts/ingest/stream_data.py
```

This replays shipment events through Redis pub/sub, triggering live ML predictions.

---

## Full ML Pipeline (train model from scratch)

Only needed if you don't have `data/processed/model.pkl` already.

```bash
cd apps/orca-ai

# 1. Place Olist CSVs in data/raw/olist/
#    Download from: https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce

# 2. Build feature parquets + encoder (stratified 80/20 split)
uv run python ../../scripts/ingest/build_features.py

# 3. Train LightGBM with Optuna HPO (~20 min with N_TRIALS=30)
#    Windows:
set N_TRIALS=30
uv run python training/train_delay.py
#    Linux/macOS:
# N_TRIALS=30 uv run python training/train_delay.py

# 4. Evaluate on held-out test set
uv run python training/evaluate.py

# 5. Export to native .lgbm format (optional, for portability)
uv run python ../../scripts/export_model.py

# 6. Segment analysis (optional)
uv run python training/evaluate_segments.py
```

**Output artifacts** (committed to git):
- `data/processed/model.pkl` — main model (CalibratedClassifierCV over LightGBM)
- `data/processed/model.lgbm` — portable native LightGBM booster
- `data/processed/hub_zone_encoder.pkl` — LabelEncoder for hub zones
- `data/processed/feature_metadata.json` — feature contract (16 features)
- `data/processed/model_meta.json` — calibration params per CV fold
- `data/processed/optimal_threshold.json` — F1-optimal threshold + evaluation metrics

---

## Environment Variables

Copy `.env.example` → `.env` and fill in:

```env
# Database
DATABASE_URL=postgresql://orca:orca_pass@localhost:5432/orca_db

# Redis
REDIS_URL=redis://localhost:6380

# API Security
PUBLIC_API_TOKEN=dev-public-token
INTERNAL_API_TOKEN=dev-internal-token

# ML Config
SLA_RISK_AMPLIFIER=4.0
ALERT_RISK_THRESHOLD=70.0

# External Services (optional — platform works without these)
OPEN_METEO_API_URL=https://api.open-meteo.com/v1/forecast
TOMTOM_API_KEY=              # Traffic multipliers (optional)
FONNTE_API_KEY=              # WhatsApp SLA alerts (optional)
FONNTE_API_URL=https://api.fonnte.com/send
ALERT_RECIPIENT_PHONE=       # WhatsApp recipient number

# Frontend
NEXT_PUBLIC_API_BASE=http://localhost:8001
NEXT_PUBLIC_API_TOKEN=dev-public-token
NEXT_PUBLIC_POLL_INTERVAL_MS=15000
```

---

## Makefile Targets

```bash
make install          # Install both Python (uv sync) and Node (pnpm install) deps
make install-ai       # Install Python deps only
make install-web      # Install Node deps only

make up               # docker compose up -d --build (full stack)
make down             # docker compose down
make restart          # down + up
make build            # docker compose build (no start)
make ps               # docker compose ps
make logs             # Follow logs for orca-ai + orca-web

make dev-ai           # uvicorn on port 8001 with --reload
make dev-web          # pnpm dev on port 3001

make seed-db          # Seed demo shipments into DB
make test-ai          # pytest (Python)
make test-web         # pnpm build (Next.js type-check + build)
make clean            # Remove .next, .pytest_cache, .coverage
```

> **Note:** There is no `make train` target. Run the training script directly from `apps/orca-ai/` as shown in the ML Pipeline section above.

---

## Architecture

```
┌─────────────┐     ┌──────────────────────────┐     ┌──────────────────┐
│  Browser    │────→│  orca-web (Next.js:3001)  │────→│  orca-ai         │
│             │←────│  SWR polling / REST        │←────│  (FastAPI:8001)  │
└─────────────┘     └──────────────────────────┘     │                  │
                                                      │  ML Pipeline     │
                                                      │  ├ LightGBM v2   │
                                                      │  ├ NSGA-II Opt.  │
                                                      │  ├ SLA Scorer    │
                                                      │  ├ Carbon GLEC   │
                                                      │  └ SHAP Explain  │
                                                      └──────┬───────────┘
                                                             │
                                       ┌─────────────────────┼────────────────┐
                                       │                     │                │
                                 ┌─────┴────┐       ┌────────┴──┐   ┌────────┴────┐
                                 │TimescaleDB│       │  Redis    │   │ Open-Meteo  │
                                 │  :5432    │       │  :6380    │   │ (weather)   │
                                 └──────────┘       └───────────┘   └─────────────┘
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | System health + model version |
| GET | `/shipments/active` | Active shipments with ML predictions |
| POST | `/shipments/` | Create shipment (triggers ML prediction) |
| GET | `/shipments/{id}/prediction` | Prediction detail + SHAP contributions |
| GET | `/shipments/{id}/events` | Shipment event history |
| GET | `/hubs/` | Hub list with coordinates |
| POST | `/optimize/route` | NSGA-II multi-objective route optimization |
| GET | `/optimize/vehicles` | Available vehicle types |
| GET | `/analytics/carbon` | GLEC carbon footprint analytics |
| GET | `/analytics/hubs` | Hub congestion and dwell time analytics |
| GET | `/alerts/recent` | Recent SLA alert history |
| POST | `/alerts/dispatch` | Dispatch alert manually (internal) |
| POST | `/internal/predict` | Direct ML inference (internal auth required) |

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Model loads as "fallback-v1" | Ensure `data/processed/model.pkl` exists; run training if missing |
| DB connection refused | `docker compose up -d postgres` and wait 10s |
| Redis unavailable | `docker compose up -d redis`; predictions still work (just slower, no cache) |
| Weather always 0.0 | Open-Meteo is free; check internet. `weather_severity_score` defaults to 0 if unavailable |
| SHAP slow on first call | Expected — Explainer initializes once at startup (~5s). Cached after |
| OSMnx route slow (first call) | Graph loads from `data/processed/osmnx/jabodetabek.pkl` (~30s first time). Cached after |
| `pnpm install` fails on Windows | Run with `$env:CI="true"; pnpm install` in PowerShell |
| Frontend shows empty data | Check `NEXT_PUBLIC_API_BASE` points to running backend |
