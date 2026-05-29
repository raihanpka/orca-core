"""Per-segment evaluation + business impact analysis.

Loads the Production model from MLflow and evaluates it across business-relevant
segments (payment type, distance bucket, strike window, etc.). Also translates
classification performance into business impact (cost saved, ROI vs baseline).

Run after evaluate.py has promoted the v3 model to Production. Output is a
deep-dive report meant for the demo presentation and model card.

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
import mlflow
import mlflow.sklearn
import numpy as np
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt
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
MODEL_NAME = "delay-predictor"

# ── Business impact assumptions (per delayed shipment, in Rupiah) ────────────
# Values are conservative estimates for Blibli-scale Indonesian e-commerce.
COST_DELAY = 50_000           # refund / discount / customer support / brand damage
COST_INTERVENTION = 10_000    # priority routing / proactive notification / re-allocation


def _safe_metric(metric_fn, y_true, y_pred, **kwargs):
    """Wrap metric calls that fail on single-class segments."""
    try:
        return float(metric_fn(y_true, y_pred, zero_division=0, **kwargs))
    except Exception:
        return float("nan")


def evaluate_segment(
    df_seg: pd.DataFrame,
    y_prob: np.ndarray,
    threshold: float,
    name: str,
) -> dict:
    """Compute metrics for a single data segment."""
    y_true = df_seg["is_delayed"].values.astype(int)
    if len(y_true) == 0:
        return {"segment": name, "n": 0}

    y_pred = (y_prob >= threshold).astype(int)
    n_pos = int(y_true.sum())
    delay_rate = float(y_true.mean()) if len(y_true) else 0.0

    # AUC requires both classes present.
    try:
        auc = float(roc_auc_score(y_true, y_prob)) if 0 < n_pos < len(y_true) else float("nan")
    except ValueError:
        auc = float("nan")

    return {
        "segment": name,
        "n": int(len(y_true)),
        "delay_rate": round(delay_rate, 4),
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


def business_impact(
    y_true: np.ndarray, y_pred: np.ndarray, label: str
) -> dict:
    """Translate confusion matrix into Rupiah savings.

    Decision model:
      - True Positive (predicted delay, actual delay): intervene (COST_INTERVENTION) → avoid COST_DELAY
                                                       net per case = COST_DELAY - COST_INTERVENTION
      - False Positive (predicted delay, on-time):     wasted intervention (-COST_INTERVENTION)
      - False Negative (missed delay):                 full delay cost (-COST_DELAY)
      - True Negative (correct no-action):             $0
    """
    tp = int(((y_pred == 1) & (y_true == 1)).sum())
    fp = int(((y_pred == 1) & (y_true == 0)).sum())
    fn = int(((y_pred == 0) & (y_true == 1)).sum())
    tn = int(((y_pred == 0) & (y_true == 0)).sum())

    savings_tp = tp * (COST_DELAY - COST_INTERVENTION)
    waste_fp = fp * COST_INTERVENTION
    loss_fn = fn * COST_DELAY
    net_cost = -savings_tp + waste_fp + loss_fn  # negative = good (savings)

    # Baseline: no model, every delay costs full COST_DELAY.
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
    """Format integer Rupiah with thousand separators."""
    return f"Rp {amount:>15,.0f}"


def main() -> None:
    mlflow_uri = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5001")
    mlflow.set_tracking_uri(mlflow_uri)

    test_path = PROCESSED / "test_features.parquet"
    if not test_path.exists():
        raise FileNotFoundError(f"Missing {test_path}. Run make build-features first.")

    df = pd.read_parquet(test_path)
    X_test = df[FEATURE_COLUMNS].values.astype(float)
    y_test = df["is_delayed"].values.astype(int)

    # Load Production model.
    model_uri = f"models:/{MODEL_NAME}/Production"
    logger.info("Loading Production model from %s", model_uri)
    model = mlflow.sklearn.load_model(model_uri)
    y_prob = model.predict_proba(X_test)[:, 1]

    # Load optimal threshold from previous evaluate.py run.
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
    print("  DEEP-DIVE EVALUATION — Production Model (v3, 30 features)")
    print(separator)
    print(f"  Test rows         : {len(df):,}")
    print(f"  Overall delay rate: {y_test.mean()*100:.1f}%")
    print(f"  Optimal threshold : {threshold:.4f}")
    print(f"  Overall AUC-ROC   : {roc_auc_score(y_test, y_prob):.4f}")
    print(f"  Overall F1        : {f1_score(y_test, y_pred):.4f}")

    # ── SEGMENT 1: Payment type ────────────────────────────────────────────
    rows = []
    for name, mask in [
        ("credit_card (baseline)", (df["payment_boleto"] == 0) & (df["payment_voucher"] == 0) & (df["payment_debit"] == 0)),
        ("boleto", df["payment_boleto"] == 1),
        ("voucher", df["payment_voucher"] == 1),
        ("debit_card", df["payment_debit"] == 1),
    ]:
        rows.append(evaluate_segment(df[mask], y_prob[mask], threshold, name))
    print_segment_table(rows, "[1] Payment Type")

    # ── SEGMENT 2: Distance bucket ─────────────────────────────────────────
    bins = [0, 50, 200, 500, 1000, 10000]
    labels = ["urban <50km", "regional 50-200km", "medium 200-500km", "long 500-1000km", "extreme >1000km"]
    df["_dist_bucket"] = pd.cut(df["distance_km"], bins=bins, labels=labels, include_lowest=True)
    rows = [
        evaluate_segment(df[df["_dist_bucket"] == lbl], y_prob[df["_dist_bucket"] == lbl], threshold, lbl)
        for lbl in labels
    ]
    print_segment_table(rows, "[2] Distance Bucket")

    # ── SEGMENT 3: Same-state vs cross-state ───────────────────────────────
    rows = [
        evaluate_segment(df[df["same_state_delivery"] == 1], y_prob[df["same_state_delivery"] == 1], threshold, "same state"),
        evaluate_segment(df[df["same_state_delivery"] == 0], y_prob[df["same_state_delivery"] == 0], threshold, "cross state"),
    ]
    print_segment_table(rows, "[3] Same-State vs Cross-State")

    # ── SEGMENT 4: Calendar windows (strike, holiday, pre-Christmas) ───────
    rows = [
        evaluate_segment(df[df["is_strike_window"] == 1], y_prob[df["is_strike_window"] == 1], threshold, "2018 truckers strike"),
        evaluate_segment(df[df["is_strike_window"] == 0], y_prob[df["is_strike_window"] == 0], threshold, "normal period"),
        evaluate_segment(df[df["is_holiday"] == 1], y_prob[df["is_holiday"] == 1], threshold, "Brazilian holiday"),
        evaluate_segment(df[df["is_pre_christmas"] == 1], y_prob[df["is_pre_christmas"] == 1], threshold, "pre-Christmas (Dec 15+)"),
        evaluate_segment(df[df["is_black_friday_week"] == 1], y_prob[df["is_black_friday_week"] == 1], threshold, "Black Friday week"),
    ]
    print_segment_table(rows, "[4] Calendar / Disruption Windows")

    # ── SEGMENT 5: Item count ──────────────────────────────────────────────
    rows = [
        evaluate_segment(df[df["item_count"] == 1], y_prob[df["item_count"] == 1], threshold, "single item"),
        evaluate_segment(df[df["item_count"] == 2], y_prob[df["item_count"] == 2], threshold, "2 items"),
        evaluate_segment(df[df["item_count"] >= 3], y_prob[df["item_count"] >= 3], threshold, "3+ items"),
    ]
    print_segment_table(rows, "[5] Item Count")

    # ── SEGMENT 6: Product bulkiness ───────────────────────────────────────
    rows = [
        evaluate_segment(df[df["is_bulky"] == 0], y_prob[df["is_bulky"] == 0], threshold, "non-bulky"),
        evaluate_segment(df[df["is_bulky"] == 1], y_prob[df["is_bulky"] == 1], threshold, "bulky (top 10% vol)"),
    ]
    print_segment_table(rows, "[6] Product Bulkiness")

    # ── SEGMENT 7: Probability deciles (calibration sanity check) ──────────
    print("\n  [7] Probability Deciles (Calibration Sanity)")
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
        print(
            f"  D{i+1:<9} [{lo:.3f}, {hi:.3f}]   {n:>7} {actual*100:>13.1f}% {pred*100:>11.1f}%"
        )

    # ── LAPIS 5: Business impact ───────────────────────────────────────────
    print(f"\n{separator}")
    print("  BUSINESS IMPACT — Cost vs Baseline")
    print(separator)
    print(f"  Assumptions per shipment:")
    print(f"    Cost of an undetected delay (refund + support + churn): {_fmt_idr(COST_DELAY)}")
    print(f"    Cost of a preventive intervention (priority routing) : {_fmt_idr(COST_INTERVENTION)}")
    print()

    # Strategy A: predict-always-on-time (baseline = no model)
    baseline_pred = np.zeros_like(y_test)
    impact_baseline = business_impact(y_test, baseline_pred, "No model (do nothing)")

    # Strategy B: trivial heuristic — flag every shipment with distance > 500km
    heuristic_pred = (df["distance_km"].values > 500).astype(int)
    impact_heuristic = business_impact(y_test, heuristic_pred, "Heuristic: distance > 500km")

    # Strategy C: our model at optimal threshold
    impact_model = business_impact(y_test, y_pred, "ORCA model (calibrated)")

    print(f"  {'Strategy':<32} {'TP':>5} {'FP':>5} {'FN':>5} {'TN':>5} {'Net cost':>20} {'Saved vs baseline':>20}")
    print(f"  {'-' * 92}")
    for imp in [impact_baseline, impact_heuristic, impact_model]:
        print(
            f"  {imp['label']:<32} {imp['tp']:>5} {imp['fp']:>5} {imp['fn']:>5} {imp['tn']:>5} "
            f"{_fmt_idr(imp['net_cost_idr']):>20} {_fmt_idr(imp['total_saved_idr']):>20}"
        )

    print()
    print(f"  Net savings vs no-model baseline   : {_fmt_idr(impact_model['total_saved_idr'])} "
          f"({impact_model['pct_saved']}% reduction)")
    print(f"  Net savings vs distance heuristic  : "
          f"{_fmt_idr(impact_model['total_saved_idr'] - impact_heuristic['total_saved_idr'])}")
    print()

    # Annualized projection (assume Blibli ships ~1M shipments/year for this segment).
    annual_shipments = 1_000_000
    scale = annual_shipments / len(df)
    annual_savings = impact_model["total_saved_idr"] * scale
    print(f"  Annualized projection ({annual_shipments:,} shipments/year):")
    print(f"    Projected savings: {_fmt_idr(annual_savings)} / year")

    # ── Persist results to JSON for the model card ────────────────────────
    out = {
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
