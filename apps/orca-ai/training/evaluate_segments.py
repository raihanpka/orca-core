"""Per-segment evaluation + business impact analysis.

Evaluates the Production model across business-relevant segments for Jabodetabek
logistics: distance buckets, Indonesia calendar windows, item count, and hub zones.

Run after evaluate.py. Output is a deep-dive report for demo and model card.

Usage (from repo root):
    make evaluate-segments
    # or:
    cd apps/orca-ai && uv run python training/evaluate_segments.py
"""

import io
import json
import logging
import os
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore", message="X does not have valid feature names")

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import matplotlib
import numpy as np
import pandas as pd

matplotlib.use("Agg")
from sklearn.metrics import (
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "apps" / "orca-ai"))

from ml.features import FEATURE_COLUMNS  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PROCESSED = ROOT / "data" / "processed"

# Business impact assumptions (per delayed shipment, in Rupiah)
COST_DELAY = 50_000
COST_INTERVENTION = 10_000


def _safe_metric(metric_fn, y_true, y_pred, **kwargs):
    try:
        return float(metric_fn(y_true, y_pred, zero_division=0, **kwargs))
    except Exception:
        return float("nan")


def evaluate_segment(df_seg: pd.DataFrame, y_prob: np.ndarray, threshold: float, name: str) -> dict:
    y_true = df_seg["is_delayed"].values.astype(int)
    if len(y_true) == 0:
        return {"segment": name, "n": 0}

    y_pred = (y_prob >= threshold).astype(int)
    n_pos = int(y_true.sum())

    try:
        auc = float(roc_auc_score(y_true, y_prob)) if 0 < n_pos < len(y_true) else float("nan")
    except ValueError:
        auc = float("nan")

    return {
        "segment": name,
        "n": int(len(y_true)),
        "delay_rate": round(float(y_true.mean()), 4),
        "auc": round(auc, 4) if not np.isnan(auc) else None,
        "f1": round(_safe_metric(f1_score, y_true, y_pred), 4),
        "precision": round(_safe_metric(precision_score, y_true, y_pred), 4),
        "recall": round(_safe_metric(recall_score, y_true, y_pred), 4),
        "predicted_pos": int(y_pred.sum()),
        "true_pos": int(((y_pred == 1) & (y_true == 1)).sum()),
    }


def print_segment_table(rows: list[dict], title: str) -> None:
    print(f"\n  {title}")
    print(f"  {'Segment':<28} {'N':>6} {'Delay%':>7} {'AUC':>7} {'F1':>7} {'Prec':>7} {'Recall':>7} {'TP/Pos':>9}")
    print(f"  {'-' * 90}")
    for r in rows:
        if r["n"] == 0:
            continue
        auc_str = f"{r['auc']:.3f}" if r["auc"] is not None else "  n/a"
        print(
            f"  {r['segment']:<28} {r['n']:>6} {r['delay_rate']*100:>6.1f}% "
            f"{auc_str:>7} {r['f1']:>7.3f} {r['precision']:>7.3f} {r['recall']:>7.3f} "
            f"{r['true_pos']:>4}/{r['predicted_pos']:<4}"
        )


def business_impact(y_true: np.ndarray, y_pred: np.ndarray, label: str) -> dict:
    tp = int(((y_pred == 1) & (y_true == 1)).sum())
    fp = int(((y_pred == 1) & (y_true == 0)).sum())
    fn = int(((y_pred == 0) & (y_true == 1)).sum())
    tn = int(((y_pred == 0) & (y_true == 0)).sum())

    savings_tp = tp * (COST_DELAY - COST_INTERVENTION)
    waste_fp = fp * COST_INTERVENTION
    loss_fn = fn * COST_DELAY

    baseline_cost = int(y_true.sum()) * COST_DELAY
    saved = baseline_cost - (waste_fp + loss_fn)
    pct_saved = (saved / baseline_cost) * 100 if baseline_cost else 0.0

    return {
        "label": label,
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        "savings_tp_idr": savings_tp,
        "waste_fp_idr": waste_fp,
        "loss_fn_idr": loss_fn,
        "net_cost_idr": waste_fp + loss_fn,
        "baseline_cost_idr": baseline_cost,
        "total_saved_idr": saved,
        "pct_saved": round(pct_saved, 1),
    }


def _fmt_idr(amount: int | float) -> str:
    return f"Rp {amount:>15,.0f}"


def main() -> None:
    test_path = PROCESSED / "test_features.parquet"
    if not test_path.exists():
        raise FileNotFoundError(f"Missing {test_path}. Run make build-features first.")

    df = pd.read_parquet(test_path)
    X_test = df[FEATURE_COLUMNS].values.astype(float)
    y_test = df["is_delayed"].values.astype(int)

    # Load model from pkl (no MLflow dependency)
    import pickle
    model_path = PROCESSED / "model.pkl"
    if not model_path.exists():
        raise FileNotFoundError(f"Missing {model_path}. Run training first.")
    with model_path.open("rb") as fh:
        model = pickle.load(fh)

    y_prob = model.predict_proba(X_test)[:, 1]

    threshold_path = PROCESSED / "optimal_threshold.json"
    if threshold_path.exists():
        with threshold_path.open() as f:
            threshold = float(json.load(f)["optimal_threshold"])
    else:
        threshold = 0.185
    y_pred = (y_prob >= threshold).astype(int)
    df["_y_prob"] = y_prob
    df["_y_pred"] = y_pred

    separator = "=" * 92
    print(f"\n{separator}")
    print("  DEEP-DIVE EVALUATION - ORCA Delay Predictor (v2, 16 features)")
    print(separator)
    print(f"  Test rows         : {len(df):,}")
    print(f"  Overall delay rate: {y_test.mean()*100:.1f}%")
    print(f"  Optimal threshold : {threshold:.4f}")
    print(f"  Overall AUC-ROC   : {roc_auc_score(y_test, y_prob):.4f}")
    print(f"  Overall F1        : {f1_score(y_test, y_pred):.4f}")

    # SEGMENT 1: Distance bucket
    bins = [0, 50, 200, 500, 1000, 10000]
    labels = ["urban <50km", "regional 50-200km", "medium 200-500km", "long 500-1000km", "extreme >1000km"]
    df["_dist_bucket"] = pd.cut(df["distance_km"], bins=bins, labels=labels, include_lowest=True)
    rows = [
        evaluate_segment(df[df["_dist_bucket"] == lbl], y_prob[df["_dist_bucket"] == lbl], threshold, lbl)
        for lbl in labels
    ]
    print_segment_table(rows, "[1] Distance Bucket")

    # SEGMENT 2: Indonesia calendar windows
    rows = []
    for col, name in [
        ("is_lebaran_window", "Lebaran window"),
        ("is_ramadan", "Ramadan"),
        ("is_harbolnas_buildup", "Harbolnas buildup"),
        ("indonesia_peak_season", "Peak season (Nov-Dec/Ramadan)"),
    ]:
        if col in df.columns:
            mask_on = df[col] == 1
            mask_off = df[col] == 0
            rows.append(evaluate_segment(df[mask_on], y_prob[mask_on], threshold, f"{name} (yes)"))
            rows.append(evaluate_segment(df[mask_off], y_prob[mask_off], threshold, f"{name} (no)"))
    if rows:
        print_segment_table(rows, "[2] Indonesia Calendar Windows")

    # SEGMENT 3: Item count
    rows = [
        evaluate_segment(df[df["item_count"] == 1], y_prob[df["item_count"] == 1], threshold, "single item"),
        evaluate_segment(df[df["item_count"] == 2], y_prob[df["item_count"] == 2], threshold, "2 items"),
        evaluate_segment(df[df["item_count"] >= 3], y_prob[df["item_count"] >= 3], threshold, "3+ items"),
    ]
    print_segment_table(rows, "[3] Item Count")

    # SEGMENT 4: Weight bucket
    weight_bins = pd.cut(df["product_weight_g"], bins=[0, 500, 2000, 10000, 200000])
    for bucket in weight_bins.cat.categories:
        mask = weight_bins == bucket
        if mask.sum() > 0:
            rows.append(evaluate_segment(df[mask], y_prob[mask], threshold, f"weight {bucket}"))

    # SEGMENT 5: Probability deciles
    print(f"\n  [5] Probability Deciles (Calibration Sanity)")
    print(f"  {'Decile':<10} {'P-range':<22} {'N':>7} {'Actual Delay%':>14} {'Avg Pred%':>12}")
    print(f"  {'-' * 72}")
    decile_edges = np.percentile(y_prob, np.linspace(0, 100, 11))
    for i in range(10):
        lo, hi = decile_edges[i], decile_edges[i + 1]
        mask = (y_prob >= lo) & (y_prob <= hi)
        n = int(mask.sum())
        if n == 0:
            continue
        actual = float(y_test[mask].mean())
        pred = float(y_prob[mask].mean())
        print(f"  D{i+1:<9} [{lo:.3f}, {hi:.3f}]   {n:>7} {actual*100:>13.1f}% {pred*100:>11.1f}%")

    # Business impact
    print(f"\n{separator}")
    print("  BUSINESS IMPACT - Cost vs Baseline (Jabodetabek)")
    print(separator)
    print(f"  Assumptions per shipment:")
    print(f"    Cost of an undetected delay (refund + support + churn): {_fmt_idr(COST_DELAY)}")
    print(f"    Cost of a preventive intervention (priority routing) : {_fmt_idr(COST_INTERVENTION)}")

    baseline_pred = np.zeros_like(y_test)
    impact_baseline = business_impact(y_test, baseline_pred, "No model (do nothing)")

    heuristic_pred = (df["distance_km"].values > 500).astype(int)
    impact_heuristic = business_impact(y_test, heuristic_pred, "Heuristic: distance > 500km")

    impact_model = business_impact(y_test, y_pred, "ORCA model (calibrated)")

    print(f"\n  {'Strategy':<32} {'TP':>5} {'FP':>5} {'FN':>5} {'TN':>5} {'Net cost':>20} {'Saved vs baseline':>20}")
    print(f"  {'-' * 92}")
    for imp in [impact_baseline, impact_heuristic, impact_model]:
        print(
            f"  {imp['label']:<32} {imp['tp']:>5} {imp['fp']:>5} {imp['fn']:>5} {imp['tn']:>5} "
            f"{_fmt_idr(imp['net_cost_idr']):>20} {_fmt_idr(imp['total_saved_idr']):>20}"
        )

    print(f"\n  Net savings vs no-model baseline   : {_fmt_idr(impact_model['total_saved_idr'])} "
          f"({impact_model['pct_saved']}% reduction)")

    annual_shipments = 1_000_000
    scale = annual_shipments / len(df)
    annual_savings = impact_model["total_saved_idr"] * scale
    print(f"\n  Annualized projection ({annual_shipments:,} shipments/year):")
    print(f"    Projected savings: {_fmt_idr(annual_savings)} / year")

    # Persist results
    out = {
        "model_version": "v2",
        "feature_count": len(FEATURE_COLUMNS),
        "production_threshold": threshold,
        "overall": {
            "n": int(len(df)),
            "delay_rate": float(y_test.mean()),
            "auc": float(roc_auc_score(y_test, y_prob)),
            "f1_at_optimal": float(f1_score(y_test, y_pred)),
        },
        "business_impact": {
            "assumptions": {
                "cost_delay_idr": COST_DELAY,
                "cost_intervention_idr": COST_INTERVENTION,
            },
            "no_model": impact_baseline,
            "distance_heuristic": impact_heuristic,
            "orca_model": impact_model,
            "annual_projection_idr": float(annual_savings),
        },
    }
    summary_path = PROCESSED / "evaluation_segments.json"
    with summary_path.open("w") as f:
        json.dump(out, f, indent=2)
    logger.info("Segment evaluation saved to %s", summary_path)

    print(f"\n{separator}")
    print(f"  Saved: {summary_path.name}")
    print(f"{separator}\n")


if __name__ == "__main__":
    main()
