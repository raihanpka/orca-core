"""Export trained model from model.pkl to native LightGBM .lgbm format.

Extracts the underlying LightGBM booster from the CalibratedClassifierCV wrapper
and saves it as a portable .lgbm file. Also writes calibration metadata so the
inference wrapper can reproduce predict_proba output.

Note: CalibratedClassifierCV trains a separate LGBMClassifier per CV fold.
We export the first fold's booster as the representative (all folds share the
same hyperparameters, trained on ~80% of data each). The calibrators from all
folds are saved so predict_proba can average across them.

For maximum consistency, prefer loading model.pkl directly via the sklearn path.
The .lgbm export is useful for environments where sklearn is unavailable.

Run once before deploy (or whenever model.pkl is retrained):
    cd <repo-root>
    python scripts/export_model.py

Outputs:
    data/processed/model.lgbm          — native LightGBM booster
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

    calibrators_meta: list[dict] = []

    try:
        from sklearn.calibration import CalibratedClassifierCV

        if not isinstance(calibrated_model, CalibratedClassifierCV):
            raise TypeError("model.pkl is not a CalibratedClassifierCV")

        calibrated_classifiers = calibrated_model.calibrated_classifiers_

        first_lgbm = calibrated_classifiers[0].estimator
        booster = first_lgbm.booster_
        booster.save_model(str(lgbm_path))
        print(f"Saved LightGBM booster -> {lgbm_path}  ({lgbm_path.stat().st_size / 1e6:.1f} MB)")

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
        "model_version": "LightGBM",
        "calibration_method": "sigmoid",
        "n_folds": len(calibrators_meta),
        "calibrators": calibrators_meta,
        "feature_columns": FEATURE_COLUMNS,
        "feature_version": "v2",
        "dataset_version": "olist-jabodetabek-v2",
        "pkl_source": str(pkl_path.name),
        "note": "Single booster from fold 0; all fold calibrators saved for averaged predict_proba. For best consistency, prefer model.pkl (full sklearn ensemble).",
    }
    with meta_path.open("w") as fh:
        json.dump(meta, fh, indent=2)
    print(f"Saved model_meta.json -> {meta_path}")
    print("\nDone. Files ready for deploy:")
    print(f"  {lgbm_path}")
    print(f"  {meta_path}")
    print(f"  {PROCESSED / 'hub_zone_encoder.pkl'}")
    print(f"  {PROCESSED / 'model.pkl'}  (preferred for full ensemble)")


if __name__ == "__main__":
    main()
