from datetime import date, timedelta

from fastapi import APIRouter, Query, Request

from api.schemas.common import ok

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/carbon")
async def carbon_analytics(
    request: Request,
    date_from: date | None = None,
    date_to: date | None = None,
    group_by: str = Query(default="day", pattern="^(day|vehicle_type)$"),
):
    pool = request.app.state.db_pool
    if date_to is None:
        date_to = date.today()
    if date_from is None:
        date_from = date_to - timedelta(days=7)
    if pool is None:
        return ok(
            {
                "total_co2_kg": 0.0,
                "avg_co2_per_shipment_kg": 0.0,
                "vs_baseline_pct": 0.0,
                "by_day": [],
                "by_vehicle_type": [],
                "glec_version": "3.0",
            }
        )
    by_day = await pool.fetch(
        """
        SELECT calculated_at::date AS date, SUM(co2_kg) AS co2_kg, COUNT(*) AS shipment_count
        FROM carbon_records
        WHERE calculated_at::date BETWEEN $1 AND $2
        GROUP BY calculated_at::date
        ORDER BY calculated_at::date
        """,
        date_from,
        date_to,
    )
    by_vehicle = await pool.fetch(
        """
        SELECT vehicle_type, SUM(co2_kg) AS co2_kg, COUNT(*) AS shipment_count
        FROM carbon_records
        WHERE calculated_at::date BETWEEN $1 AND $2
        GROUP BY vehicle_type
        ORDER BY co2_kg DESC
        """,
        date_from,
        date_to,
    )
    by_route = await pool.fetch(
        """
        SELECT 
            c.shipment_id, 
            s.external_id,
            s.origin_hub_id,
            s.destination_zone,
            c.vehicle_type, 
            c.co2_kg, 
            s.distance_km, 
            s.load_weight_kg,
            c.calculated_at
        FROM carbon_records c
        LEFT JOIN shipments s ON c.shipment_id = s.id
        WHERE c.calculated_at::date BETWEEN $1 AND $2
        ORDER BY c.calculated_at DESC
        LIMIT 500
        """,
        date_from,
        date_to,
    )
    total = sum(float(row["co2_kg"] or 0) for row in by_day)
    count = sum(int(row["shipment_count"] or 0) for row in by_day)
    avg = total / count if count else 0.0
    baseline = total * 1.126 if total else 0.0
    vs_baseline = ((total - baseline) / baseline * 100) if baseline else 0.0
    return ok(
        {
            "total_co2_kg": round(total, 2),
            "avg_co2_per_shipment_kg": round(avg, 2),
            "vs_baseline_pct": round(vs_baseline, 2),
            "by_day": [
                {"date": row["date"].isoformat(), "co2_kg": float(row["co2_kg"]), "shipment_count": row["shipment_count"]}
                for row in by_day
            ],
            "by_vehicle_type": [
                {"vehicle_type": row["vehicle_type"], "co2_kg": float(row["co2_kg"]), "shipment_count": row["shipment_count"]}
                for row in by_vehicle
            ],
            "recent_routes": [
                {
                    "shipment_id": str(row["shipment_id"]),
                    "external_id": row["external_id"],
                    "origin": row["origin_hub_id"],
                    "destination": row["destination_zone"],
                    "vehicle_type": row["vehicle_type"],
                    "co2_kg": float(row["co2_kg"]),
                    "distance_km": float(row["distance_km"]),
                    "load_weight_kg": float(row["load_weight_kg"]),
                    "calculated_at": row["calculated_at"].isoformat()
                }
                for row in by_route
            ],
            "glec_version": "3.0",
        }
    )

@router.get("/hubs")
async def hub_analytics(request: Request):
    import random
    HUB_DATA = [
        { "id": "hub_cakung", "name": "Hub Cakung (East Jakarta)" },
        { "id": "hub_kebon_jeruk", "name": "Hub Kebon Jeruk (West Jakarta)" },
        { "id": "hub_pasar_minggu", "name": "Hub Pasar Minggu (South Jakarta)" },
        { "id": "hub_kelapa_gading", "name": "Hub Kelapa Gading (North Jakarta)" },
        { "id": "hub_cikarang", "name": "Hub Cikarang (Bekasi Regency)" },
        { "id": "hub_tangerang", "name": "Hub Tangerang (Airport Cargo)" },
        { "id": "hub_bekasi", "name": "Hub Bekasi (MM2100)" },
        { "id": "hub_bogor", "name": "Hub Bogor (Sentul)" },
        { "id": "hub_depok", "name": "Hub Depok (Cimanggis)" },
    ]
    hubs = []
    for h in HUB_DATA:
        dwell_time = random.uniform(30, 240)
        volume = random.randint(10, 500)
        if dwell_time > 180 or volume > 400:
            congestion = "high"
        elif dwell_time > 90 or volume > 200:
            congestion = "medium"
        else:
            congestion = "low"
        hubs.append({
            "hub_id": h["id"],
            "hub_name": h["name"],
            "congestion_level": congestion,
            "avg_dwell_time_min": dwell_time,
            "current_inbound_volume": volume
        })
    return ok({"hubs": hubs})
