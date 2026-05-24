"""Delay model training handoff placeholder.

Backend phase 1-2 intentionally does not train LightGBM. The teammate responsible for
modeling should implement the real pipeline here:

1. Load `../../data/processed/train_features.parquet`.
2. Train LightGBM with the feature order from `ml.features.FEATURE_COLUMNS`.
3. Wrap the classifier with `CalibratedClassifierCV`.
4. Log and register the model to MLflow as `delay-predictor` in `Staging`.

The FastAPI backend already works without this file by using a deterministic fallback
predictor until a Production model exists in MLflow.
"""


def main() -> None:
    print("Training placeholder: implement LightGBM + MLflow registration here.")


if __name__ == "__main__":
    main()
