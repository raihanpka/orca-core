import asyncio
import os
import uuid
from datetime import datetime, timedelta

import asyncpg

async def main() -> None:
    database_url = os.getenv("DATABASE_URL") or os.getenv("DEV_DATABASE_URL") or "postgresql://orca:orca_pass@localhost:5432/orca_db"
    conn = await asyncpg.connect(database_url)
    
    # Generate 10 dummy active shipments
    destinations = ["Cikarang Barat", "Sunter Agung", "Bogor Selatan", "Depok Jaya", "Bekasi Timur", "Tangerang Kota", "Cibubur", "Pluit", "Kebayoran Baru", "Kelapa Gading"]
    count = 0
    now = datetime.now()
    
    for i in range(10):
        shipment_id = uuid.uuid4()
        external_id = f"ORCA-JKT-{1000 + i}"
        hub = "hub_cakung"
        zone = destinations[i]
        dispatched_at = now - timedelta(hours=i)
        sla_deadline = now + timedelta(hours=48 - i)
        
        await conn.execute(
            """
            INSERT INTO shipments (
              id, external_id, origin_hub_id, destination_zone, vehicle_type,
              load_weight_kg, item_count, sla_deadline, dispatched_at, status, distance_km
            )
            VALUES ($1, $2, $3, $4, 'van_diesel', $5, $6, $7, $8, 'in_transit', $9)
            ON CONFLICT (external_id) DO NOTHING
            """,
            shipment_id, external_id, hub, zone, 
            float(10 + i), i + 1, sla_deadline, dispatched_at, float(25 + i * 2)
        )
        count += 1
        
    await conn.close()
    print(f"Successfully inserted {count} active fake shipments for UI demonstration!")

if __name__ == "__main__":
    asyncio.run(main())
