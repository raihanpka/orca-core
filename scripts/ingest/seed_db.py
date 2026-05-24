import asyncio
import os
import uuid
from datetime import timedelta
from pathlib import Path

import asyncpg
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
SHIPMENT_NAMESPACE = uuid.UUID("90f4b092-3c57-5f2e-8841-f8ff8d3468a2")


async def main() -> None:
    database_url = os.getenv("DATABASE_URL") or os.getenv("DEV_DATABASE_URL") or "postgresql://orca:orca_pass@localhost:5432/orca_db"
    stream_path = ROOT / "data/processed/simulation_stream.parquet"
    if not stream_path.exists():
        raise SystemExit("Missing data/processed/simulation_stream.parquet. Run make build-features first.")
    df = pd.read_parquet(stream_path).head(1000)
    conn = await asyncpg.connect(database_url)
    count = 0
    for _, row in df.iterrows():
        shipment_id = uuid.uuid5(SHIPMENT_NAMESPACE, str(row["order_id"]))
        dispatched_at = row["order_purchase_timestamp"].to_pydatetime()
        sla_deadline = row["order_estimated_delivery_date"].to_pydatetime()
        await conn.execute(
            """
            INSERT INTO shipments (
              id, external_id, origin_hub_id, destination_zone, vehicle_type,
              load_weight_kg, item_count, sla_deadline, dispatched_at, status, distance_km
            )
            VALUES ($1, $2, $3, $4, 'van_diesel', $5, $6, $7, $8, 'in_transit', $9)
            ON CONFLICT (external_id) DO NOTHING
            """,
            shipment_id,
            str(row["order_id"]),
            f"hub_{row['hub_zone']}",
            str(row["customer_zip_code_prefix"]),
            float(row["product_weight_g"]) / 1000 if "product_weight_g" in row else 1.0,
            int(row["item_count"] or 1),
            sla_deadline + timedelta(days=3650),
            dispatched_at + timedelta(days=3650),
            float(row["distance_km"]),
        )
        count += 1
    await conn.close()
    print(f"inserted_shipments={count}")


if __name__ == "__main__":
    asyncio.run(main())
