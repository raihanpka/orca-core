import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "orca-ai"))

from ml.features import build_feature_vector  # noqa: E402


RAW = ROOT / "data/raw/olist"
PROCESSED = ROOT / "data/processed"


def _read(name: str) -> pd.DataFrame:
    path = RAW / name
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}. Run make download-data first.")
    return pd.read_csv(path)


def _expanding_mean_no_leakage(series: pd.Series) -> pd.Series:
    """Compute expanding mean using only rows that came BEFORE the current row.

    Using shift(1) before .expanding().mean() prevents the current row's target
    value from leaking into its own historical rate feature.
    """
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
    payments = _read("olist_order_payments_dataset.csv")

    # v2: aggregate item count, freight value, and price per order.
    item_agg = (
        items.groupby("order_id")
        .agg(
            item_count=("product_id", "count"),
            freight_value=("freight_value", "sum"),
            price=("price", "sum"),
            seller_id=("seller_id", "first"),
            product_id=("product_id", "first"),
        )
        .reset_index()
    )

    # v2: aggregate payment info per order (max installments — credit cards).
    pay_agg = (
        payments.groupby("order_id")
        .agg(payment_installments=("payment_installments", "max"))
        .reset_index()
    )

    # v2: zip prefix → median lat/lng centroid for Haversine distance.
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
    df = df.merge(pay_agg, on="order_id", how="left")

    # Customer location
    df = df.merge(
        geo_agg.rename(columns={"zip_prefix": "customer_zip_code_prefix", "lat": "customer_lat", "lng": "customer_lng"}),
        on="customer_zip_code_prefix",
        how="left",
    )
    # Seller location
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
    df["hub_zone"] = df["seller_zip_code_prefix"].fillna(0).astype(int).astype(str).str[:3]

    # v2: Haversine distance — real geographic distance between seller and customer.
    df["distance_km"] = _haversine_km(
        df["seller_lat"], df["seller_lng"], df["customer_lat"], df["customer_lng"]
    )
    # Fallback to a sensible median for any rows with missing geolocation.
    median_distance = float(df["distance_km"].median())
    df["distance_km"] = df["distance_km"].fillna(median_distance)

    # v2: derived freight features.
    df["price"] = df["price"].fillna(df["price"].median())
    df["freight_value"] = df["freight_value"].fillna(df["freight_value"].median())
    df["freight_to_price_ratio"] = df["freight_value"] / df["price"].clip(lower=1.0)
    df["payment_installments"] = df["payment_installments"].fillna(1).astype(int)

    # v2: same-state delivery indicator (Brazilian states proxy for short-haul).
    df["same_state_delivery"] = (df["customer_state"] == df["seller_state"]).astype(int)
    df["item_count"] = df["item_count"].fillna(1).astype(int)
    df["product_weight_g"] = df["product_weight_g"].fillna(df["product_weight_g"].median())

    # Sort chronologically before computing historical features.
    # This ensures the expanding window only sees past orders — no future leakage.
    df = df.sort_values("order_purchase_timestamp").reset_index(drop=True)

    # historical_hub_delay_rate: average delay rate for this hub zone across all
    # PREVIOUS orders (shift(1) excludes the current row from the window).
    df["historical_hub_delay_rate"] = (
        df.groupby("hub_zone")["is_delayed"]
        .transform(_expanding_mean_no_leakage)
        .fillna(0.0)
    )

    # historical_driver_rate: 1 - average delay rate for this seller across all
    # PREVIOUS orders (higher is better — seller with no prior delays gets 1.0).
    seller_delay = (
        df.groupby("seller_id")["is_delayed"]
        .transform(_expanding_mean_no_leakage)
        .fillna(0.0)
    )
    df["historical_driver_rate"] = (1.0 - seller_delay).clip(0.0, 1.0)

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
    # Output is already sorted chronologically (df was sorted above).

    train, test = train_test_split(output, test_size=0.2, shuffle=False)
    train.to_parquet(PROCESSED / "train_features.parquet", index=False)
    test.to_parquet(PROCESSED / "test_features.parquet", index=False)
    output.to_parquet(PROCESSED / "simulation_stream.parquet", index=False)

    print(f"\n=== FEATURE SUMMARY (v2) ===")
    print(f"train_rows={len(train)} positive_rate={train['is_delayed'].mean():.3f}")
    print(f"test_rows={len(test)} positive_rate={test['is_delayed'].mean():.3f}")
    print(f"\ndistance_km          : min={train['distance_km'].min():.1f} med={train['distance_km'].median():.1f} max={train['distance_km'].max():.1f}")
    print(f"freight_value        : min={train['freight_value'].min():.2f} med={train['freight_value'].median():.2f} max={train['freight_value'].max():.2f}")
    print(f"payment_installments : min={int(train['payment_installments'].min())} med={int(train['payment_installments'].median())} max={int(train['payment_installments'].max())}")
    print(f"same_state_delivery  : rate={train['same_state_delivery'].mean():.3f}")
    print(f"\nDelay rate by distance bucket:")
    bins = pd.cut(train["distance_km"], bins=[0, 50, 200, 500, 1000, 10000])
    print(train.groupby(bins, observed=True)["is_delayed"].agg(["mean", "count"]).round(3))
    print(f"\nDelay rate by same_state_delivery:")
    print(train.groupby("same_state_delivery")["is_delayed"].agg(["mean", "count"]).round(3))


if __name__ == "__main__":
    main()
