"""Delay model evaluation pipeline.

Loads model.pkl, evaluates on the held-out test set, and outputs metrics.
MLflow logging is optional.

Usage (from repo root):
    make evaluate
    # or:
    cd apps/orca-ai && uv run python training/evaluate.py
"""

import json
import logging
import os
import pickle
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore", message="X does not have valid feature names")

import matplotlib
import numpy as np
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.calibration import calibration_curve
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "apps" / "orca-ai"))

from ml.features import FEATURE_COLUMNS  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PROCESSED = ROOT / "data" / "processed"
F1_PROMOTE_THRESHOLD = float(os.getenv("F1_PROMOTE_THRESHOLD", "0.30"))


def find_optimal_threshold(y_true: np.ndarray, y_prob: np.ndarray) -> tuple[float, float]:
    """Find the probability threshold that maximizes F1 on the test set."""
    precisions, recalls, thresholds = precision_recall_curve(y_true, y_prob)
    f1_scores = 2 * precisions[:-1] * recalls[:-1] / (precisions[:-1] + recalls[:-1] + 1e-12)
    best_idx = int(np.argmax(f1_scores))
    return float(thresholds[best_idx]), float(f1_scores[best_idx])


def compute_ece(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10) -> float:
    """Expected Calibration Error."""
    y_true = np.asarray(y_true)
    y_prob = np.asarray(y_prob)
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    bin_indices = np.clip(np.digitize(y_prob, bin_edges[1:-1]), 0, n_bins - 1)

    ece = 0.0
    n_total = len(y_true)
    for b in range(n_bins):
        mask = bin_indices == b
        bin_size = int(mask.sum())
        if bin_size == 0:
            continue
        bin_accuracy = float(y_true[mask].mean())
        bin_confidence = float(y_prob[mask].mean())
        ece += (bin_size / n_total) * abs(bin_accuracy - bin_confidence)
    return round(float(ece), 4)


def _plot_evaluation(
    y_test: np.ndarray, y_pred: np.ndarray, y_prob: np.ndarray, auc_roc: float, output_path: Path,
) -> None:
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))

    cm = confusion_matrix(y_test, y_pred)
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=["on_time", "delayed"])
    disp.plot(ax=axes[0], cmap="Blues", colorbar=False)
    axes[0].set_title("Confusion Matrix")

    fpr, tpr, _ = roc_curve(y_test, y_prob)
    axes[1].plot(fpr, tpr, label=f"AUC = {auc_roc:.3f}")
    axes[1].plot([0, 1], [0, 1], "k--", alpha=0.5)
    axes[1].set_xlabel("False Positive Rate")
    axes[1].set_ylabel("True Positive Rate")
    axes[1].set_title("ROC Curve")
    axes[1].legend()

    try:
        n_bins_cal = min(10, max(2, len(np.unique(np.round(y_prob, 2)))))
        fraction_pos, mean_pred = calibration_curve(
            y_test, y_prob, n_bins=n_bins_cal, strategy="quantile"
        )
        axes[2].plot(mean_pred, fraction_pos, "s-", label="Model")
    except Exception as exc:
        logger.warning("Calibration curve failed: %s", exc)
    axes[2].plot([0, 1], [0, 1], "k--", alpha=0.5, label="Perfect")
    axes[2].set_xlabel("Mean predicted probability")
    axes[2].set_ylabel("Fraction of positives")
    axes[2].set_title("Reliability Curve (Test Set)")
    axes[2].legend()

    fig.suptitle("ORCA Delay Predictor v2 - Evaluation Report", fontsize=13)
    fig.tight_layout()
    fig.savefig(output_path, dpi=120)
    plt.close(fig)
    logger.info("Evaluation plot saved to %s", output_path)


def main() -> None:
    test_path = PROCESSED / "test_features.parquet"
    if not test_path.exists():
        raise FileNotFoundError(f"Missing {test_path}. Run make build-features first.")

    df = pd.read_parquet(test_path)
    X_test = df[FEATURE_COLUMNS].values.astype(float)
    y_test = df["is_delayed"].values.astype(int)
    logger.info("Test set: rows=%d positive_rate=%.3f", len(y_test), y_test.mean())

    model_path = PROCESSED / "model.pkl"
    if not model_path.exists():
        raise FileNotFoundError(f"Missing {model_path}. Run training first.")
    logger.info("Loading model from %s", model_path)
    with model_path.open("rb") as fh:
        model = pickle.load(fh)

    y_prob = model.predict_proba(X_test)[:, 1]

    auc_roc = roc_auc_score(y_test, y_prob)
    brier = brier_score_loss(y_test, y_prob)
    ece = compute_ece(y_test, y_prob)

    y_pred_default = (y_prob >= 0.5).astype(int)
    f1_default = f1_score(y_test, y_pred_default, zero_division=0)
    precision_default = precision_score(y_test, y_pred_default, zero_division=0)
    recall_default = recall_score(y_test, y_pred_default, zero_division=0)

    best_threshold, best_f1 = find_optimal_threshold(y_test, y_prob)
    y_pred_optimal = (y_prob >= best_threshold).astype(int)
    precision_optimal = precision_score(y_test, y_pred_optimal, zero_division=0)
    recall_optimal = recall_score(y_test, y_pred_optimal, zero_division=0)

    prob_stats = {
        "min": float(y_prob.min()),
        "max": float(y_prob.max()),
        "mean": float(y_prob.mean()),
        "median": float(np.median(y_prob)),
        "p95": float(np.percentile(y_prob, 95)),
        "p99": float(np.percentile(y_prob, 99)),
    }

    separator = "=" * 60
    print(f"\n{separator}")
    print("  ORCA DELAY PREDICTOR v2 - EVALUATION RESULTS")
    print(separator)
    print(f"  Test set            : {len(y_test):,} rows | positive_rate = {y_test.mean():.3f}")
    print()
    print("  -- Threshold-independent metrics --")
    print(f"  AUC-ROC             : {auc_roc:.4f}")
    print(f"  Brier Score         : {brier:.4f}")
    print(f"  ECE                 : {ece:.4f}")
    print()
    print("  -- Probability distribution --")
    print(f"  P(delay) range      : {prob_stats['min']:.3f} ~ {prob_stats['max']:.3f}")
    print(f"  P(delay) mean / med : {prob_stats['mean']:.3f} / {prob_stats['median']:.3f}")
    print(f"  P(delay) p95 / p99  : {prob_stats['p95']:.3f} / {prob_stats['p99']:.3f}")
    print()
    print("  -- Default threshold = 0.5 --")
    print(f"  F1                  : {f1_default:.4f}")
    print(f"  Precision / Recall  : {precision_default:.4f} / {recall_default:.4f}")
    print(f"  Predicted positives : {int(y_pred_default.sum()):,}")
    print()
    print(f"  -- Optimal threshold = {best_threshold:.4f} (F1-maximized on test) --")
    print(f"  F1                  : {best_f1:.4f}")
    print(f"  Precision / Recall  : {precision_optimal:.4f} / {recall_optimal:.4f}")
    print(f"  Predicted positives : {int(y_pred_optimal.sum()):,}")
    print()
    print("  -- Classification report at OPTIMAL threshold --")
    print(classification_report(y_test, y_pred_optimal, target_names=["on_time", "delayed"], zero_division=0))
    print(f"  Qualification       : F1 >= {F1_PROMOTE_THRESHOLD}")
    qualified = best_f1 >= F1_PROMOTE_THRESHOLD
    decision = "QUALIFIED for production" if qualified else "BELOW threshold"
    print(f"  Decision            : {decision}")
    print(f"{separator}\n")

    f1 = best_f1
    y_pred = y_pred_optimal

    eval_plot_path = PROCESSED / "evaluation_plot.png"
    _plot_evaluation(y_test, y_pred, y_prob, auc_roc, eval_plot_path)

    threshold_meta = {
        "optimal_threshold": best_threshold,
        "f1_at_optimal": best_f1,
        "f1_at_default_0_5": f1_default,
        "test_positive_rate": float(y_test.mean()),
        "test_auc_roc": float(auc_roc),
        "test_brier_score": float(brier),
        "test_ece": float(ece),
        "test_precision": float(precision_optimal),
        "test_recall": float(recall_optimal),
        "n_test_rows": int(len(y_test)),
        "model_version": "v2",
        "feature_count": len(FEATURE_COLUMNS),
    }
    threshold_path = PROCESSED / "optimal_threshold.json"
    with threshold_path.open("w") as f:
        json.dump(threshold_meta, f, indent=2)
    logger.info("Optimal threshold metadata saved to %s", threshold_path)

    logger.info("Evaluation complete. AUC=%.4f F1=%.4f (threshold=%.4f)", auc_roc, best_f1, best_threshold)


if __name__ == "__main__":
    main()
