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

HUBS = ["hub_jakarta_selatan", "hub_jakarta_utara", "hub_bogor", "hub_depok"]
VEHICLES = ["van_diesel", "truck_lt35t", "truck_35_75t", "truck_gt75t", "scooter_electric"]

async def main() -> None:
    database_url = os.getenv("DATABASE_URL") or os.getenv("DEV_DATABASE_URL") or "postgresql://orca:orca_pass@localhost:5432/orca_db"
    conn = await asyncpg.connect(database_url)
    
    print("🚀 Memulai simulasi streaming data pengiriman (Cron) secara real-time...")
    print("Tekan Ctrl+C untuk menghentikan stream.")
    
    count = 0
    try:
        while True:
            now = datetime.now()
            loc = random.choice(DESTINATIONS)
            
            ext_id = f"STRM-{now.strftime('%H%M%S')}-{random.randint(100, 999)}"
            shipment_id = uuid.uuid5(SHIPMENT_NAMESPACE, ext_id)
            
            # SLA 2 to 48 hours from now
            hours_to_sla = random.randint(2, 48)
            sla_deadline = now + timedelta(hours=hours_to_sla)
            
            # Add some jitter to coordinates for variety even in same district
            jitter_lat = random.uniform(-0.01, 0.01)
            jitter_lng = random.uniform(-0.01, 0.01)
            
            weight_kg = round(random.uniform(0.5, 25.0), 1)
            distance_km = round(random.uniform(5.0, 50.0), 1)
            
            await conn.execute(
                """
                INSERT INTO shipments (
                  id, external_id, origin_hub_id, destination_zone, customer_lat, customer_lng, 
                  vehicle_type, load_weight_kg, item_count, sla_deadline, dispatched_at, status, distance_km
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'in_transit', $12)
                ON CONFLICT (external_id) DO NOTHING
                """,
                shipment_id,
                ext_id,
                random.choice(HUBS),
                loc["zone"],
                loc["lat"] + jitter_lat,
                loc["lng"] + jitter_lng,
                random.choice(VEHICLES),
                weight_kg,
                random.randint(1, 5),
                sla_deadline,
                now, 
                distance_km,
            )
            count += 1
            print(f"[{now.strftime('%H:%M:%S')}] ✅ Streamed 1 shipment ke {loc['zone']} (SLA: {hours_to_sla}h)")
            
            # Simulate real-time delay (e.g., 30 minutes in reality, but for testing we can make it faster like 30s)
            # The user runs this via cron maybe? Or just background. We will use a random delay between 15s - 60s for demo.
            sleep_time = random.randint(15, 60)
            await asyncio.sleep(sleep_time)
            
    except KeyboardInterrupt:
        print("\nStreaming dihentikan.")
    finally:
        await conn.close()
        print(f"Total data disimulasikan: {count}")

if __name__ == "__main__":
    asyncio.run(main())
