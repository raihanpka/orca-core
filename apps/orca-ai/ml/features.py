"""Feature definitions — single source of truth for training and inference.

FEATURE_COLUMNS must match exactly what build_features.py writes to parquet.
build_feature_vector is called both during batch feature engineering and at
inference time (with sensible defaults for features not in the API payload).

Feature versions:
  v1: core timing/geography/historical rates
  v2: freight, price ratio, payment installments, same-state flag
  v3: hub dwell, payment type, seller reviews, product category, seller
      punctuality, holiday/strike calendar, product volume/density
  v4: Indonesia calendar (Lebaran, Harbolnas, Ramadan), Delhivery augmentation
      (route type, congestion ratio)
"""
import math
from datetime import datetime
from typing import Any

from ml.indonesia_calendar import INDONESIA_FEATURES, compute as compute_id_calendar

FEATURE_COLUMNS = [
    # ── v1: core features ────────────────────────────────────────────────────
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
    # ── v2: freight & payment features ───────────────────────────────────────
    "freight_value",
    "freight_to_price_ratio",
    "payment_installments",
    "same_state_delivery",
    # ── v3 Gem #1: hub processing dwell time ─────────────────────────────────
    "historical_hub_dwell_hours",
    # ── v3 Gem #2: payment type flags (credit_card is baseline) ──────────────
    "payment_boleto",
    "payment_voucher",
    "payment_debit",
    # ── v3 Gem #3: seller quality signal ─────────────────────────────────────
    "historical_seller_review",
    # ── v3 Gem #4: product category delay rate ────────────────────────────────
    "category_delay_rate",
    # ── v3 Gem #5: seller shipping punctuality ────────────────────────────────
    "historical_seller_punctuality",
    # ── v3 Gem #6: calendar / disruption flags ────────────────────────────────
    "is_holiday",
    "is_strike_window",
    "is_pre_christmas",
    "is_black_friday_week",
    # ── v3 Gem #7: product physical characteristics ───────────────────────────
    "product_volume_cm3",
    "product_density",
    "is_bulky",
    # ── v4: Indonesia calendar features ───────────────────────────────────────
    "days_to_lebaran",
    "is_lebaran_window",
    "is_harbolnas",
    "is_ramadan",
    "is_post_longweekend",
    "is_harbolnas_buildup",
    "indonesia_peak_season",
    # ── v4: Delhivery-derived features ────────────────────────────────────────
    "is_ftl_route",
    "congestion_ratio",
]


def _to_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return None


def encode_hub_zone(hub_zone: str, label_encoder: Any | None = None) -> int:
    if label_encoder is not None:
        try:
            return int(label_encoder.transform([str(hub_zone)])[0])
        except Exception:
            return 0
    digits = "".join(ch for ch in str(hub_zone) if ch.isdigit())
    return int(digits[:3] or 0)


def build_feature_vector(row: dict[str, Any], label_encoder: Any | None = None) -> dict[str, float | int]:
    dispatched_at = _to_datetime(row.get("dispatched_at") or row.get("order_purchase_timestamp"))
    day = int(row.get("day_of_week", dispatched_at.weekday() if dispatched_at else 0))
    hour = int(row.get("hour_of_day", dispatched_at.hour if dispatched_at else 0))
    hub_zone = str(row.get("hub_zone") or row.get("seller_zip_code_prefix") or "000")[:3]

    # v2 freight/payment features
    freight_value = float(row.get("freight_value") or 15.0)
    price = float(row.get("price") or 100.0)
    payment_installments = int(row.get("payment_installments") or 1)
    same_state = int(row.get("same_state_delivery") or 0)

    # v3 Gem #1: hub dwell time
    historical_hub_dwell_hours = float(row.get("historical_hub_dwell_hours") or 24.0)

    # v3 Gem #2: payment type — infer flags from payment_type string if raw flags absent
    payment_type_raw = str(row.get("payment_type") or "credit_card").lower()
    payment_boleto = int(row.get("payment_boleto") if row.get("payment_boleto") is not None
                         else payment_type_raw == "boleto")
    payment_voucher = int(row.get("payment_voucher") if row.get("payment_voucher") is not None
                          else payment_type_raw == "voucher")
    payment_debit = int(row.get("payment_debit") if row.get("payment_debit") is not None
                        else payment_type_raw == "debit_card")

    # v3 Gem #3: seller review
    historical_seller_review = float(row.get("historical_seller_review") or 4.0)

    # v3 Gem #4: category delay rate
    category_delay_rate = float(row.get("category_delay_rate") or 0.08)

    # v3 Gem #5: seller punctuality
    historical_seller_punctuality = float(row.get("historical_seller_punctuality") or 0.0)

    # v3 Gem #6: calendar flags
    is_holiday = int(row.get("is_holiday") or 0)
    is_strike_window = int(row.get("is_strike_window") or 0)
    is_pre_christmas = int(row.get("is_pre_christmas") or 0)
    is_black_friday_week = int(row.get("is_black_friday_week") or 0)

    # v3 Gem #7: product physical dimensions
    weight_g = float(row.get("product_weight_g") or row.get("load_weight_kg", 1.0) * 1000)
    volume_cm3 = float(row.get("product_volume_cm3") or 3000.0)
    product_density = float(row.get("product_density") or weight_g / max(volume_cm3, 1.0))
    is_bulky = int(row.get("is_bulky") or (1 if volume_cm3 > 10000 else 0))

    # v4: Indonesia calendar — compute from timestamp, or read pre-computed values
    id_cal = compute_id_calendar(dispatched_at)
    for key in INDONESIA_FEATURES:
        if row.get(key) is not None:
            id_cal[key] = row[key]

    # v4: Delhivery-derived features
    is_ftl_route = int(row.get("is_ftl_route") or 0)
    congestion_ratio = float(row.get("congestion_ratio") or 1.0)

    vector = {
        # v1
        "distance_km": float(row.get("distance_km") or 30.0),
        "estimated_delivery_days": float(row.get("estimated_delivery_days") or 2.0),
        "day_of_week_sin": math.sin(2 * math.pi * day / 7),
        "day_of_week_cos": math.cos(2 * math.pi * day / 7),
        "hour_of_day_sin": math.sin(2 * math.pi * hour / 24),
        "hour_of_day_cos": math.cos(2 * math.pi * hour / 24),
        "hub_zone_encoded": encode_hub_zone(hub_zone, label_encoder),
        "weather_severity_score": float(row.get("weather_severity_score") or 0.0),
        "historical_hub_delay_rate": float(row.get("historical_hub_delay_rate") or 0.0),
        "historical_driver_rate": float(row.get("historical_driver_rate") or 1.0),
        "item_count": int(row.get("item_count") or 1),
        "product_weight_g": weight_g,
        # v2
        "freight_value": freight_value,
        "freight_to_price_ratio": freight_value / max(price, 1.0),
        "payment_installments": payment_installments,
        "same_state_delivery": same_state,
        # v3
        "historical_hub_dwell_hours": historical_hub_dwell_hours,
        "payment_boleto": payment_boleto,
        "payment_voucher": payment_voucher,
        "payment_debit": payment_debit,
        "historical_seller_review": historical_seller_review,
        "category_delay_rate": category_delay_rate,
        "historical_seller_punctuality": historical_seller_punctuality,
        "is_holiday": is_holiday,
        "is_strike_window": is_strike_window,
        "is_pre_christmas": is_pre_christmas,
        "is_black_friday_week": is_black_friday_week,
        "product_volume_cm3": volume_cm3,
        "product_density": product_density,
        "is_bulky": is_bulky,
        # v4: Indonesia calendar
        **{k: id_cal[k] for k in INDONESIA_FEATURES},
        # v4: Delhivery-derived
        "is_ftl_route": is_ftl_route,
        "congestion_ratio": congestion_ratio,
    }
    return {column: vector[column] for column in FEATURE_COLUMNS}
