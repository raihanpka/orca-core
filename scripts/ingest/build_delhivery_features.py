"""Build features from Delhivery dataset in the unified ORCA schema.

Maps Delhivery logistics columns to the same feature contract used by
build_features.py (Olist). Output is saved as delhivery_features.parquet
which build_features.py will optionally merge before the train/test split.

Delhivery key columns:
  - is_cutoff: 1 if shipment exceeded cutoff time (delay label)
  - route_type: "Carting" (hub-to-hub) or "FTL" (full truckload, direct)
  - actual_distance_to_destination: km
  - segment_actual_time / segment_osrm_time: congestion proxy
  - source_center / destination_center: hub zone proxy
  - trip_creation_time: timestamp for calendar features
  - od_start_time / od_end_time: actual transit timestamps

Usage (from repo root):
    make build-delhivery
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "orca-ai"))

from ml.features import FEATURE_COLUMNS  # noqa: E402
from ml.indonesia_calendar import INDONESIA_FEATURES  # noqa: E402

RAW = ROOT / "data/raw/delhivery"
PROCESSED = ROOT / "data/processed"


def main() -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)

    csv_files = list(RAW.glob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(
            f"No CSV files in {RAW}. Run make download-delhivery first."
        )

    df = pd.read_csv(csv_files[0])
    print(f"Loaded {csv_files[0].name}: {len(df)} rows, columns={list(df.columns)}")

    # Only keep rows with the is_cutoff label.
    if "is_cutoff" not in df.columns:
        raise ValueError("Expected 'is_cutoff' column in Delhivery dataset")

    df = df.dropna(subset=["is_cutoff"]).copy()
    df["is_delayed"] = df["is_cutoff"].astype(int)

    # Parse timestamps.
    for col in ["trip_creation_time", "od_start_time", "od_end_time"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    # distance_km
    if "actual_distance_to_destination" in df.columns:
        df["distance_km"] = pd.to_numeric(df["actual_distance_to_destination"], errors="coerce").fillna(50.0)
    else:
        df["distance_km"] = 50.0

    # estimated_delivery_days — approximate from OSRM time if available
    if "segment_osrm_time" in df.columns:
        osrm_hours = pd.to_numeric(df["segment_osrm_time"], errors="coerce").fillna(24)
        df["estimated_delivery_days"] = (osrm_hours / 24).clip(lower=0.1)
    else:
        df["estimated_delivery_days"] = 2.0

    # Timing features from trip_creation_time
    if "trip_creation_time" in df.columns:
        df["day_of_week"] = df["trip_creation_time"].dt.weekday.fillna(0).astype(int)
        df["hour_of_day"] = df["trip_creation_time"].dt.hour.fillna(12).astype(int)
    else:
        df["day_of_week"] = 0
        df["hour_of_day"] = 12

    # hub_zone proxy from source_center
    if "source_center" in df.columns:
        df["hub_zone"] = df["source_center"].astype(str).str[:3].fillna("000")
    else:
        df["hub_zone"] = "000"

    # is_ftl_route (Delhivery-specific: FTL vs Carting)
    if "route_type" in df.columns:
        df["is_ftl_route"] = (df["route_type"].str.upper() == "FTL").astype(int)
    else:
        df["is_ftl_route"] = 0

    # congestion_ratio: actual_time / osrm_time
    if "segment_actual_time" in df.columns and "segment_osrm_time" in df.columns:
        actual = pd.to_numeric(df["segment_actual_time"], errors="coerce").fillna(1)
        osrm = pd.to_numeric(df["segment_osrm_time"], errors="coerce").fillna(1).clip(lower=0.01)
        df["congestion_ratio"] = (actual / osrm).clip(0.1, 10.0).fillna(1.0)
    else:
        df["congestion_ratio"] = 1.0

    # Fill default values for features we cannot derive from Delhivery
    defaults = {
        "weather_severity_score": 0.0,
        "historical_hub_delay_rate": 0.0,
        "historical_driver_rate": 1.0,
        "item_count": 1,
        "product_weight_g": 500.0,
        "freight_value": 15.0,
        "freight_to_price_ratio": 0.15,
        "payment_installments": 1,
        "same_state_delivery": 0,
        "historical_hub_dwell_hours": 24.0,
        "payment_boleto": 0,
        "payment_voucher": 0,
        "payment_debit": 0,
        "historical_seller_review": 4.0,
        "category_delay_rate": 0.08,
        "historical_seller_punctuality": 0.0,
        "is_holiday": 0,
        "is_strike_window": 0,
        "is_pre_christmas": 0,
        "is_black_friday_week": 0,
        "product_volume_cm3": 3000.0,
        "product_density": 0.17,
        "is_bulky": 0,
    }
    for col, val in defaults.items():
        if col not in df.columns:
            df[col] = val

    for feat in INDONESIA_FEATURES:
        df[feat] = 0

    # Build feature vectors using sin/cos encoding
    import math

    rows_out = []
    for _, row in df.iterrows():
        day = int(row.get("day_of_week", 0))
        hour = int(row.get("hour_of_day", 12))
        vec = {}
        for col in FEATURE_COLUMNS:
            if col == "day_of_week_sin":
                vec[col] = math.sin(2 * math.pi * day / 7)
            elif col == "day_of_week_cos":
                vec[col] = math.cos(2 * math.pi * day / 7)
            elif col == "hour_of_day_sin":
                vec[col] = math.sin(2 * math.pi * hour / 24)
            elif col == "hour_of_day_cos":
                vec[col] = math.cos(2 * math.pi * hour / 24)
            elif col == "hub_zone_encoded":
                digits = "".join(c for c in str(row.get("hub_zone", "000")) if c.isdigit())
                vec[col] = int(digits[:3] or 0)
            elif col in row.index:
                vec[col] = float(row[col]) if not isinstance(row[col], (int, np.integer)) else int(row[col])
            elif col in defaults:
                vec[col] = defaults[col]
            else:
                vec[col] = 0
        rows_out.append(vec)

    features_df = pd.DataFrame(rows_out)

    # Metadata columns expected by the Olist output format
    output = features_df.copy()
    output["order_id"] = [f"delhivery_{i}" for i in range(len(output))]
    output["order_purchase_timestamp"] = df["trip_creation_time"].values if "trip_creation_time" in df.columns else pd.NaT
    output["order_estimated_delivery_date"] = pd.NaT
    output["customer_zip_code_prefix"] = 0
    output["seller_zip_code_prefix"] = 0
    output["hub_zone"] = df["hub_zone"].values
    output["is_delayed"] = df["is_delayed"].values

    output.to_parquet(PROCESSED / "delhivery_features.parquet", index=False)
    print(f"\nDelhivery features saved: {len(output)} rows, {len(FEATURE_COLUMNS)} features")
    print(f"  delay_rate = {output['is_delayed'].mean():.3f}")
    print(f"  is_ftl_route rate = {output['is_ftl_route'].mean():.3f}")
    print(f"  congestion_ratio median = {output['congestion_ratio'].median():.2f}")


if __name__ == "__main__":
    main()
