# Model Card — Delay Predictor (delay-predictor)

## Model Overview

| Property | Value |
|---|---|
| Model Name | `delay-predictor` |
| Algorithm | LightGBM (Gradient Boosted Trees) + `CalibratedClassifierCV(method='sigmoid', cv=5)` |
| Task | Binary classification — `is_delayed` (0 = on time, 1 = delayed) |
| Output | Calibrated delay probability in [0, 1]; higher = higher delay risk |
| MLflow Registry | `models:/delay-predictor/Production` |
| Feature Version | v1 (12 features, see `ml/features.py::FEATURE_COLUMNS`) |
| Dataset | Olist Brazilian E-Commerce 2016–2018 (proxy) |
| Training Script | `apps/orca-ai/training/train_delay.py` |
| Evaluation Script | `apps/orca-ai/training/evaluate.py` |
| Promotion Threshold | F1 >= 0.75 on held-out test set |

---

## Intended Use

**Primary use case:** Predict the probability of a shipment being delivered after its estimated SLA deadline. The probability feeds the SLA risk score formula in `ml/sla_scorer.py`:

```
sla_risk_score = delay_probability × urgency_weight × 100
urgency_weight = 0.5 (>24h remaining), 0.8 (>8h), 1.2 (≤8h)
```

Shipments with `sla_risk_score >= 70` trigger automated WhatsApp alerts to operations managers.

**Secondary use:** Feature contributions from SHAP TreeExplainer explain *why* a specific shipment is flagged as high-risk, enabling targeted intervention (rerouting, customer notification).

**Not intended for:** Autonomous routing decisions without human review, customer-facing SLA guarantees, or fraud detection.

---

## Training Data

See `datasets.md` for full details.

| Split | Rows | Positive Rate |
|---|---|---|
| Train (80%, chronologically first) | ~89,000 | ~6%–35% |
| Test (20%, chronologically last) | ~22,000 | ~6%–35% |

Training uses chronological split (no shuffle) to simulate real deployment: the model must generalize to orders placed after its training window.

---

## Hyperparameter Search

Optuna TPE sampler, 50 trials, 5-fold stratified cross-validation optimizing macro F1.

| Parameter | Search Range |
|---|---|
| `num_leaves` | 20 – 150 |
| `learning_rate` | 0.01 – 0.3 (log scale) |
| `n_estimators` | 100 – 1,000 |
| `max_depth` | 3 – 12 |
| `min_child_samples` | 10 – 100 |
| `scale_pos_weight` | neg/pos (auto, handles imbalance) |

---

## Evaluation Metrics (Target)

| Metric | Promotion Threshold | Description |
|---|---|---|
| F1 Score | >= 0.75 | Harmonic mean of precision and recall |
| AUC-ROC | Logged (no gate) | Discrimination ability across thresholds |
| Brier Score | Logged (no gate) | Calibration quality (lower = better) |
| ECE | Logged (no gate) | Expected Calibration Error (lower = better) |

All metrics are logged to MLflow. The model is promoted to Production only when F1 >= 0.75.

---

## Calibration

The model uses `CalibratedClassifierCV(method='sigmoid', cv=5)`. Calibration ensures that `delay_probability = 0.7` means approximately 70% of such shipments are actually delayed — making the probability a valid input for the SLA risk formula rather than an uncalibrated ranking score.

**Expected calibration quality:** Brier score < 0.15, ECE < 0.05 on test set with balanced data.

---

## Feature Importance (Expected)

Based on domain knowledge, the dominant SHAP features should be:

| Expected Rank | Feature | Reasoning |
|---|---|---|
| 1–2 | `historical_hub_delay_rate` | Hub congestion history is the strongest predictor |
| 1–2 | `estimated_delivery_days` | Longer SLA windows → higher delay risk |
| 3–4 | `historical_driver_rate` | Seller reliability is a strong proxy for delivery quality |
| 4–5 | `product_weight_g` | Heavier items face more logistics friction |
| Low | `weather_severity_score` | Currently always 0.0 (BMKG not integrated) |
| Low | `distance_km` | Currently always 30.0 (geolocation not integrated) |

Run `validate_shap.py` after Production registration to verify actual feature importance.

---

## Limitations

| Limitation | Details |
|---|---|
| **Domain proxy** | Trained on Brazilian e-commerce; may not reflect Indonesian logistics patterns (road conditions, holiday calendar, local logistics partners) |
| **Missing real-time features** | `distance_km` and `weather_severity_score` are placeholders — model cannot leverage distance or weather until APIs are integrated |
| **Cold-start problem** | New hubs or sellers have `historical_*_rate = 0.0` at inference; model may underestimate risk for unknown entities |
| **Static model** | Does not update online; retraining is required as delivery patterns shift |
| **Temporal coverage** | Olist covers 2016–2018; Indonesian seasonal patterns (Lebaran, Harbolnas, etc.) are not represented |

---

## Ethical Considerations

- The model uses seller zip prefix as a hub zone proxy. This may encode regional economic disparities. Feature importance should be monitored to ensure the model doesn't unfairly penalize specific geographic areas.
- Automated alerts (WhatsApp via Fonnte) should be reviewed periodically to prevent alert fatigue. The threshold of 70 should be calibrated against actual alert resolution rates.

---

## Monitoring

After deployment, monitor the following via the ORCA dashboard and MLflow:

1. **Prediction drift**: compare `delay_probability` distribution monthly against training baseline.
2. **SLA alert rate**: should be 5–15% of active shipments under normal operations.
3. **Model accuracy**: compute F1 monthly as ground truth becomes available (actual delivery dates).
4. **Calibration drift**: ECE should remain < 0.05; retrain if it exceeds 0.10.

---

## Business Impact Estimates

These are directional projections assuming the model achieves F1 ≥ 0.75 and replaces fully reactive operations:

| Outcome | Estimated Improvement | Basis |
|---|---|---|
| SLA compliance | +5–12 pp improvement | Proactive rerouting catches ~60% of at-risk shipments before breach |
| Fuel cost reduction | 8–15% reduction | NSGA-II route optimization vs. greedy nearest-neighbor routing |
| Carbon emissions | 10–20% reduction per route | Multi-objective optimization prioritizes low-CO₂ paths |
| Alert false positive rate | < 25% | Calibrated probabilities vs. rule-based threshold systems |

*Note: Actual business impact requires A/B testing against the current baseline and real Blibli operational data.*
