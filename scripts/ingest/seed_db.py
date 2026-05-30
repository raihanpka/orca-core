import asyncio
import os
import uuid
import random
from datetime import datetime, timedelta

import asyncpg

SHIPMENT_NAMESPACE = uuid.UUID("90f4b092-3c57-5f2e-8841-f8ff8d3468a2")

DESTINATIONS = [
    {"zone": "Kecamatan Tebet, Jakarta Selatan", "lat": -6.2263, "lng": 106.8580},
    {"zone": "Kecamatan Gambir, Jakarta Pusat", "lat": -6.1754, "lng": 106.8272},
    {"zone": "Kecamatan Kelapa Gading, Jakarta Utara", "lat": -6.1581, "lng": 106.9080},
    {"zone": "Kecamatan Cengkareng, Jakarta Barat", "lat": -6.1469, "lng": 106.7328},
    {"zone": "Kecamatan Jatinegara, Jakarta Timur", "lat": -6.2291, "lng": 106.8741},
    {"zone": "Kecamatan Bogor Tengah, Kota Bogor", "lat": -6.5944, "lng": 106.7891},
    {"zone": "Kecamatan Cibinong, Kabupaten Bogor", "lat": -6.4719, "lng": 106.8519},
    {"zone": "Kecamatan Beji, Kota Depok", "lat": -6.3711, "lng": 106.8242},
    {"zone": "Kecamatan Sawangan, Kota Depok", "lat": -6.4020, "lng": 106.7589},
    {"zone": "Kecamatan Serpong, Tangerang Selatan", "lat": -6.3043, "lng": 106.6669},
    {"zone": "Kecamatan Ciputat, Tangerang Selatan", "lat": -6.3113, "lng": 106.7455},
    {"zone": "Kecamatan Batuceper, Kota Tangerang", "lat": -6.1561, "lng": 106.6617},
    {"zone": "Kecamatan Bekasi Barat, Kota Bekasi", "lat": -6.2335, "lng": 106.9740},
    {"zone": "Kecamatan Tambun Selatan, Bekasi", "lat": -6.2625, "lng": 107.0601},
    {"zone": "Kecamatan Cikarang Pusat, Bekasi", "lat": -6.3688, "lng": 107.1643},
]

HUBS = ["hub_cakung", "hub_kebon_jeruk", "hub_pasar_minggu", "hub_kelapa_gading", "hub_cikarang", "hub_tangerang", "hub_bekasi", "hub_bogor", "hub_depok"]
VEHICLES = ["van_diesel", "truck_lt35t", "truck_35_75t", "truck_gt75t", "scooter_electric"]

async def main() -> None:
    database_url = os.getenv("DEV_DATABASE_URL") or os.getenv("DATABASE_URL") or "postgresql://orca:orca_pass@localhost:5439/orca_db"
    conn = await asyncpg.connect(database_url)
    
    seed_count = 30
    records = []
    now = datetime.now()
    
    for i in range(seed_count):
        loc = random.choice(DESTINATIONS)
        ext_id = f"BLI-S00{i+1}"
        shipment_id = uuid.uuid5(SHIPMENT_NAMESPACE, ext_id)
        
        if random.random() < 0.8:
            hours_to_sla = random.randint(24, 72)
            dispatched_ago = random.randint(1, 12)
        else:
            hours_to_sla = random.randint(2, 6)
            dispatched_ago = random.randint(5, 12)
            
        sla_deadline = now + timedelta(hours=hours_to_sla)
        jitter_lat = random.uniform(-0.01, 0.01)
        jitter_lng = random.uniform(-0.01, 0.01)
        
        weight_kg = round(random.uniform(1.5, 50.0), 1)
        distance_km = round(random.uniform(5.0, 45.0), 1)
        
        records.append((
            shipment_id, ext_id, random.choice(HUBS), loc["zone"],
            loc["lat"] + jitter_lat, loc["lng"] + jitter_lng,
            random.choice(VEHICLES), weight_kg, random.randint(1, 10),
            sla_deadline, now - timedelta(hours=dispatched_ago),
            'in_transit', distance_km
        ))

    # Fast batch insert using executemany with a single transaction
    async with conn.transaction():
        await conn.executemany(
            """
            INSERT INTO shipments (
              id, external_id, origin_hub_id, destination_zone, customer_lat, customer_lng, 
              vehicle_type, load_weight_kg, item_count, sla_deadline, dispatched_at, status, distance_km
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (external_id) DO NOTHING
            """,
            records
        )
        
    await conn.close()
    print(f"Berhasil menyisipkan {len(records)} seed data awal secara batch!")

if __name__ == "__main__":
    asyncio.run(main())
