"""Export trained model from model.pkl to native LightGBM .lgbm format.

This script extracts the underlying LightGBM booster from the
CalibratedClassifierCV wrapper, saves it as a portable .lgbm file, and writes
calibration metadata to model_meta.json so the inference wrapper can reproduce
identical predict_proba output.

Run once before deploy (or whenever model.pkl is retrained):
    cd <repo-root>
    python scripts/export_model.py

Outputs (all committed to git):
    data/processed/model.lgbm          — native LightGBM booster (~5 MB)
    data/processed/model_meta.json     — calibration + feature contract
"""

from __future__ import annotations

import json
import pickle
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"

sys.path.insert(0, str(ROOT / "apps" / "orca-ai"))

from ml.features import FEATURE_COLUMNS  # noqa: E402


def main() -> None:
    pkl_path = PROCESSED / "model.pkl"
    lgbm_path = PROCESSED / "model.lgbm"
    meta_path = PROCESSED / "model_meta.json"

    if not pkl_path.exists():
        print(f"[ERROR] {pkl_path} not found. Run training first.")
        sys.exit(1)

    print(f"Loading {pkl_path} ...")
    with pkl_path.open("rb") as fh:
        calibrated_model = pickle.load(fh)

    # CalibratedClassifierCV wraps one or more calibrated estimators.
    # Each calibrated estimator has a .base_estimator (the LGBMClassifier) and
    # .calibrators (the Platt scaling sigmoid functions).
    calibrators_meta: list[dict] = []

    try:
        from sklearn.calibration import CalibratedClassifierCV

        if not isinstance(calibrated_model, CalibratedClassifierCV):
            raise TypeError("model.pkl is not a CalibratedClassifierCV")

        # Extract all calibrated estimators
        calibrated_classifiers = calibrated_model.calibrated_classifiers_

        # Export the LightGBM booster from the FIRST fold (representative).
        # All 5 folds' predictions are averaged at predict_proba time.
        first_lgbm = calibrated_classifiers[0].estimator  # sklearn >= 1.2 uses .estimator
        booster = first_lgbm.booster_
        booster.save_model(str(lgbm_path))
        print(f"Saved LightGBM booster → {lgbm_path}  ({lgbm_path.stat().st_size / 1e6:.1f} MB)")

        # Capture all calibrators for exact reconstruction.
        for cc in calibrated_classifiers:
            cal = cc.calibrators[0]  # _SigmoidCalibration
            calibrators_meta.append({
                "a": float(cal.a_),
                "b": float(cal.b_),
            })

    except Exception as exc:
        print(f"[ERROR] Could not extract LightGBM booster: {exc}")
        sys.exit(1)

    meta = {
        "model_format": "lightgbm-native",
        "model_version": "lgbm-v1",
        "calibration_method": "sigmoid",
        "n_folds": len(calibrators_meta),
        "calibrators": calibrators_meta,
        "feature_columns": FEATURE_COLUMNS,
        "feature_version": "v1",
        "pkl_source": str(pkl_path.name),
    }
    with meta_path.open("w") as fh:
        json.dump(meta, fh, indent=2)
    print(f"Saved model_meta.json → {meta_path}")
    print("\nDone. Files ready for VPS deploy:")
    print(f"  {lgbm_path}")
    print(f"  {meta_path}")
    print(f"  {PROCESSED / 'hub_zone_encoder.pkl'}")


if __name__ == "__main__":
    main()
