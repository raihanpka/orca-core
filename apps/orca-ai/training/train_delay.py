"""Delay prediction model training pipeline.

Trains LightGBM with Optuna HPO, wraps with CalibratedClassifierCV, and saves
the model to data/processed/model.pkl.

MLflow logging is optional — if MLFLOW_TRACKING_URI is unreachable, training
proceeds without it and the model is saved locally.

Usage (from repo root):
    make train
    # or directly:
    cd apps/orca-ai && uv run python training/train_delay.py
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
    logger.info("Loaded train set: rows=%d positive_rate=%.3f features=%d", len(y), pos_rate, len(FEATURE_COLUMNS))
    logger.info("Feature columns: %s", FEATURE_COLUMNS)
    if not (0.03 <= pos_rate <= 0.50):
        logger.warning(
            "Positive rate %.3f is outside expected range [0.03, 0.50]. "
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
    ax.set_title("Calibration Curve - Delay Predictor v2 (Train Set)")
    ax.legend()
    fig.tight_layout()
    fig.savefig(output_path)
    plt.close(fig)
    logger.info("Calibration curve saved to %s", output_path)


def main() -> None:
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

    model_pkl_path = PROCESSED / "model.pkl"
    with open(model_pkl_path, "wb") as f:
        pickle.dump(calibrated_clf, f)
    logger.info("Saved model.pkl to %s", model_pkl_path)

    feature_meta = {
        "feature_columns": FEATURE_COLUMNS,
        "feature_version": "v2",
        "dataset_version": "olist-jabodetabek-v2",
        "n_features": len(FEATURE_COLUMNS),
        "training_params": final_params,
        "cv_f1_best": best_cv_f1,
        "train_rows": int(len(y)),
        "positive_rate": float(y.mean()),
    }
    meta_path = PROCESSED / "feature_metadata.json"
    with meta_path.open("w") as f:
        json.dump(feature_meta, f, indent=2, default=str)
    logger.info("Feature metadata saved to %s", meta_path)

    # Optional MLflow logging
    try:
        import mlflow
        import mlflow.sklearn
        mlflow_uri = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5001")
        mlflow.set_tracking_uri(mlflow_uri)
        mlflow.set_experiment(EXPERIMENT_NAME)

        with mlflow.start_run(run_name="lightgbm-calibrated-v2") as run:
            mlflow.set_tags({
                "dataset_version": "olist-jabodetabek-v2",
                "feature_version": "v2",
                "feature_columns": ",".join(FEATURE_COLUMNS),
            })
            mlflow.log_params(final_params)
            mlflow.log_metric("cv_f1_best", best_cv_f1)
            mlflow.log_metric("train_positive_rate", float(y.mean()))
            mlflow.log_metric("n_train_rows", int(len(y)))
            mlflow.log_artifact(str(calibration_plot_path), artifact_path="plots")
            mlflow.log_artifact(str(meta_path), artifact_path="metadata")
            if encoder is not None:
                encoder_path = PROCESSED / "hub_zone_encoder.pkl"
                mlflow.log_artifact(str(encoder_path), artifact_path="encoder")
            mlflow.sklearn.log_model(
                calibrated_clf,
                artifact_path="model",
                registered_model_name=MODEL_NAME,
            )
            logger.info("Model logged to MLflow (run_id=%s)", run.info.run_id)
    except Exception as exc:
        logger.info("MLflow logging skipped (not available): %s", exc)

    logger.info("Training complete. Model saved at %s", model_pkl_path)


if __name__ == "__main__":
    main()
