"""Delay prediction model training pipeline.

Trains LightGBM with Optuna HPO, wraps with CalibratedClassifierCV, and registers
the model to MLflow under the 'delay-predictor' name at the Staging stage.

Usage (from repo root):
    make train
    # or directly:
    cd apps/orca-ai && uv run python training/train_delay.py
"""

import io
import json
import logging
import os
import pickle
import sys
import warnings

# Windows cp1252 terminals cannot encode MLflow's emoji output — force UTF-8.
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
from pathlib import Path

# Silence the noisy "X does not have valid feature names" warning that fires for
# every CV fold during Optuna and CalibratedClassifierCV. Benign — LightGBM
# remembers feature names from initial fit but receives numpy arrays during CV.
warnings.filterwarnings("ignore", message="X does not have valid feature names")

import matplotlib
import mlflow
import mlflow.sklearn
import numpy as np
import optuna
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from lightgbm import LGBMClassifier
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.metrics import f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "apps" / "orca-ai"))

from ml.features import FEATURE_COLUMNS  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PROCESSED = ROOT / "data" / "processed"
EXPERIMENT_NAME = "orca-delay-prediction"
MODEL_NAME = "delay-predictor"
# Use N_TRIALS=20 for fast iteration on new features, 50 for final.
# Override via env: N_TRIALS=20 make train
N_TRIALS = int(os.getenv("N_TRIALS", "50"))
CV_FOLDS = 5
RANDOM_SEED = 42


def load_data() -> tuple[np.ndarray, np.ndarray, object]:
    train_path = PROCESSED / "train_features.parquet"
    encoder_path = PROCESSED / "hub_zone_encoder.pkl"

    if not train_path.exists():
        raise FileNotFoundError(f"Missing {train_path}. Run make build-features first.")

    df = pd.read_parquet(train_path)
    X = df[FEATURE_COLUMNS].values.astype(float)
    y = df["is_delayed"].values.astype(int)

    encoder = None
    if encoder_path.exists():
        with encoder_path.open("rb") as fh:
            encoder = pickle.load(fh)

    pos_rate = float(y.mean())
    logger.info("Loaded train set: rows=%d positive_rate=%.3f", len(y), pos_rate)
    if not (0.05 <= pos_rate <= 0.40):
        logger.warning(
            "Positive rate %.3f is outside expected range [0.05, 0.40]. "
            "Check dataset or feature engineering.",
            pos_rate,
        )
    return X, y, encoder


def _make_objective(X: np.ndarray, y: np.ndarray):
    neg, pos = np.bincount(y)
    scale_pos_weight = neg / max(pos, 1)
    cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_SEED)

    def objective(trial: optuna.Trial) -> float:
        params = {
            "num_leaves": trial.suggest_int("num_leaves", 20, 150),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "n_estimators": trial.suggest_int("n_estimators", 100, 1000),
            "max_depth": trial.suggest_int("max_depth", 3, 12),
            "min_child_samples": trial.suggest_int("min_child_samples", 10, 100),
            "scale_pos_weight": scale_pos_weight,
            "random_state": RANDOM_SEED,
            "verbosity": -1,
            "n_jobs": -1,
        }
        clf = LGBMClassifier(**params)
        scores = cross_val_score(clf, X, y, cv=cv, scoring="f1", n_jobs=-1)
        return float(scores.mean())

    return objective


def _plot_calibration_curve(model, X: np.ndarray, y: np.ndarray, output_path: Path) -> None:
    prob_pos = model.predict_proba(X)[:, 1]
    fraction_pos, mean_pred = calibration_curve(y, prob_pos, n_bins=10)
    fig, ax = plt.subplots(figsize=(6, 6))
    ax.plot(mean_pred, fraction_pos, "s-", label="LightGBM (calibrated)")
    ax.plot([0, 1], [0, 1], "k--", label="Perfectly calibrated")
    ax.set_xlabel("Mean predicted probability")
    ax.set_ylabel("Fraction of positives")
    ax.set_title("Calibration Curve — Delay Predictor (Train Set)")
    ax.legend()
    fig.tight_layout()
    fig.savefig(output_path)
    plt.close(fig)
    logger.info("Calibration curve saved to %s", output_path)


def main() -> None:
    mlflow_uri = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5001")
    mlflow.set_tracking_uri(mlflow_uri)
    mlflow.set_experiment(EXPERIMENT_NAME)

    X, y, encoder = load_data()

    optuna.logging.set_verbosity(optuna.logging.WARNING)
    logger.info("Starting Optuna HPO: %d trials, %d-fold stratified CV", N_TRIALS, CV_FOLDS)

    study = optuna.create_study(
        direction="maximize",
        sampler=optuna.samplers.TPESampler(seed=RANDOM_SEED),
    )
    study.optimize(_make_objective(X, y), n_trials=N_TRIALS, show_progress_bar=True)

    best_params = study.best_params
    best_cv_f1 = study.best_value
    logger.info("Best CV F1=%.4f | params=%s", best_cv_f1, best_params)

    # Train final model on full training set with best hyper-parameters.
    neg, pos = np.bincount(y)
    final_params = {
        **best_params,
        "scale_pos_weight": neg / max(pos, 1),
        "random_state": RANDOM_SEED,
        "verbosity": -1,
        "n_jobs": -1,
    }
    base_clf = LGBMClassifier(**final_params)
    calibrated_clf = CalibratedClassifierCV(base_clf, method="sigmoid", cv=CV_FOLDS)
    calibrated_clf.fit(X, y)
    logger.info("Final calibrated model trained.")

    calibration_plot_path = PROCESSED / "calibration_curve.png"
    _plot_calibration_curve(calibrated_clf, X, y, calibration_plot_path)

    # Feature metadata — loaded by mlflow_client for contract validation.
    feature_meta = {
        "feature_columns": FEATURE_COLUMNS,
        "feature_version": "v4",
        "dataset_version": "olist-v4-indonesia",
        "n_features": len(FEATURE_COLUMNS),
        "gems": [
            "hub_dwell_time", "payment_type", "seller_review",
            "product_category", "seller_punctuality", "holiday_calendar",
            "product_volume_density",
        ],
        "v4_additions": [
            "indonesia_calendar", "delhivery_augmentation", "bmkg_weather",
        ],
    }
    meta_path = PROCESSED / "feature_metadata.json"
    with meta_path.open("w") as f:
        json.dump(feature_meta, f, indent=2)

    with mlflow.start_run(run_name="lightgbm-calibrated") as run:
        mlflow.set_tags({
            "dataset_version": "olist-v4-indonesia",
            "feature_version": "v4",
            "feature_columns": ",".join(FEATURE_COLUMNS),
            "n_features": str(len(FEATURE_COLUMNS)),
        })
        mlflow.log_params(final_params)
        mlflow.log_metric("cv_f1_best", best_cv_f1)
        mlflow.log_metric("train_positive_rate", float(y.mean()))
        mlflow.log_metric("n_train_rows", int(len(y)))

        mlflow.log_artifact(str(calibration_plot_path), artifact_path="plots")
        mlflow.log_artifact(str(meta_path), artifact_path="metadata")

        # Bundle encoder alongside the model so inference never has a path dependency.
        if encoder is not None:
            encoder_path = PROCESSED / "hub_zone_encoder.pkl"
            mlflow.log_artifact(str(encoder_path), artifact_path="encoder")

        model_info = mlflow.sklearn.log_model(
            calibrated_clf,
            artifact_path="model",
            registered_model_name=MODEL_NAME,
        )
        logger.info(
            "Model registered: run_id=%s uri=%s",
            run.info.run_id,
            model_info.model_uri,
        )

    # Promote the newly registered version to Staging.
    client = mlflow.tracking.MlflowClient()
    versions = client.get_latest_versions(MODEL_NAME, stages=["None"])
    if versions:
        version_num = versions[0].version
        client.transition_model_version_stage(
            name=MODEL_NAME,
            version=version_num,
            stage="Staging",
            archive_existing_versions=False,
        )
        logger.info("Model %s v%s promoted to Staging", MODEL_NAME, version_num)
    else:
        logger.warning("No model versions found to promote to Staging.")


if __name__ == "__main__":
    main()
