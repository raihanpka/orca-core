# ORCA Dataset Documentation

## Overview

ORCA uses the **Brazilian E-Commerce Public Dataset by Olist** (Kaggle) as a proxy training dataset for delivery delay prediction. This is explicitly a proxy: Olist covers Brazilian e-commerce logistics (2016–2018), while the production target is Indonesian logistics operations. The domain gap is documented as a known limitation.

---

## Source Dataset

| Property | Value |
|---|---|
| Name | Brazilian E-Commerce Public Dataset by Olist |
| Provider | Olist (via Kaggle) |
| URL | https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce |
| License | CC BY-NC-SA 4.0 |
| Coverage | September 2016 – October 2018 |
| Orders | ~100,000 delivered orders |
| Geography | Brazil |

### Required CSV Files

Place all files in `data/raw/olist/`:

| File | Used | Purpose |
|---|---|---|
| `olist_orders_dataset.csv` | Yes | Purchase timestamps, estimated/actual delivery dates, order status |
| `olist_order_items_dataset.csv` | Yes | Seller ID, product ID, item count, freight value |
| `olist_customers_dataset.csv` | Yes | Customer zip code prefix → destination zone |
| `olist_sellers_dataset.csv` | Yes | Seller zip code prefix → hub zone |
| `olist_products_dataset.csv` | Yes | `product_weight_g` |
| `olist_geolocation_dataset.csv` | **Not yet used** | Zip code centroids for Haversine distance (feature v2) |
| `olist_order_payments_dataset.csv` | Not used | Payment method, installment count |
| `olist_order_reviews_dataset.csv` | Not used | Review score (planned for feature v2) |
| `product_category_name_translation.csv` | Not used | Category name translation |

---

## Target Variable

```
is_delayed = 1  if order_delivered_customer_date > order_estimated_delivery_date
           = 0  otherwise
```

Only rows with `order_status == 'delivered'` and non-null delivery timestamps are retained.

Expected positive (delayed) rate: **6%–35%** across the dataset depending on time period and filtering.

---

## Feature Engineering Pipeline

Run with: `make build-features` → calls `scripts/ingest/build_features.py`

### Output Artifacts

| Artifact | Path | Description |
|---|---|---|
| Training features | `data/processed/train_features.parquet` | 80% temporal split (chronologically first) |
| Test features | `data/processed/test_features.parquet` | 20% temporal split (chronologically last) |
| Simulation stream | `data/processed/simulation_stream.parquet` | Full dataset for Redis replay |
| Hub zone encoder | `data/processed/hub_zone_encoder.pkl` | Sklearn LabelEncoder for seller zip prefix → integer |

### Temporal Split

The dataset is sorted by `order_purchase_timestamp` and split 80/20 **without shuffling**. This is essential for realistic evaluation: the model must generalize to orders placed after its training window, mimicking real deployment.

```
2016-09  ───────────────────────────── 2018-08 │ 2018-08 ─── 2018-10
              TRAIN (80%)                       │    TEST (20%)
```

### Feature Columns (v1)

All 12 features are defined in `apps/orca-ai/ml/features.py::FEATURE_COLUMNS` — the **single source of truth** shared by training and inference.

| # | Feature | Source | Notes |
|---|---|---|---|
| 1 | `distance_km` | Default 30.0 | Placeholder; real value from geolocation Haversine in v2 |
| 2 | `estimated_delivery_days` | SLA window | (estimated_date - purchase_date) in days |
| 3 | `day_of_week_sin` | Purchase timestamp | Cyclical encoding, sin component |
| 4 | `day_of_week_cos` | Purchase timestamp | Cyclical encoding, cos component |
| 5 | `hour_of_day_sin` | Purchase timestamp | Cyclical encoding, sin component |
| 6 | `hour_of_day_cos` | Purchase timestamp | Cyclical encoding, cos component |
| 7 | `hub_zone_encoded` | Seller zip prefix (3 digits) | LabelEncoder integer |
| 8 | `weather_severity_score` | Default 0.0 | Placeholder; real value from BMKG API in v2 |
| 9 | `historical_hub_delay_rate` | Expanding mean, past orders only | No-leakage: shift(1) before expanding |
| 10 | `historical_driver_rate` | 1 − expanding mean, past orders only | Higher = more reliable seller |
| 11 | `item_count` | Order items | Number of distinct items |
| 12 | `product_weight_g` | Products table | Physical shipment weight |

### Data Leakage Prevention

Features 9 and 10 use an **expanding window with shift(1)** applied after chronological sort:

```python
df.sort_values("order_purchase_timestamp")
df.groupby("hub_zone")["is_delayed"].transform(
    lambda s: s.shift(1).expanding().mean()
).fillna(0.0)
```

This guarantees each row only sees delay statistics from orders that came **before** it — no future information leaks into training features.

---

## Known Limitations

| Limitation | Impact | Planned Mitigation |
|---|---|---|
| Brazilian e-commerce dataset, not Indonesian logistics | Domain mismatch; model may underperform on specific Indonesian patterns | Use as v1 proxy; replace with Blibli operational data when available |
| `distance_km` placeholder (30.0 for all) | Distance loses discriminative power; bias in carbon calculation | Integrate `olist_geolocation_dataset.csv` with Haversine formula |
| `weather_severity_score` placeholder (0.0) | Weather not modeled | Integrate BMKG real-time forecast API |
| Historical rates start at 0.0 for new hubs/sellers | Cold-start problem | Bayesian smoothing: blend with global prior (e.g., global_mean × alpha) |
| Olist covers 2016–2018 only | Limited seasonal coverage | Accept as limitation; retrain with fresh data in production |
| No real GPS/IoT telemetry | Hub dwell time and driver behavior not real-time | Architecture supports streaming; add telemetry features in v3 |

---

## Recommended Feature Additions (v2)

1. **Haversine `distance_km`** — compute from `olist_geolocation_dataset.csv` zip centroids.
2. **`freight_value`** — proxy for shipment priority and willingness to pay for speed.
3. **`review_score_mean`** — rolling mean review score per seller as a long-term reliability signal.
4. **Bayesian-smoothed historical rates** — `(count × expanding_mean + prior_count × global_mean) / (count + prior_count)` to handle cold-start.
5. **`weather_severity_score`** from BMKG API at dispatch time and hub location.
