# ORCA ML Model Card — Delay Predictor v2

## Overview

| Property | Value |
|----------|-------|
| **Model Name** | ORCA Delay Predictor |
| **Version** | v2 (Indonesia calendar features) |
| **Type** | Binary Classification (LightGBM + CalibratedClassifierCV) |
| **Target** | `is_delayed` — whether a shipment arrives after its estimated delivery date |
| **Output** | `delay_probability` [0, 1] → `sla_risk_score` [0, 100] |
| **Framework** | LightGBM + scikit-learn + Optuna HPO |
| **Format** | `model.pkl` (preferred), `model.lgbm` (portable) |

## Intended Use

ORCA Delay Predictor is designed for the Blibli logistics network to:

1. **Predict delivery delay probability** at shipment level in real-time
2. **Score SLA risk** to prioritize operator attention on high-risk shipments
3. **Explain risk factors** via SHAP feature contributions
4. **Trigger proactive interventions** (rerouting, customer notification) before delays occur

The model operates within the ORCA platform's FastAPI backend, integrated into:
- `GET /shipments/active` — lazy batch inference for dashboard
- `GET /shipments/{id}/prediction` — individual prediction with SHAP
- `POST /internal/predict` — direct inference for engine/subscriber
- Redis subscriber — real-time event-driven predictions

## Training Data

| Property | Value |
|----------|-------|
| **Source** | Olist Brazilian E-Commerce Dataset (Kaggle) |
| **Records** | ~96,470 delivered orders |
| **Train/Test Split** | 80/20 stratified shuffle (balanced class distribution) |
| **Positive Rate** | ~8.8% (train), ~8.1% (test) |
| **Time Range** | 2016–2018 |

### Data Limitations

The model is trained on Brazilian e-commerce data as a proxy for Indonesian logistics. Key differences:
- Distance distribution differs (Brazil: continent-scale, Indonesia: archipelago)
- Delivery infrastructure and last-mile patterns differ
- Calendar effects are re-mapped to Indonesian events (Lebaran, Harbolnas, Ramadan)

For production deployment, the model should be retrained on Blibli's anonymized internal data.

## Feature Set (16 Features)

| # | Feature | Type | Source |
|---|---------|------|--------|
| 1 | `distance_km` | float | Haversine distance between origin and destination |
| 2 | `estimated_delivery_days` | float | (sla_deadline − dispatched_at) / 86400 |
| 3 | `day_of_week_sin` | float | sin(2π × weekday / 7) — cyclical encoding |
| 4 | `day_of_week_cos` | float | cos(2π × weekday / 7) — cyclical encoding |
| 5 | `hour_of_day_sin` | float | sin(2π × hour / 24) — cyclical encoding |
| 6 | `hour_of_day_cos` | float | cos(2π × hour / 24) — cyclical encoding |
| 7 | `hub_zone_encoded` | int | LabelEncoder on origin hub zone (hub_zone_encoder.pkl) |
| 8 | `weather_severity_score` | float [0–3] | Open-Meteo WMO code → severity at inference time |
| 9 | `historical_hub_delay_rate` | float [0–1] | Expanding mean delay rate per hub zone |
| 10 | `historical_driver_rate` | float [0–1] | 1 − expanding mean delay rate per driver/seller |
| 11 | `item_count` | int | Number of items in the shipment |
| 12 | `product_weight_g` | float | Total product weight in grams |
| 13 | `is_lebaran_window` | int [0,1] | ±7 days around Eid al-Fitr dates (2016–2030) |
| 14 | `is_ramadan` | int [0,1] | 30 days before Lebaran |
| 15 | `is_harbolnas_buildup` | int [0,1] | 3 days before 11.11 / 12.12 |
| 16 | `indonesia_peak_season` | int [0,1] | Nov–Dec or Ramadan/Lebaran period |

### v1 → v2 Changes

Removed (Olist-specific, not relevant for Indonesian logistics):
- `freight_value`, `freight_to_price_ratio`, `payment_installments`, `same_state_delivery`

Added (Indonesia-specific calendar signals):
- `is_lebaran_window`, `is_ramadan`, `is_harbolnas_buildup`, `indonesia_peak_season`

## Model Architecture

```
Input (16 features)
    ↓
LightGBM Classifier (Optuna-tuned hyperparameters)
    ↓
CalibratedClassifierCV (method='sigmoid', cv=5)
    ↓
Calibrated delay_probability [0, 1]
    ↓
compute_sla_risk(prob, remaining_hours, amplifier=4.0)
    ↓
sla_risk_score [0, 100] + urgency tier (low/medium/high)
```

### Calibration

The model uses Platt sigmoid calibration across 5 stratified CV folds to produce well-calibrated probabilities. This is critical because:

1. Raw LightGBM probabilities on imbalanced data (~8% positive) are poorly calibrated
2. The SLA risk formula multiplies probability by an amplifier (4.0) — calibrated probabilities ensure this mapping is meaningful
3. SHAP contributions are more interpretable with calibrated base scores

### SLA Risk Formula

```
urgency_weight =
    0.5  if remaining_hours > 24
    0.8  if 8 < remaining_hours ≤ 24
    1.2  if remaining_hours ≤ 8

risk_score = clip(delay_probability × urgency_weight × amplifier × 100, 0, 100)
```

Tiers: `low` (< 40), `medium` (40–69), `high` (≥ 70)

Alert threshold: `sla_risk_score ≥ 70`

## Artifacts

| File | Path | Description |
|------|------|-------------|
| `model.pkl` | `data/processed/model.pkl` | Full sklearn CalibratedClassifierCV (preferred) |
| `model.lgbm` | `data/processed/model.lgbm` | Native LightGBM booster (fold 0 only, portable) |
| `model_meta.json` | `data/processed/model_meta.json` | Calibration params + feature contract |
| `hub_zone_encoder.pkl` | `data/processed/hub_zone_encoder.pkl` | LabelEncoder for hub_zone_encoded |
| `feature_metadata.json` | `data/processed/feature_metadata.json` | Feature list, version, training metadata |
| `optimal_threshold.json` | `data/processed/optimal_threshold.json` | F1-optimal threshold + eval metrics |

## How to Retrain

```bash
# 1. Build features from Olist CSVs
cd apps/orca-ai
uv run python ../../scripts/ingest/build_features.py

# 2. Train model (N_TRIALS controls Optuna HPO search)
N_TRIALS=30 uv run python training/train_delay.py

# 3. Evaluate on held-out test set
uv run python training/evaluate.py

# 4. Export to native LightGBM format (optional)
uv run python ../../scripts/export_model.py

# 5. Segment analysis (optional)
uv run python training/evaluate_segments.py
```

## Integration with Backend

### Inference Paths

1. **Lazy batch** (`GET /shipments/active`): For each shipment without a cached prediction, builds feature vector from DB row + live weather (Open-Meteo) + hub historical rates → predict → bulk insert to `shipment_predictions`, `carbon_records`, `alert_logs`

2. **Individual** (`GET /shipments/{id}/prediction`): Returns latest cached prediction + SHAP contributions

3. **Direct** (`POST /internal/predict`): Accepts raw features in request body → predict → return

4. **Event-driven** (Redis subscriber): Processes `orca:events:shipments` channel → predict → persist

### Response Envelope

All predictions are wrapped in the standard API envelope:
```json
{
    "success": true,
    "data": {
        "shipment_id": "uuid",
        "delay_probability": 0.1234,
        "sla_risk_score": 59.23,
        "predicted_delay_hours": 5.93,
        "model_version": "lgbm-v2"
    },
    "error": null,
    "timestamp": "2026-05-30T..."
}
```

## Ethical Considerations

- Model predictions are decision-support, not automated decisions
- Risk scores should be paired with explainable factors (SHAP) so operators understand why
- Calendar features (Lebaran, Ramadan) are used to predict logistics disruption patterns, not to discriminate
- The model uses proxy data; predictions should be validated against real Blibli operations before production use

## Evaluation Results (Test Set)

| Metric | Value |
|--------|-------|
| **AUC-ROC** | 0.7259 |
| **F1 (optimal threshold)** | 0.3049 |
| **Precision / Recall** | 0.2556 / 0.3776 |
| **ECE (calibration error)** | 0.0072 |
| **Brier Score** | 0.0691 |
| **Optimal Threshold** | 0.1516 |
| **Test Rows** | 19,294 |
| **Positive Rate** | 8.1% |

### Calibration Quality

The model is extremely well-calibrated (ECE = 0.007). Probability deciles show close alignment between predicted and actual delay rates:

| Decile | Predicted | Actual |
|--------|-----------|--------|
| D1 (lowest risk) | 2.8% | 2.0% |
| D5 (medium) | 5.5% | 5.5% |
| D9 (high) | 13.7% | 13.8% |
| D10 (highest risk) | 23.1% | 26.3% |

### Business Impact

| Strategy | Net Cost | Savings vs Baseline |
|----------|----------|---------------------|
| No model (do nothing) | Rp 78,250,000 | — |
| Distance heuristic (>500km) | Rp 113,580,000 | -Rp 35,330,000 (worse!) |
| **ORCA model (calibrated)** | **Rp 65,910,000** | **Rp 12,340,000 (15.8%)** |

Annualized projection (1M shipments/year): **Rp 639,577,071 savings/year**

### Segment Performance

| Segment | N | AUC | F1 |
|---------|---|-----|-----|
| Urban (<50km) | 2,361 | 0.747 | 0.380 |
| Regional (50-200km) | 2,591 | 0.701 | 0.250 |
| Medium (200-500km) | 6,159 | 0.713 | 0.268 |
| Long (500-1000km) | 5,073 | 0.727 | 0.320 |
| Extreme (>1000km) | 3,110 | 0.705 | 0.316 |
| Peak Season | 4,704 | 0.762 | 0.326 |
| Ramadan | 1,772 | 0.792 | 0.300 |

## Known Limitations

1. **Proxy training data**: Olist (Brazil) ≠ Blibli (Indonesia). Model captures general logistics patterns but not Indonesia-specific infrastructure bottlenecks.
2. **Weather at training time**: `weather_severity_score` is always 0 during training (no historical weather in Olist). The model learns to use it only at inference via the calibrated ensemble's flexibility, but its impact is limited.
3. **Hub zone encoding**: Training uses 3-digit zip prefixes; live inference uses hub IDs (e.g., "cakung"). The `build_feature_vector()` function normalizes this via `origin_hub_id.split("_")[-1]` → LabelEncoder, but unseen labels fall back to 0.
4. **`predicted_delay_hours`**: This is a heuristic (`probability × estimated_days × 24`), not a regression output. Use `delay_probability` and `sla_risk_score` as the primary decision metrics.
