import pickle
import sys
from pathlib import Path

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


def main() -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    orders = _read("olist_orders_dataset.csv")
    items = _read("olist_order_items_dataset.csv")
    customers = _read("olist_customers_dataset.csv")
    sellers = _read("olist_sellers_dataset.csv")
    products = _read("olist_products_dataset.csv")

    item_agg = (
        items.groupby(["order_id", "seller_id", "product_id"])
        .size()
        .reset_index(name="item_count")
        .drop_duplicates("order_id")
    )
    df = orders.merge(customers, on="customer_id", how="left")
    df = df.merge(item_agg, on="order_id", how="left")
    df = df.merge(sellers, on="seller_id", how="left")
    df = df.merge(products[["product_id", "product_weight_g"]], on="product_id", how="left")
    df = df[df["order_status"].eq("delivered")].copy()

    for column in ["order_purchase_timestamp", "order_estimated_delivery_date", "order_delivered_customer_date"]:
        df[column] = pd.to_datetime(df[column], errors="coerce", utc=True)
    df = df.dropna(subset=["order_purchase_timestamp", "order_estimated_delivery_date", "order_delivered_customer_date"])
    df["is_delayed"] = (df["order_delivered_customer_date"] > df["order_estimated_delivery_date"]).astype(int)
    df["estimated_delivery_days"] = (
        df["order_estimated_delivery_date"] - df["order_purchase_timestamp"]
    ).dt.total_seconds() / 86400
    df["hub_zone"] = df["seller_zip_code_prefix"].fillna(0).astype(int).astype(str).str[:3]
    df["historical_hub_delay_rate"] = df.groupby("hub_zone")["is_delayed"].transform("mean").fillna(0.0)
    seller_rate = 1.0 - df.groupby("seller_id")["is_delayed"].transform("mean").fillna(0.0)
    df["historical_driver_rate"] = seller_rate

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
    ).sort_values("order_purchase_timestamp")

    train, test = train_test_split(output, test_size=0.2, shuffle=False)
    train.to_parquet(PROCESSED / "train_features.parquet", index=False)
    test.to_parquet(PROCESSED / "test_features.parquet", index=False)
    output.to_parquet(PROCESSED / "simulation_stream.parquet", index=False)
    print(f"train_rows={len(train)} positive_rate={train['is_delayed'].mean():.3f}")
    print(f"test_rows={len(test)} positive_rate={test['is_delayed'].mean():.3f}")


if __name__ == "__main__":
    main()
