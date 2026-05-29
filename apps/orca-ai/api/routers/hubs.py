from fastapi import APIRouter, Query, Request

from api.schemas.common import ok

router = APIRouter(prefix="/analytics", tags=["analytics"])

_VEHICLE_CAPACITY = {
    "motorcycle": 20,
    "van": 80,
    "truck": 200,
    "electric_van": 70,
}


def congestion_level(avg_dwell_time_min: float, delay_rate: float) -> str:
    if avg_dwell_time_min > 60 and delay_rate > 0.25:
        return "high"
    if avg_dwell_time_min > 40:
        return "medium"
    return "low"


@router.get("/hubs")
async def hubs(request: Request, hours: int = Query(default=6, ge=1, le=168)):
    pool = request.app.state.db_pool
    if pool is None:
        return ok({"hubs": []})
    rows = await pool.fetch(
        """
        SELECT DISTINCT ON (hub_id)
          hub_id, inbound_volume, avg_dwell_time_min, delay_rate, active_shipments, time
        FROM hub_metrics
        WHERE time >= NOW() - ($1::int * INTERVAL '1 hour')
        ORDER BY hub_id, time DESC
        """,
        hours,
    )
    output = []
    for row in rows:
        dwell = float(row["avg_dwell_time_min"] or 0)
        delay_rate = float(row["delay_rate"] or 0)
        level = congestion_level(dwell, delay_rate)
        output.append(
            {
                "hub_id": row["hub_id"],
                "hub_name": row["hub_id"].replace("_", " ").title(),
                "current_inbound_volume": row["inbound_volume"],
                "avg_dwell_time_min": dwell,
                "delay_rate_7d": delay_rate,
                "congestion_level": level,
                "alert": level == "high",
            }
        )
    return ok({"hubs": output})


@router.get("/fleet")
async def fleet_utilization(request: Request, hours: int = Query(default=6, ge=1, le=168)):
    """Fleet utilization summary derived from active shipment and hub metrics."""
    pool = request.app.state.db_pool
    if pool is None:
        return ok({"vehicles": [], "summary": {"total_active": 0, "avg_utilization_pct": 0.0, "high_load_count": 0}})

    rows = await pool.fetch(
        """
        SELECT
            s.vehicle_type,
            COUNT(*) AS active_count,
            AVG(s.load_weight_kg) AS avg_load_kg,
            AVG(EXTRACT(EPOCH FROM (NOW() - s.dispatched_at)) / 3600) AS avg_hours_active
        FROM shipments s
        WHERE s.status IN ('in_transit', 'at_hub')
          AND s.dispatched_at >= NOW() - ($1::int * INTERVAL '1 hour')
        GROUP BY s.vehicle_type
        ORDER BY active_count DESC
        """,
        hours,
    )

    vehicles = []
    total_active = 0
    utilization_sum = 0.0
    high_load_count = 0

    for row in rows:
        vtype = row["vehicle_type"] or "van"
        capacity = _VEHICLE_CAPACITY.get(vtype, 80)
        avg_load = float(row["avg_load_kg"] or 0)
        utilization = min(round(avg_load / capacity * 100, 1), 100.0)
        count = int(row["active_count"] or 0)
        total_active += count
        utilization_sum += utilization * count
        if utilization >= 80:
            high_load_count += 1
        vehicles.append({
            "vehicle_type": vtype,
            "active_count": count,
            "avg_load_kg": round(avg_load, 1),
            "capacity_kg": capacity,
            "utilization_pct": utilization,
            "avg_hours_active": round(float(row["avg_hours_active"] or 0), 1),
        })

    avg_utilization = round(utilization_sum / total_active, 1) if total_active else 0.0
    return ok({
        "vehicles": vehicles,
        "summary": {
            "total_active": total_active,
            "avg_utilization_pct": avg_utilization,
            "high_load_count": high_load_count,
        },
    })
