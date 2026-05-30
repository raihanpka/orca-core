"""Download Delhivery logistics dataset from Kaggle.

Requires KAGGLE_USERNAME and KAGGLE_KEY environment variables.
Downloads to data/raw/delhivery/.

Usage (from repo root):
    make download-delhivery
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    target = ROOT / "data/raw/delhivery"
    target.mkdir(parents=True, exist_ok=True)
    if not os.getenv("KAGGLE_USERNAME") or not os.getenv("KAGGLE_KEY"):
        raise SystemExit(
            "KAGGLE_USERNAME and KAGGLE_KEY are required.\n"
            "Alternatively, download manually from https://www.kaggle.com/datasets/nayanack/delhivery\n"
            f"and place the CSV in {target}/"
        )
    import kaggle

    kaggle.api.dataset_download_files("nayanack/delhivery", path=target, unzip=True)
    for csv_path in sorted(target.glob("*.csv")):
        import pandas as pd
        df = pd.read_csv(csv_path, nrows=5)
        print(f"{csv_path.name}: shape={df.shape} columns={list(df.columns)}")


if __name__ == "__main__":
    main()
