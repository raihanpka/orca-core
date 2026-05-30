# ORCA ML/AI Integration Guide

Reference for frontend/backend developers integrating with the ML prediction system.

## Architecture

```
┌──────────────┐     ┌──────────────────────────────────────┐
│  orca-web    │────→│  orca-ai (FastAPI)                   │
│  (Next.js)   │←────│                                      │
└──────────────┘     │  /api/shipments/*    ← REST API      │
                     │  /api/hubs/*                          │
                     │  /api/optimize/*                      │
                     │  /api/internal/*     ← engine-only    │
                     │                                      │
                     │  ┌─ ML Pipeline ──────────────────┐  │
                     │  │ DelayPredictor                  │  │
                     │  │  ├─ model.pkl (LightGBM+Cal)   │  │
                     │  │  ├─ hub_zone_encoder.pkl        │  │
                     │  │  └─ build_feature_vector()      │  │
                     │  │ SLAScorer                       │  │
                     │  │ RouteOptimizer (NSGA-II)        │  │
                     │  │ CarbonCalc (GLEC v3)            │  │
                     │  └────────────────────────────────┘  │
                     │                                      │
                     │  ┌─ External Services ────────────┐  │
                     │  │ Open-Meteo (weather)            │  │
                     │  │ Fonnte (WhatsApp alerts)        │  │
                     │  │ TomTom (traffic)                │  │
                     │  │ Stadia Maps (Valhalla routing)  │  │
                     │  └────────────────────────────────┘  │
                     └──────────────────────────────────────┘
                           │                │
                     ┌─────┴────┐    ┌──────┴─────┐
                     │TimescaleDB│    │   Redis    │
                     │(PG 15)    │    │  6380      │
                     └──────────┘    └────────────┘
```

## API Endpoints

### 1. Active Shipments (Dashboard)
```
GET /shipments/active?limit=20&hub_id=hub_cakung&min_risk=70
```

Returns paginated active shipments with ML predictions. Predictions are computed lazily on first request and cached in `shipment_predictions`.

**Response fields:**
| Field | Type | ML Source |
|-------|------|-----------|
| `delay_probability` | float [0,1] | model.predict_proba |
| `sla_risk_score` | float [0,100] | compute_sla_risk() |
| `predicted_delay_hours` | float | heuristic from probability |
| `model_version` | string | e.g. "lgbm-v2" |
| `co2_kg` | float | GLEC formula |

### 2. Shipment Prediction Detail
```
GET /shipments/{id}/prediction
```

Returns detailed prediction with SHAP feature contributions.

**Response:**
```json
{
    "data": {
        "shipment_id": "uuid",
        "delay_probability": 0.18,
        "sla_risk_score": 72.0,
        "predicted_delay_hours": 6.5,
        "model_version": "lgbm-v2",
        "shap_contributions": [
            {"feature": "distance_km", "value": 450.2, "contribution": 0.082},
            {"feature": "hub_zone_encoded", "value": 5, "contribution": 0.041}
        ],
        "intervention_options": ["reroute_via_toll", "notify_customer_proactively"]
    }
}
```

### 3. Route Optimization
```
POST /optimize/route
```

**Request:**
```json
{
    "origin_hub_id": "hub_cakung",
    "vehicle_id": "B-ORCA-01",
    "vehicle_type": "van_diesel",
    "load_weight_kg": 1000,
    "routing_engine": "osmnx",
    "delivery_stops": [
        {
            "shipment_id": "uuid",
            "destination_lat": -6.2088,
            "destination_lng": 106.8456,
            "sla_deadline": "2026-05-30T18:00:00Z",
            "weight_kg": 5.2
        }
    ]
}
```

**Response:** Pareto-optimal routes balancing time, distance, CO2, and SLA risk.

### 4. Create Shipment
```
POST /shipments/
```

Creates a new shipment and triggers immediate ML prediction.

### 5. Hub Analytics
```
GET /analytics/hubs
```

Returns congestion level, dwell time, and inbound volume per hub.

### 6. Internal Predict (Engine-only)
```
POST /internal/predict
Authorization: Bearer {internal_api_token}
```

Raw prediction endpoint accepting pre-computed features.

## Feature Vector Contract

The model expects exactly 16 features in this order:

```python
FEATURE_COLUMNS = [
    "distance_km",
    "estimated_delivery_days",
    "day_of_week_sin",
    "day_of_week_cos",
    "hour_of_day_sin",
    "hour_of_day_cos",
    "hub_zone_encoded",
    "weather_severity_score",
    "historical_hub_delay_rate",
    "historical_driver_rate",
    "item_count",
    "product_weight_g",
    "is_lebaran_window",
    "is_ramadan",
    "is_harbolnas_buildup",
    "indonesia_peak_season",
]
```

The `build_feature_vector()` function in `ml/features.py` handles all feature computation:
- Cyclical encoding of day/hour
- Hub zone encoding via LabelEncoder
- Indonesia calendar feature computation from timestamp
- Default values for missing fields

**Never construct the feature vector manually.** Always use `build_feature_vector()`.

## Database Tables Used by ML

| Table | Read/Write | Purpose |
|-------|-----------|---------|
| `shipments` | Read | Source data for prediction features |
| `shipment_predictions` | Write | Cached prediction results |
| `carbon_records` | Write | CO2 emission calculations |
| `alert_logs` | Write | High-risk shipment alerts |
| `hub_metrics` | Read+Write | Historical hub performance for features |
| `glec_emission_factors` | Read | CO2 emission factors per vehicle type |

## Redis Cache Keys

| Key Pattern | TTL | Description |
|-------------|-----|-------------|
| `orca:cache:pred:{shipment_id}` | 900s | Cached prediction result |
| `orca:cache:hub_rates:{hub_id}` | 1800s | Hub delay rate + avg dwell time |
| `orca:cache:weather:{lat}:{lng}` | 1800s | Weather severity score |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SLA_RISK_AMPLIFIER` | 4.0 | Scales delay_probability to risk_score range |
| `ALERT_RISK_THRESHOLD` | 70.0 | Minimum sla_risk_score to trigger alerts |
| `OPEN_METEO_API_URL` | `https://api.open-meteo.com/v1/forecast` | Weather API |
| `PREDICTION_CACHE_TTL_SECONDS` | 900 | Redis cache TTL for predictions |
| `NSGA2_POPULATION_SIZE` | 100 | Route optimizer population |
| `NSGA2_GENERATIONS` | 200 | Route optimizer generations |

## Model Loading

On app startup (`main.py`), models are loaded once and stored in `app.state`:

```python
app.state.delay_model      # CalibratedClassifierCV or LocalLightGBMModel
app.state.label_encoder    # LabelEncoder for hub_zone_encoded
app.state.model_version    # "lgbm-v2"
```

Loading priority (from `core/mlflow_client.py`):
1. `MODEL_PATH` env var (explicit file)
2. MLflow registry (if available)
3. Local `data/processed/model.pkl` or `model.lgbm`
4. Fallback heuristic (rule-based, uses distance + weather + hub delay rate)

## CO2 Calculation (GLEC Framework v3.0)

```
transport_activity_tkm = distance_km × load_weight_ton
CO2_kg = transport_activity_tkm × emission_factor   # emission_factor unit: kg CO2e / tonne-km
```

This is the standard GLEC Framework v3.0 transport activity formula. Emission factors (kg CO2e per
tonne-km) are stored in the `glec_emission_factors` table, seeded via `infra/init-db/01_schema.sql`.
Each vehicle class already encodes operating characteristics — no additive vehicle-weight term is used.

| Vehicle type | Emission factor (kg CO2e / tonne-km) | Notes |
|---|---|---|
| `scooter_electric` | 0.025 | Urban last-mile EV |
| `van_diesel` | 0.243 | Diesel van < 3.5t GVW |
| `truck_lt35t` | 0.218 | Diesel truck < 3.5t GVW |
| `truck_35_75t` | 0.178 | Diesel truck 3.5–7.5t GVW |
| `truck_gt75t` | 0.147 | Diesel truck > 7.5t GVW |

## Alert Flow

```
prediction.sla_risk_score ≥ 70
    → INSERT INTO alert_logs (deduplicated per 2h window)
    → If FONNTE_API_KEY set → WhatsApp notification
    → POST to orca:events:alerts Redis channel
```
