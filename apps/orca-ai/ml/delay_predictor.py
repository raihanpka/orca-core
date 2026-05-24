from typing import Any

from ml.features import FEATURE_COLUMNS, build_feature_vector


class DelayPredictor:
    def __init__(self, model: Any, label_encoder: Any | None = None, model_version: str = "unknown"):
        self.model = model
        self.label_encoder = label_encoder
        self.model_version = model_version

    def predict(self, features: dict) -> dict[str, float | str]:
        vector = build_feature_vector(features, self.label_encoder)
        row = [[vector[column] for column in FEATURE_COLUMNS]]
        proba = self.model.predict_proba(row)[0]
        delay_probability = float(proba[1])
        predicted_delay_hours = round(delay_probability * max(features.get("estimated_delivery_days", 2.0), 0.5) * 24, 2)
        return {
            "delay_probability": round(delay_probability, 4),
            "predicted_delay_hours": predicted_delay_hours,
            "model_version": self.model_version,
        }
