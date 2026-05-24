"""Delay model evaluation handoff placeholder.

The modeling owner should implement:

1. Load `models:/delay-predictor/Staging` from MLflow.
2. Evaluate against `../../data/processed/test_features.parquet`.
3. Print F1, precision, recall, AUC-ROC, and calibration error.
4. Promote to `Production` only when the agreed threshold is met.
"""


def main() -> None:
    print("Evaluation placeholder: implement model validation and promotion here.")


if __name__ == "__main__":
    main()
