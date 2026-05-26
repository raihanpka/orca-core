import math
from datetime import datetime
from typing import Any

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
    # v2 features (added 2026-05-26 to fix AUC=0.5 baseline):
    "freight_value",
    "freight_to_price_ratio",
    "payment_installments",
    "same_state_delivery",
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

    # v2 features — defaults match Olist medians for graceful degradation.
    freight_value = float(row.get("freight_value") or 15.0)
    price = float(row.get("price") or 100.0)
    payment_installments = int(row.get("payment_installments") or 1)
    same_state = int(row.get("same_state_delivery") or 0)

    vector = {
        "distance_km": float(row.get("distance_km") or 30.0),
        "estimated_delivery_days": float(row.get("estimated_delivery_days") or 2.0),
        "day_of_week_sin": math.sin(2 * math.pi * day / 7),
        "day_of_week_cos": math.cos(2 * math.pi * day / 7),
        "hour_of_day_sin": math.sin(2 * math.pi * hour / 24),
        "hour_of_day_cos": math.cos(2 * math.pi * hour / 24),
        "hub_zone_encoded": encode_hub_zone(hub_zone, label_encoder),
        "weather_severity_score": float(row.get("weather_severity_score") or 0.0),  # TODO: BMKG integration
        "historical_hub_delay_rate": float(row.get("historical_hub_delay_rate") or 0.0),
        "historical_driver_rate": float(row.get("historical_driver_rate") or 1.0),
        "item_count": int(row.get("item_count") or 1),
        "product_weight_g": float(row.get("product_weight_g") or row.get("load_weight_kg", 1.0) * 1000),
        "freight_value": freight_value,
        "freight_to_price_ratio": freight_value / max(price, 1.0),
        "payment_installments": payment_installments,
        "same_state_delivery": same_state,
    }
    return {column: vector[column] for column in FEATURE_COLUMNS}
