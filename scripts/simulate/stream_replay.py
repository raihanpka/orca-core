import asyncio
import json
import os
import uuid
from pathlib import Path

import pandas as pd
from redis import asyncio as aioredis

ROOT = Path(__file__).resolve().parents[2]
SHIPMENT_NAMESPACE = uuid.UUID("90f4b092-3c57-5f2e-8841-f8ff8d3468a2")


async def main() -> None:
    redis_url = os.getenv("REDIS_URL") or os.getenv("DEV_REDIS_URL") or "redis://localhost:6379"
    speed = float(os.getenv("REPLAY_SPEED_FACTOR", "60"))
    path = ROOT / "data/processed/simulation_stream.parquet"
    if not path.exists():
        raise SystemExit("Missing simulation stream. Run make build-features first.")
    df = pd.read_parquet(path).sort_values("order_purchase_timestamp")
    redis = aioredis.from_url(redis_url, decode_responses=True)
    previous = None
    for index, row in df.iterrows():
        current = row["order_purchase_timestamp"]
        if previous is not None:
            wait = max((current - previous).total_seconds() / speed, 0)
            await asyncio.sleep(min(wait, 1.0))
        payload = row.to_dict()
        payload["shipment_id"] = str(uuid.uuid5(SHIPMENT_NAMESPACE, str(payload.get("order_id"))))
        payload["external_id"] = str(payload.get("order_id"))
        payload["hub_zone"] = str(payload.get("hub_zone", "000"))
        for key, value in list(payload.items()):
            if hasattr(value, "isoformat"):
                payload[key] = value.isoformat()
        await redis.publish("orca:events:shipments", json.dumps(payload, default=str))
        if (index + 1) % 100 == 0:
            print(f"published={index + 1}")
        previous = current
    await redis.aclose()


if __name__ == "__main__":
    asyncio.run(main())
