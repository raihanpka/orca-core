import logging
import pickle
import tempfile
from pathlib import Path
from typing import Any

import mlflow
import mlflow.sklearn

from core.config import get_settings

logger = logging.getLogger(__name__)
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


class FallbackDelayModel:
    version = "fallback-v1"

    def predict_proba(self, rows):
        probabilities = []
        for row in rows:
            distance = float(row[0])
            weather = float(row[7])
            hub_delay = float(row[8])
            driver_rate = float(row[9])
            weight = float(row[11])
            raw = 0.08 + distance / 220 + weather * 0.08 + hub_delay * 0.45
            raw += max(0.0, 1.0 - driver_rate) * 0.3 + min(weight / 20000, 0.15)
            prob = max(0.01, min(raw, 0.95))
            probabilities.append([1.0 - prob, prob])
        return probabilities


def _load_encoder_from_mlflow(run_id: str) -> Any | None:
    """Try to load hub_zone_encoder.pkl from the MLflow artifact bundle.

    The encoder was logged under artifact_path='encoder/' during training,
    so it travels with the model and doesn't require a separate file on disk.
    """
    try:
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
    """Fall back to the encoder written by build_features.py at the repo root."""
    encoder_path = _REPO_ROOT / "data" / "processed" / "hub_zone_encoder.pkl"
    if encoder_path.exists():
        with encoder_path.open("rb") as fh:
            encoder = pickle.load(fh)
        logger.info("Hub zone encoder loaded from filesystem: %s", encoder_path)
        return encoder
    logger.warning("hub_zone_encoder.pkl not found at %s. Hub zone encoding will use digit fallback.", encoder_path)
    return None


def load_production_model() -> tuple[Any, Any | None, str]:
    global _cached_model, _cached_encoder, _cached_version
    settings = get_settings()
    if settings.demo_mode:
        encoder = _load_encoder_from_filesystem()
        
        # Try loading a pre-trained pickle model provided by data scientist friend
        model_pkl_path = _REPO_ROOT / "data" / "processed" / "model.pkl"
        if model_pkl_path.exists():
            with model_pkl_path.open("rb") as fh:
                model = pickle.load(fh)
            logger.info("Loaded production model from %s", model_pkl_path)
            model.version = "pkl-v1"
        else:
            logger.info("Using FallbackDelayModel (hardcoded formula). Pickle model not found at %s", model_pkl_path)
            model = FallbackDelayModel()
            
        _cached_model = model
        _cached_encoder = encoder
        _cached_version = getattr(model, "version", "fallback-v1")
        return model, encoder, _cached_version

    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    model_uri = f"models:/{settings.mlflow_model_name}/{settings.mlflow_model_stage}"

    run_id: str | None = None
    try:
        model = mlflow.sklearn.load_model(model_uri)
        version = f"{settings.mlflow_model_name}:{settings.mlflow_model_stage}"
        logger.info("LightGBM model loaded: %s", version)
        # Retrieve run_id so we can fetch the bundled encoder artifact.
        client = mlflow.tracking.MlflowClient()
        mv_list = client.get_latest_versions(settings.mlflow_model_name, stages=[settings.mlflow_model_stage])
        if mv_list:
            run_id = mv_list[0].run_id
    except Exception as exc:
        model = FallbackDelayModel()
        version = model.version
        logger.warning("Using fallback delay model because MLflow model is unavailable: %s", exc)

    # Load encoder: prefer the MLflow-bundled artifact; fall back to disk.
    encoder = (
        _load_encoder_from_mlflow(run_id)
        if run_id is not None
        else None
    ) or _load_encoder_from_filesystem()

    _cached_model = model
    _cached_encoder = encoder
    _cached_version = version
    return model, encoder, version


def get_model() -> tuple[Any, Any | None, str]:
    if _cached_model is None:
        return load_production_model()
    return _cached_model, _cached_encoder, _cached_version or "unknown"
