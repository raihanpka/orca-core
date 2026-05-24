import logging
import pickle
from pathlib import Path
from typing import Any

import mlflow
import mlflow.sklearn

from core.config import get_settings

logger = logging.getLogger(__name__)
_cached_model: Any | None = None
_cached_encoder: Any | None = None
_cached_version: str | None = None


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


def load_production_model() -> tuple[Any, Any | None, str]:
    global _cached_model, _cached_encoder, _cached_version
    settings = get_settings()
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    model_uri = f"models:/{settings.mlflow_model_name}/{settings.mlflow_model_stage}"

    try:
        model = mlflow.sklearn.load_model(model_uri)
        version = f"{settings.mlflow_model_name}:{settings.mlflow_model_stage}"
        logger.info("LightGBM model loaded: %s", version)
    except Exception as exc:
        model = FallbackDelayModel()
        version = model.version
        logger.warning("Using fallback delay model because MLflow model is unavailable: %s", exc)

    encoder_path = Path("data/processed/hub_zone_encoder.pkl")
    encoder = None
    if encoder_path.exists():
        with encoder_path.open("rb") as fh:
            encoder = pickle.load(fh)

    _cached_model = model
    _cached_encoder = encoder
    _cached_version = version
    return model, encoder, version


def get_model() -> tuple[Any, Any | None, str]:
    if _cached_model is None:
        return load_production_model()
    return _cached_model, _cached_encoder, _cached_version or "unknown"
