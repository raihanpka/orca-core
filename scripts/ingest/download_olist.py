import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def main() -> None:
    target = ROOT / "data/raw/olist"
    target.mkdir(parents=True, exist_ok=True)
    if not os.getenv("KAGGLE_USERNAME") or not os.getenv("KAGGLE_KEY"):
        raise SystemExit("KAGGLE_USERNAME and KAGGLE_KEY are required to download Olist data.")
    import kaggle
    import pandas as pd

    kaggle.api.dataset_download_files("olistbr/brazilian-ecommerce", path=target, unzip=True)
    for csv_path in sorted(target.glob("*.csv")):
        df = pd.read_csv(csv_path, nrows=5)
        print(f"{csv_path.name}: sample_shape={df.shape} columns={list(df.columns)}")


if __name__ == "__main__":
    main()
