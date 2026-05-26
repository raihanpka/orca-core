"""SHAP feature importance validation for the Production delay model.

Loads the Production model from MLflow, runs SHAP TreeExplainer on a sample of
the test set, and prints the top-5 features by mean |SHAP| value to verify the
model's decision logic is sensible.

Usage (from repo root):
    cd apps/orca-ai && uv run python training/validate_shap.py
"""

import logging
import os
import sys
from pathlib import Path

import matplotlib
import mlflow
import mlflow.sklearn
import numpy as np
import pandas as pd
import shap

matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "apps" / "orca-ai"))

from ml.features import FEATURE_COLUMNS  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PROCESSED = ROOT / "data" / "processed"
MODEL_NAME = "delay-predictor"
SHAP_SAMPLE_SIZE = 500


def _extract_lgbm_from_calibrated(calibrated_model):
    """Pull the underlying LGBMClassifier out of a CalibratedClassifierCV wrapper."""
    try:
        # CalibratedClassifierCV stores calibrated classifiers in .calibrated_classifiers_
        # Each has an .estimator attribute containing the base model.
        return calibrated_model.calibrated_classifiers_[0].estimator
    except (AttributeError, IndexError):
        return None


def main() -> None:
    mlflow_uri = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5001")
    mlflow.set_tracking_uri(mlflow_uri)

    test_path = PROCESSED / "test_features.parquet"
    if not test_path.exists():
        raise FileNotFoundError(f"Missing {test_path}. Run make build-features first.")

    df = pd.read_parquet(test_path)
    sample = df.sample(n=min(SHAP_SAMPLE_SIZE, len(df)), random_state=42)
    X_sample = sample[FEATURE_COLUMNS].values.astype(float)

    model_uri = f"models:/{MODEL_NAME}/Production"
    logger.info("Loading Production model from %s", model_uri)
    calibrated_model = mlflow.sklearn.load_model(model_uri)

    # Attempt TreeExplainer on the underlying LightGBM base estimator.
    base_model = _extract_lgbm_from_calibrated(calibrated_model)
    shap_values = None

    if base_model is not None:
        try:
            explainer = shap.TreeExplainer(base_model)
            raw = explainer.shap_values(X_sample)
            # LightGBM binary: shap_values is a list [class0, class1] or a 3D array.
            if isinstance(raw, list) and len(raw) == 2:
                shap_values = raw[1]
            elif isinstance(raw, np.ndarray) and raw.ndim == 3:
                shap_values = raw[:, :, 1]
            else:
                shap_values = raw
            logger.info("SHAP TreeExplainer computed on %d samples.", SHAP_SAMPLE_SIZE)
        except Exception as exc:
            logger.warning("TreeExplainer failed (%s). Falling back to KernelExplainer.", exc)

    if shap_values is None:
        logger.info("Using KernelExplainer with calibrated model predict_proba.")
        background = shap.sample(X_sample, 50)
        explainer = shap.KernelExplainer(calibrated_model.predict_proba, background)
        shap_values = explainer.shap_values(X_sample[:50], nsamples=100)[1]
        X_sample = X_sample[:50]

    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    feature_importance = sorted(
        zip(FEATURE_COLUMNS, mean_abs_shap), key=lambda x: x[1], reverse=True
    )

    print("\n" + "=" * 52)
    print("  SHAP FEATURE IMPORTANCE — Production Model")
    print("=" * 52)
    print(f"  {'Rank':<6} {'Feature':<35} {'Mean |SHAP|':>12}")
    print("  " + "-" * 55)
    for rank, (feat, importance) in enumerate(feature_importance, 1):
        marker = "  <-- expected dominant" if rank <= 3 else ""
        print(f"  {rank:<6} {feat:<35} {importance:>12.5f}{marker}")
    print("=" * 52)

    top5 = [f for f, _ in feature_importance[:5]]
    expected_top = {"historical_hub_delay_rate", "estimated_delivery_days", "distance_km"}
    overlap = expected_top & set(top5)
    if len(overlap) >= 2:
        print(f"\n  Sanity check PASSED: {overlap} appear in top 5.")
    else:
        print(
            f"\n  WARNING: Expected features {expected_top} not dominant. "
            f"Top 5 are: {top5}. Review features and model."
        )

    # Save summary beeswarm plot.
    shap_plot_path = PROCESSED / "shap_summary.png"
    shap.summary_plot(
        shap_values,
        X_sample,
        feature_names=FEATURE_COLUMNS,
        show=False,
        plot_size=(10, 6),
    )
    plt.title("SHAP Summary — Delay Predictor (Production)")
    plt.tight_layout()
    plt.savefig(shap_plot_path, dpi=120)
    plt.close()
    logger.info("SHAP summary plot saved to %s", shap_plot_path)


if __name__ == "__main__":
    main()
