"""Feature engineering pipeline — v4 (Indonesia-ready).

Processes raw Olist CSVs into train/test parquet files with 39 features:
  v1: distance, timing, hub zone, weather placeholder, historical rates, item/weight
  v2: freight, price ratio, payment installments, same-state flag
  v3: hub dwell time, payment type, seller reviews, product category, seller
      punctuality, holiday/strike calendar, product volume/density
  v4: Indonesia calendar (Lebaran, Harbolnas, Ramadan — real values from timestamps),
      wet-season weather proxy for training, Delhivery augmentation (optional merge)

Usage (from repo root):
    make build-features
    # or directly:
    cd apps/orca-ai && uv run python ../../scripts/ingest/build_features.py
"""

import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

try:
    import holidays as _holidays_lib
    _HAS_HOLIDAYS = True
except ImportError:
    _HAS_HOLIDAYS = False

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "orca-ai"))

from ml.features import build_feature_vector  # noqa: E402
from ml.indonesia_calendar import INDONESIA_FEATURES, compute as compute_id_calendar  # noqa: E402

RAW = ROOT / "data/raw/olist"
PROCESSED = ROOT / "data/processed"


def _read(name: str) -> pd.DataFrame:
    path = RAW / name
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}. Run make download-data first.")
    return pd.read_csv(path)


def _expanding_mean_no_leakage(series: pd.Series) -> pd.Series:
    """Expanding mean using only rows BEFORE the current row (shift prevents leakage)."""
    return series.shift(1).expanding().mean()


def _rolling_mean_no_leakage(series: pd.Series, window: int = 200) -> pd.Series:
    """Rolling mean over the last `window` rows, shifted to exclude current row.

    Capped at `window` rows so the estimate stays local rather than accumulating
    the full history (which can be skewed by the 2018 truckers' strike period).
    """
    return series.shift(1).rolling(window=window, min_periods=5).mean()


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

    # ── Load all CSVs ─────────────────────────────────────────────────────────
    orders = _read("olist_orders_dataset.csv")
    items = _read("olist_order_items_dataset.csv")
    customers = _read("olist_customers_dataset.csv")
    sellers = _read("olist_sellers_dataset.csv")
    products = _read("olist_products_dataset.csv")
    geolocation = _read("olist_geolocation_dataset.csv")
    payments = _read("olist_order_payments_dataset.csv")
    reviews = _read("olist_order_reviews_dataset.csv")  # GEM #3 — never used before

    # ── Aggregations ──────────────────────────────────────────────────────────

    # Items: item count, freight, price, seller, product, and GEM #5 shipping limit
    item_agg = (
        items.groupby("order_id")
        .agg(
            item_count=("product_id", "count"),
            freight_value=("freight_value", "sum"),
            price=("price", "sum"),
            seller_id=("seller_id", "first"),
            product_id=("product_id", "first"),
            shipping_limit_date=("shipping_limit_date", "min"),  # earliest deadline
        )
        .reset_index()
    )

    # Payments: installments + GEM #2 payment type
    pay_agg = (
        payments.groupby("order_id")
        .agg(
            payment_installments=("payment_installments", "max"),
            payment_type=("payment_type", "first"),
        )
        .reset_index()
    )

    # Geolocation: zip prefix → median lat/lng
    geo_agg = (
        geolocation.groupby("geolocation_zip_code_prefix")
        .agg(lat=("geolocation_lat", "median"), lng=("geolocation_lng", "median"))
        .reset_index()
        .rename(columns={"geolocation_zip_code_prefix": "zip_prefix"})
    )

    # GEM #3: reviews → one review score per order
    review_agg = (
        reviews.groupby("order_id")["review_score"]
        .mean()
        .reset_index()
    )

    # Products: full dimensions for GEM #7
    products_full = products[[
        "product_id", "product_category_name", "product_weight_g",
        "product_length_cm", "product_height_cm", "product_width_cm",
    ]].copy()

    # ── Join all tables ───────────────────────────────────────────────────────
    df = orders.merge(customers, on="customer_id", how="left")
    df = df.merge(item_agg, on="order_id", how="left")
    df = df.merge(sellers, on="seller_id", how="left")
    df = df.merge(products_full, on="product_id", how="left")
    df = df.merge(pay_agg, on="order_id", how="left")
    df = df.merge(review_agg, on="order_id", how="left")

    df = df.merge(
        geo_agg.rename(columns={"zip_prefix": "customer_zip_code_prefix",
                                 "lat": "customer_lat", "lng": "customer_lng"}),
        on="customer_zip_code_prefix", how="left",
    )
    df = df.merge(
        geo_agg.rename(columns={"zip_prefix": "seller_zip_code_prefix",
                                 "lat": "seller_lat", "lng": "seller_lng"}),
        on="seller_zip_code_prefix", how="left",
    )

    # ── Filter & parse timestamps ─────────────────────────────────────────────
    df = df[df["order_status"].eq("delivered")].copy()

    for col in [
        "order_purchase_timestamp", "order_estimated_delivery_date",
        "order_delivered_customer_date", "order_approved_at",
        "order_delivered_carrier_date", "shipping_limit_date",
    ]:
        df[col] = pd.to_datetime(df[col], errors="coerce", utc=True)

    df = df.dropna(subset=[
        "order_purchase_timestamp",
        "order_estimated_delivery_date",
        "order_delivered_customer_date",
    ])

    # ── Target variable ───────────────────────────────────────────────────────
    df["is_delayed"] = (
        df["order_delivered_customer_date"] > df["order_estimated_delivery_date"]
    ).astype(int)

    df["estimated_delivery_days"] = (
        df["order_estimated_delivery_date"] - df["order_purchase_timestamp"]
    ).dt.total_seconds() / 86400

    df["hub_zone"] = df["seller_zip_code_prefix"].fillna(0).astype(int).astype(str).str[:3]

    # ── v2: geographic & freight features ────────────────────────────────────
    df["distance_km"] = _haversine_km(
        df["seller_lat"], df["seller_lng"], df["customer_lat"], df["customer_lng"]
    )
    df["distance_km"] = df["distance_km"].fillna(df["distance_km"].median())

    df["price"] = df["price"].fillna(df["price"].median())
    df["freight_value"] = df["freight_value"].fillna(df["freight_value"].median())
    df["freight_to_price_ratio"] = df["freight_value"] / df["price"].clip(lower=1.0)
    df["payment_installments"] = df["payment_installments"].fillna(1).astype(int)
    df["same_state_delivery"] = (df["customer_state"] == df["seller_state"]).astype(int)
    df["item_count"] = df["item_count"].fillna(1).astype(int)

    # ── GEM #1: Hub dwell time (hours from order approval to carrier pickup) ─
    df["hub_dwell_hours"] = (
        (df["order_delivered_carrier_date"] - df["order_approved_at"])
        .dt.total_seconds() / 3600
    ).clip(lower=0)
    dwell_median = float(df["hub_dwell_hours"].median())
    df["hub_dwell_hours"] = df["hub_dwell_hours"].fillna(dwell_median)

    # ── GEM #2: Payment type binary flags (credit_card is baseline) ───────────
    df["payment_type"] = df["payment_type"].fillna("credit_card")
    df["payment_boleto"] = (df["payment_type"] == "boleto").astype(int)
    df["payment_voucher"] = (df["payment_type"] == "voucher").astype(int)
    df["payment_debit"] = (df["payment_type"] == "debit_card").astype(int)

    # ── GEM #3: Review score (will become historical per seller below) ────────
    df["review_score"] = df["review_score"].fillna(4.0)

    # ── GEM #5: Seller shipping lag (actual carrier date vs shipping limit) ──
    df["seller_shipping_lag_days"] = (
        (df["order_delivered_carrier_date"] - df["shipping_limit_date"])
        .dt.total_seconds() / 86400
    ).fillna(0.0)

    # ── GEM #7: Product dimensions → volume, density, bulky flag ─────────────
    df["product_weight_g"] = df["product_weight_g"].fillna(df["product_weight_g"].median())
    df["product_length_cm"] = df["product_length_cm"].fillna(20.0)
    df["product_width_cm"] = df["product_width_cm"].fillna(15.0)
    df["product_height_cm"] = df["product_height_cm"].fillna(10.0)
    df["product_volume_cm3"] = (
        df["product_length_cm"] * df["product_width_cm"] * df["product_height_cm"]
    )
    df["product_density"] = df["product_weight_g"] / df["product_volume_cm3"].clip(lower=1.0)
    bulky_threshold = float(df["product_volume_cm3"].quantile(0.90))
    df["is_bulky"] = (df["product_volume_cm3"] > bulky_threshold).astype(int)

    # ── Weather severity proxy — Indonesia wet-season pattern ─────────────────
    # BMKG API provides real scores at inference time. For training (Olist 2016-2018),
    # we inject a month-based wet-season proxy aligned to Java/Jakarta climate:
    # Oct-Nov = 0.6, Dec-Feb = 0.8 (peak), Mar-Apr = 0.5, May-Sep = 0.1 (dry).
    _WET_SEASON_MAP = {
        1: 0.75, 2: 0.80, 3: 0.55, 4: 0.45,
        5: 0.15, 6: 0.10, 7: 0.10, 8: 0.10,
        9: 0.15, 10: 0.50, 11: 0.65, 12: 0.75,
    }
    df["weather_severity_score"] = (
        df["order_purchase_timestamp"].dt.month.map(_WET_SEASON_MAP).fillna(0.2)
    )

    # ── GEM #6: Brazilian holiday, truckers strike, seasonal flags ────────────
    if _HAS_HOLIDAYS:
        br_hols = _holidays_lib.Brazil(years=range(2016, 2020))
        holiday_dates = set(br_hols.keys())
    else:
        holiday_dates = set()

    # 2018 Greve dos Caminhoneiros (Brazilian truckers strike, May 21–30, 2018)
    strike_dates = set(pd.date_range("2018-05-21", "2018-05-30").date)

    # Brazilian Black Friday peaks (last Friday of November)
    black_friday_dates = {
        pd.Timestamp("2016-11-25").date(),
        pd.Timestamp("2017-11-24").date(),
        pd.Timestamp("2018-11-23").date(),
    }

    purchase_date = df["order_purchase_timestamp"].dt.date
    df["is_holiday"] = purchase_date.isin(holiday_dates).astype(int)
    df["is_strike_window"] = purchase_date.isin(strike_dates).astype(int)
    df["is_pre_christmas"] = (
        (df["order_purchase_timestamp"].dt.month == 12)
        & (df["order_purchase_timestamp"].dt.day >= 15)
    ).astype(int)
    df["is_black_friday_week"] = purchase_date.isin(black_friday_dates).astype(int)

    # ── Sort chronologically before any expanding-window features ─────────────
    df = df.sort_values("order_purchase_timestamp").reset_index(drop=True)

    # ── Historical hub delay rate — rolling 200-row window per hub_zone ───────
    # Rolling (not expanding) so the estimate reflects recent conditions rather
    # than accumulating the entire history including the 2018 truckers' strike.
    df["historical_hub_delay_rate"] = (
        df.groupby("hub_zone")["is_delayed"]
        .transform(_rolling_mean_no_leakage)
        .fillna(
            df.groupby("hub_zone")["is_delayed"]
            .transform(_expanding_mean_no_leakage)
        )
        .fillna(0.0)
    )

    # ── Historical seller reliability — rolling window per seller ─────────────
    seller_delay = (
        df.groupby("seller_id")["is_delayed"]
        .transform(_rolling_mean_no_leakage)
        .fillna(
            df.groupby("seller_id")["is_delayed"]
            .transform(_expanding_mean_no_leakage)
        )
        .fillna(0.0)
    )
    df["historical_driver_rate"] = (1.0 - seller_delay).clip(0.0, 1.0)

    # ── GEM #1: Historical hub dwell time — rolling window per hub_zone ───────
    df["historical_hub_dwell_hours"] = (
        df.groupby("hub_zone")["hub_dwell_hours"]
        .transform(_rolling_mean_no_leakage)
        .fillna(
            df.groupby("hub_zone")["hub_dwell_hours"]
            .transform(_expanding_mean_no_leakage)
        )
        .fillna(dwell_median)
    )

    # ── GEM #3: Historical seller review score — rolling window per seller ───
    df["historical_seller_review"] = (
        df.groupby("seller_id")["review_score"]
        .transform(_rolling_mean_no_leakage)
        .fillna(
            df.groupby("seller_id")["review_score"]
            .transform(_expanding_mean_no_leakage)
        )
        .fillna(4.0)
    )

    # ── GEM #5: Historical seller punctuality — rolling window per seller ─────
    df["historical_seller_punctuality"] = (
        df.groupby("seller_id")["seller_shipping_lag_days"]
        .transform(_rolling_mean_no_leakage)
        .fillna(
            df.groupby("seller_id")["seller_shipping_lag_days"]
            .transform(_expanding_mean_no_leakage)
        )
        .fillna(0.0)
    )

    # ── GEM #4: Product category delay rate — rolling window per category ─────
    df["product_category_name"] = df["product_category_name"].fillna("unknown")
    global_delay_rate = float(df["is_delayed"].mean())
    df["category_delay_rate"] = (
        df.groupby("product_category_name")["is_delayed"]
        .transform(_rolling_mean_no_leakage)
        .fillna(
            df.groupby("product_category_name")["is_delayed"]
            .transform(_expanding_mean_no_leakage)
        )
        .fillna(global_delay_rate)
    )

    # ── v4: Indonesia calendar — computed from actual order timestamps ───────
    # Lebaran dates cover 2016-2030 so Olist (2016-2018) rows get real values.
    # Harbolnas 11.11/12.12 is universal across years; Ramadan window likewise.
    id_cal_rows = [compute_id_calendar(ts) for ts in df["order_purchase_timestamp"]]
    id_cal_df = pd.DataFrame(id_cal_rows, index=df.index)
    for feat in INDONESIA_FEATURES:
        df[feat] = id_cal_df[feat]

    # ── v4: Delhivery-derived stubs (filled if Delhivery parquet is merged) ──
    df["is_ftl_route"] = 0
    df["congestion_ratio"] = 1.0

    # ── Encode hub_zone ───────────────────────────────────────────────────────
    encoder = LabelEncoder()
    encoder.fit(df["hub_zone"].astype(str))
    with (PROCESSED / "hub_zone_encoder.pkl").open("wb") as fh:
        pickle.dump(encoder, fh)

    # ── Build feature matrix ──────────────────────────────────────────────────
    features = pd.DataFrame([build_feature_vector(row, encoder) for row in df.to_dict("records")])
    output = pd.concat(
        [
            df[[
                "order_id", "order_purchase_timestamp", "order_estimated_delivery_date",
                "customer_zip_code_prefix", "seller_zip_code_prefix",
                "hub_zone", "is_delayed",
            ]].reset_index(drop=True),
            features.reset_index(drop=True),
        ],
        axis=1,
    )

    # ── Optional Delhivery augmentation ──────────────────────────────────────
    delhivery_path = PROCESSED / "delhivery_features.parquet"
    if delhivery_path.exists():
        df_delhivery = pd.read_parquet(delhivery_path)
        # Align columns: only keep columns that exist in output.
        common_cols = [c for c in output.columns if c in df_delhivery.columns]
        df_delhivery = df_delhivery[common_cols]
        for c in output.columns:
            if c not in df_delhivery.columns:
                df_delhivery[c] = 0
        df_delhivery = df_delhivery[output.columns]
        output = pd.concat([output, df_delhivery], ignore_index=True)
        print(f"\nDelhivery augmentation: +{len(df_delhivery)} rows merged")

    # Stratified split: ensures both train and test have equal delay rate (~8.8%).
    # Shuffle=True avoids temporal distribution shift where the last 20% of Olist
    # data (late 2018, post-strike) has anomalously low delay rates (5.3% vs 8.8%).
    train, test = train_test_split(
        output, test_size=0.2, random_state=42, shuffle=True,
        stratify=output["is_delayed"],
    )
    train.to_parquet(PROCESSED / "train_features.parquet", index=False)
    test.to_parquet(PROCESSED / "test_features.parquet", index=False)
    output.to_parquet(PROCESSED / "simulation_stream.parquet", index=False)

    # ── Diagnostics ───────────────────────────────────────────────────────────
    print("\n=== FEATURE SUMMARY (v4) ===")
    print(f"train_rows={len(train)}  positive_rate={train['is_delayed'].mean():.3f}")
    print(f"test_rows={len(test)}   positive_rate={test['is_delayed'].mean():.3f}")
    print(f"n_features={len(features.columns)}")

    print(f"\ndistance_km                  : med={train['distance_km'].median():.1f}")
    print(f"historical_hub_dwell_hours   : med={train['historical_hub_dwell_hours'].median():.1f}")
    print(f"historical_seller_review     : med={train['historical_seller_review'].median():.2f}")
    print(f"category_delay_rate          : med={train['category_delay_rate'].median():.3f}")
    print(f"product_volume_cm3           : med={train['product_volume_cm3'].median():.0f}")
    print(f"payment_boleto rate          : {train['payment_boleto'].mean():.3f}")
    print(f"is_strike_window rate        : {train['is_strike_window'].mean():.4f}")
    print(f"is_bulky rate                : {train['is_bulky'].mean():.3f}")
    print(f"\n--- v4 Indonesia features ---")
    print(f"weather_severity_score       : med={train['weather_severity_score'].median():.2f}  mean={train['weather_severity_score'].mean():.2f}")
    print(f"is_lebaran_window rate        : {train['is_lebaran_window'].mean():.4f}")
    print(f"is_harbolnas rate             : {train['is_harbolnas'].mean():.4f}")
    print(f"is_ramadan rate               : {train['is_ramadan'].mean():.4f}")
    print(f"days_to_lebaran              : med={train['days_to_lebaran'].median():.0f}")
    print(f"indonesia_peak_season rate    : {train['indonesia_peak_season'].mean():.4f}")

    print("\nDelay rate by payment_boleto:")
    print(train.groupby("payment_boleto")["is_delayed"].agg(["mean", "count"]).round(3))

    print("\nDelay rate by is_bulky:")
    print(train.groupby("is_bulky")["is_delayed"].agg(["mean", "count"]).round(3))

    print("\nDelay rate by is_strike_window:")
    print(train.groupby("is_strike_window")["is_delayed"].agg(["mean", "count"]).round(3))

    print("\nTop 10 categories by delay rate (min 50 orders):")
    cat_stats = df.groupby("product_category_name")["is_delayed"].agg(["mean", "count"])
    cat_stats = cat_stats[cat_stats["count"] >= 50].sort_values("mean", ascending=False)
    print(cat_stats.head(10).round(3))


if __name__ == "__main__":
    main()
