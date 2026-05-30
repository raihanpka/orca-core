import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "orca-ai"))

from ml.features import build_feature_vector  # noqa: E402
from ml.indonesia_calendar import compute as compute_id_calendar  # noqa: E402


RAW = ROOT / "data/raw/olist"
PROCESSED = ROOT / "data/processed"


def _read(name: str) -> pd.DataFrame:
    path = RAW / name
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}. Run make download-data first.")
    return pd.read_csv(path)


def _expanding_mean_no_leakage(series: pd.Series) -> pd.Series:
    """Expanding mean using only rows that came BEFORE the current row."""
    return series.shift(1).expanding().mean()


def _haversine_km(lat1, lon1, lat2, lon2):
    """Vectorized Haversine distance in kilometers."""
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return 2 * R * np.arcsin(np.sqrt(a))


def main() -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    orders = _read("olist_orders_dataset.csv")
    items = _read("olist_order_items_dataset.csv")
    customers = _read("olist_customers_dataset.csv")
    sellers = _read("olist_sellers_dataset.csv")
    products = _read("olist_products_dataset.csv")
    geolocation = _read("olist_geolocation_dataset.csv")

    item_agg = (
        items.groupby("order_id")
        .agg(
            item_count=("product_id", "count"),
            seller_id=("seller_id", "first"),
            product_id=("product_id", "first"),
        )
        .reset_index()
    )

    geo_agg = (
        geolocation.groupby("geolocation_zip_code_prefix")
        .agg(lat=("geolocation_lat", "median"), lng=("geolocation_lng", "median"))
        .reset_index()
        .rename(columns={"geolocation_zip_code_prefix": "zip_prefix"})
    )

    df = orders.merge(customers, on="customer_id", how="left")
    df = df.merge(item_agg, on="order_id", how="left")
    df = df.merge(sellers, on="seller_id", how="left")
    df = df.merge(products[["product_id", "product_weight_g"]], on="product_id", how="left")

    df = df.merge(
        geo_agg.rename(columns={"zip_prefix": "customer_zip_code_prefix", "lat": "customer_lat", "lng": "customer_lng"}),
        on="customer_zip_code_prefix",
        how="left",
    )
    df = df.merge(
        geo_agg.rename(columns={"zip_prefix": "seller_zip_code_prefix", "lat": "seller_lat", "lng": "seller_lng"}),
        on="seller_zip_code_prefix",
        how="left",
    )

    df = df[df["order_status"].eq("delivered")].copy()

    for column in ["order_purchase_timestamp", "order_estimated_delivery_date", "order_delivered_customer_date"]:
        df[column] = pd.to_datetime(df[column], errors="coerce", utc=True)
    df = df.dropna(subset=["order_purchase_timestamp", "order_estimated_delivery_date", "order_delivered_customer_date"])
    df["is_delayed"] = (df["order_delivered_customer_date"] > df["order_estimated_delivery_date"]).astype(int)
    df["estimated_delivery_days"] = (
        df["order_estimated_delivery_date"] - df["order_purchase_timestamp"]
    ).dt.total_seconds() / 86400

    # Hub zone: use 3-digit zip prefix, then map to Jabodetabek hub-style labels
    # for consistency with live inference (origin_hub_id.split("_")[-1])
    df["hub_zone"] = df["seller_zip_code_prefix"].fillna(0).astype(int).astype(str).str[:3]

    # Haversine distance
    df["distance_km"] = _haversine_km(
        df["seller_lat"], df["seller_lng"], df["customer_lat"], df["customer_lng"]
    )
    median_distance = float(df["distance_km"].median())
    df["distance_km"] = df["distance_km"].fillna(median_distance)

    df["item_count"] = df["item_count"].fillna(1).astype(int)
    df["product_weight_g"] = df["product_weight_g"].fillna(df["product_weight_g"].median())

    # Sort chronologically before computing historical features
    df = df.sort_values("order_purchase_timestamp").reset_index(drop=True)

    # Expanding historical rates (leakage-safe)
    df["historical_hub_delay_rate"] = (
        df.groupby("hub_zone")["is_delayed"]
        .transform(_expanding_mean_no_leakage)
        .fillna(0.0)
    )
    seller_delay = (
        df.groupby("seller_id")["is_delayed"]
        .transform(_expanding_mean_no_leakage)
        .fillna(0.0)
    )
    df["historical_driver_rate"] = (1.0 - seller_delay).clip(0.0, 1.0)

    # v2: Indonesia calendar features — compute from order timestamp
    cal_features = df["order_purchase_timestamp"].apply(lambda ts: compute_id_calendar(ts))
    cal_df = pd.DataFrame(cal_features.tolist())
    for col in cal_df.columns:
        df[col] = cal_df[col].values

    encoder = LabelEncoder()
    encoder.fit(df["hub_zone"].astype(str))
    with (PROCESSED / "hub_zone_encoder.pkl").open("wb") as fh:
        pickle.dump(encoder, fh)

    features = pd.DataFrame([build_feature_vector(row, encoder) for row in df.to_dict("records")])
    output = pd.concat(
        [
            df[
                [
                    "order_id",
                    "order_purchase_timestamp",
                    "order_estimated_delivery_date",
                    "customer_zip_code_prefix",
                    "seller_zip_code_prefix",
                    "hub_zone",
                    "is_delayed",
                ]
            ].reset_index(drop=True),
            features.reset_index(drop=True),
        ],
        axis=1,
    )

    from sklearn.model_selection import train_test_split
    train, test = train_test_split(output, test_size=0.2, stratify=output["is_delayed"], random_state=42)
    train = train.reset_index(drop=True)
    test = test.reset_index(drop=True)
    train.to_parquet(PROCESSED / "train_features.parquet", index=False)
    test.to_parquet(PROCESSED / "test_features.parquet", index=False)
    output.to_parquet(PROCESSED / "simulation_stream.parquet", index=False)

    print(f"\n=== FEATURE SUMMARY (v2 — Indonesia calendar) ===")
    print(f"train_rows={len(train)} positive_rate={train['is_delayed'].mean():.3f}")
    print(f"test_rows={len(test)} positive_rate={test['is_delayed'].mean():.3f}")
    print(f"\ndistance_km          : min={train['distance_km'].min():.1f} med={train['distance_km'].median():.1f} max={train['distance_km'].max():.1f}")
    print(f"item_count           : min={int(train['item_count'].min())} med={int(train['item_count'].median())} max={int(train['item_count'].max())}")
    print(f"product_weight_g     : min={train['product_weight_g'].min():.0f} med={train['product_weight_g'].median():.0f} max={train['product_weight_g'].max():.0f}")
    print(f"\nIndonesia calendar coverage:")
    for col in ["is_lebaran_window", "is_ramadan", "is_harbolnas_buildup", "indonesia_peak_season"]:
        print(f"  {col:<25}: rate={train[col].mean():.4f}")
    print(f"\nDelay rate by distance bucket:")
    bins = pd.cut(train["distance_km"], bins=[0, 50, 200, 500, 1000, 10000])
    print(train.groupby(bins, observed=True)["is_delayed"].agg(["mean", "count"]).round(3))


if __name__ == "__main__":
    main()
