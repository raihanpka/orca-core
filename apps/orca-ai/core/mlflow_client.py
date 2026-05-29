"""
Model loading with a robust, layered priority strategy.

Load Order (first success wins):
  1. MODEL_PATH env var  →  .lgbm (native) or .pkl file at that path
  2. MLflow registry      →  if MLFLOW_TRACKING_URI is reachable
  3. Filesystem fallback  →  data/processed/model.lgbm, then model.pkl
  4. FallbackDelayModel   →  rule-based, always works
"""

from __future__ import annotations

import json
import logging
import math
import pickle
import tempfile
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Module-level cache, avoids reloading on every import cycle.
_cached_model: Any | None = None
_cached_encoder: Any | None = None
_cached_version: str | None = None


def _resolve_repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "data").exists():
            return parent
    for parent in current.parents:
        if (parent / "pyproject.toml").exists():
            return parent
    return Path.cwd()


_REPO_ROOT = _resolve_repo_root()
_PROCESSED = _REPO_ROOT / "data" / "processed"


# ---------------------------------------------------------------------------
# Fallback rule-based model (no dependencies, always available)
# ---------------------------------------------------------------------------

class FallbackDelayModel:
    """Pure-Python heuristic delay predictor.

    Used only when no trained model file is available. Feature indices match
    FEATURE_COLUMNS order defined in ml.features.
    """

    version = "fallback-v1"

    def predict_proba(self, rows: list[list[float]]) -> list[list[float]]:
        results = []
        for row in rows:
            distance    = float(row[0])
            weather     = float(row[7])
            hub_delay   = float(row[8])
            driver_rate = float(row[9])
            weight      = float(row[11])
            raw = (
                0.08
                + distance / 220
                + weather * 0.08
                + hub_delay * 0.45
                + max(0.0, 1.0 - driver_rate) * 0.3
                + min(weight / 20_000, 0.15)
            )
            prob = max(0.01, min(raw, 0.95))
            results.append([1.0 - prob, prob])
        return results


# ---------------------------------------------------------------------------
# Native LightGBM wrapper with sigmoid calibration
# ---------------------------------------------------------------------------

def _sigmoid(x: float) -> float:
    """Numerically stable sigmoid."""
    if x >= 0:
        return 1.0 / (1.0 + math.exp(-x))
    exp_x = math.exp(x)
    return exp_x / (1.0 + exp_x)


class LocalLightGBMModel:
    """Wraps a native LightGBM booster with Platt (sigmoid) calibration.

    Reproduces the same predict_proba output as CalibratedClassifierCV with
    method='sigmoid', averaged over all CV folds — without requiring sklearn.
    """

    def __init__(self, booster: Any, calibrators: list[dict], version: str = "lgbm-v1"):
        self._booster = booster
        # Each calibrator = {"a": float, "b": float}
        # Platt scaling: P = sigmoid(a * raw_score + b)
        self._calibrators = calibrators
        self.version = version

    def predict_proba(self, rows: list[list[float]]) -> list[list[float]]:
        import numpy as np

        x = np.array(rows, dtype=float)
        # LightGBM booster.predict() returns raw leaf scores (before sigmoid).
        # For binary classification this is equivalent to the log-odds.
        raw_scores = self._booster.predict(x)  # shape: (n_samples,)

        results = []
        for raw in raw_scores:
            # Average across all CV fold calibrators (same as sklearn ensemble=True)
            prob_positive = sum(
                _sigmoid(cal["a"] * float(raw) + cal["b"])
                for cal in self._calibrators
            ) / len(self._calibrators)
            prob_positive = float(max(0.0, min(1.0, prob_positive)))
            results.append([1.0 - prob_positive, prob_positive])
        return results


# ---------------------------------------------------------------------------
# Encoder helpers
# ---------------------------------------------------------------------------

def _load_encoder_from_mlflow(run_id: str) -> Any | None:
    """Try to load hub_zone_encoder.pkl from the MLflow artifact bundle."""
    try:
        import mlflow
        client = mlflow.tracking.MlflowClient()
        with tempfile.TemporaryDirectory() as tmp:
            local_path = client.download_artifacts(run_id, "encoder/hub_zone_encoder.pkl", tmp)
            with open(local_path, "rb") as fh:
                encoder = pickle.load(fh)
        logger.info("Hub zone encoder loaded from MLflow artifact (run_id=%s).", run_id)
        return encoder
    except Exception as exc:
        logger.debug("Could not load encoder from MLflow artifact: %s", exc)
        return None


def _load_encoder_from_filesystem() -> Any | None:
    """Load hub_zone_encoder.pkl from data/processed/."""
    encoder_path = _PROCESSED / "hub_zone_encoder.pkl"
    if encoder_path.exists():
        with encoder_path.open("rb") as fh:
            encoder = pickle.load(fh)
        logger.info("Hub zone encoder loaded from filesystem: %s", encoder_path)
        return encoder
    logger.warning(
        "hub_zone_encoder.pkl not found at %s — hub zone encoding will use digit fallback.",
        encoder_path,
    )
    return None


# ---------------------------------------------------------------------------
# Model loaders (each returns (model, version) or raises)
# ---------------------------------------------------------------------------

def _load_lgbm_file(path: Path) -> tuple[Any, str]:
    """Load a native .lgbm file with its companion model_meta.json."""
    import lightgbm as lgb

    meta_path = path.parent / "model_meta.json"
    if not meta_path.exists():
        raise FileNotFoundError(f"model_meta.json not found next to {path}")

    with meta_path.open() as fh:
        meta = json.load(fh)

    booster = lgb.Booster(model_file=str(path))
    calibrators = meta.get("calibrators", [{"a": -1.0, "b": 0.0}])
    version = meta.get("model_version", "lgbm-v1")
    model = LocalLightGBMModel(booster, calibrators, version=version)
    logger.info("Loaded native LightGBM model from %s (%.1f MB)", path, path.stat().st_size / 1e6)
    return model, version


def _load_pkl_file(path: Path) -> tuple[Any, str]:
    """Load a sklearn-compatible pickle model."""
    with path.open("rb") as fh:
        model = pickle.load(fh)
    version = getattr(model, "version", "pkl-v1")
    logger.info("Loaded pickle model from %s", path)
    return model, version


def _load_from_env_path() -> tuple[Any, str] | None:
    """Load model from MODEL_PATH environment variable if set."""
    import os
    env_path = os.environ.get("MODEL_PATH", "").strip()
    if not env_path:
        return None
    path = Path(env_path)
    if not path.exists():
        logger.warning("MODEL_PATH=%s set but file not found — skipping.", path)
        return None
    if path.suffix == ".lgbm":
        return _load_lgbm_file(path)
    if path.suffix == ".pkl":
        return _load_pkl_file(path)
    logger.warning("MODEL_PATH=%s has unrecognised extension — skipping.", path)
    return None


def _load_from_mlflow() -> tuple[Any, str, str | None] | None:
    """Load model from MLflow registry. Returns (model, version, run_id) or None."""
    try:
        import mlflow
        import mlflow.sklearn

        from core.config import get_settings
        settings = get_settings()
        mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
        model_uri = f"models:/{settings.mlflow_model_name}/{settings.mlflow_model_stage}"
        model = mlflow.sklearn.load_model(model_uri)
        version = f"{settings.mlflow_model_name}:{settings.mlflow_model_stage}"
        logger.info("Model loaded from MLflow registry: %s", version)

        client = mlflow.tracking.MlflowClient()
        mv_list = client.get_latest_versions(
            settings.mlflow_model_name, stages=[settings.mlflow_model_stage]
        )
        run_id = mv_list[0].run_id if mv_list else None
        return model, version, run_id
    except Exception as exc:
        logger.debug("MLflow model load failed (this is expected if MLflow is not running): %s", exc)
        return None


def _load_from_filesystem() -> tuple[Any, str] | None:
    """Try .lgbm first, then .pkl from data/processed/."""
    lgbm_path = _PROCESSED / "model.lgbm"
    if lgbm_path.exists():
        try:
            return _load_lgbm_file(lgbm_path)
        except Exception as exc:
            logger.warning("Failed to load %s: %s — trying model.pkl", lgbm_path, exc)

    pkl_path = _PROCESSED / "model.pkl"
    if pkl_path.exists():
        try:
            return _load_pkl_file(pkl_path)
        except Exception as exc:
            logger.warning("Failed to load %s: %s", pkl_path, exc)

    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_production_model() -> tuple[Any, Any | None, str]:
    """Load the delay prediction model using a layered priority strategy.

    Priority:
      1. MODEL_PATH env var  (.lgbm or .pkl)
      2. MLflow registry     (if reachable)
      3. data/processed/     (model.lgbm → model.pkl)
      4. FallbackDelayModel  (rule-based, always works)

    Returns:
        (model, encoder, version_string)
    """
    global _cached_model, _cached_encoder, _cached_version

    model: Any | None = None
    version: str = "fallback-v1"
    run_id: str | None = None

    # Priority 1: explicit MODEL_PATH env var
    result = _load_from_env_path()
    if result is not None:
        model, version = result
        logger.info("Using model from MODEL_PATH env var (version=%s)", version)

    # Priority 2: MLflow registry (optional — skipped silently if unreachable)
    if model is None:
        mlflow_result = _load_from_mlflow()
        if mlflow_result is not None:
            model, version, run_id = mlflow_result

    # Priority 3: local filesystem (model.lgbm / model.pkl)
    if model is None:
        fs_result = _load_from_filesystem()
        if fs_result is not None:
            model, version = fs_result

    # Priority 4: rule-based fallback
    if model is None:
        logger.warning(
            "No trained model found. Using FallbackDelayModel (rule-based heuristic). "
            "Set MODEL_PATH or ensure data/processed/model.lgbm exists."
        )
        model = FallbackDelayModel()
        version = model.version

    # Load encoder: prefer MLflow-bundled artifact, then filesystem
    encoder = (
        _load_encoder_from_mlflow(run_id) if run_id else None
    ) or _load_encoder_from_filesystem()

    _cached_model = model
    _cached_encoder = encoder
    _cached_version = version
    return model, encoder, version


def get_model() -> tuple[Any, Any | None, str]:
    """Return cached model (load on first call)."""
    if _cached_model is None:
        return load_production_model()
    return _cached_model, _cached_encoder, _cached_version or "unknown"
