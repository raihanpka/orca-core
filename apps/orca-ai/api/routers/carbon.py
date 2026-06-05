from datetime import date, timedelta

from fastapi import APIRouter, Query, Request

from api.schemas.common import ok
from api.routers.hubs import HUB_DATA

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
                "recent_routes": [],
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
    recent_routes = await pool.fetch(
        """
        SELECT
            s.id AS shipment_id,
            s.external_id,
            s.origin_hub_id AS origin,
            s.destination_zone AS destination,
            s.vehicle_type,
            s.load_weight_kg,
            c.co2_kg,
            s.distance_km,
            c.calculated_at,
            s.sla_deadline,
            (SELECT delay_probability FROM shipment_predictions sp WHERE sp.shipment_id = s.id ORDER BY time DESC LIMIT 1) as delay_probability
        FROM shipments s
        JOIN carbon_records c ON c.shipment_id = s.id
        WHERE c.calculated_at::date BETWEEN $1 AND $2
        ORDER BY s.dispatched_at DESC, s.id
        LIMIT 100
        """,
        date_from,
        date_to,
    )
    total = sum(float(row["co2_kg"] or 0) for row in by_day)
    count = sum(int(row["shipment_count"] or 0) for row in by_day)
    avg = total / count if count else 0.0
    baseline = total * 1.126 if total else 0.0
    vs_baseline = ((total - baseline) / baseline * 100) if baseline else 0.0
    from core.config import get_settings
    from api.routers.shipments import _live_sla_risk
    
    amplifier = get_settings().sla_risk_amplifier
    
    processed_routes = []
    for row in recent_routes:
        delay_prob = float(row["delay_probability"]) if row["delay_probability"] is not None else None
        risk = _live_sla_risk(row, delay_prob, amplifier)
        processed_routes.append({
            "shipment_id": str(row["shipment_id"]),
            "external_id": row["external_id"] or "",
            "origin": row["origin"],
            "destination": row["destination"],
            "vehicle_type": row["vehicle_type"],
            "co2_kg": float(row["co2_kg"]),
            "distance_km": float(row["distance_km"]),
            "load_weight_kg": float(row["load_weight_kg"] or 0),
            "calculated_at": row["calculated_at"].isoformat() if row["calculated_at"] else None,
            "sla_risk_score": risk
        })

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
            "recent_routes": processed_routes,
            "glec_version": "3.0",
        }
    )


@router.get("/hubs")
async def hub_analytics(request: Request):
    """Hub congestion and dwell time analytics for the Hub Health dashboard tab."""
    pool = request.app.state.db_pool

    # Build a name lookup from the static hub list
    hub_names = {h["id"]: h["name"] for h in HUB_DATA}

    if pool is None:
        return ok({
            "hubs": [
                {
                    "hub_id": h["id"],
                    "hub_name": h["name"],
                    "congestion_level": "low",
                    "avg_dwell_time_min": 120.0,
                    "current_inbound_volume": 0,
                    "delay_rate": 0.0,
                }
                for h in HUB_DATA
            ]
        })

    rows = await pool.fetch(
        """
        SELECT
            hub_id,
            AVG(avg_dwell_time_min)   AS avg_dwell_time_min,
            SUM(inbound_volume)       AS inbound_volume,
            AVG(delay_rate)           AS delay_rate
        FROM (
            SELECT hub_id, avg_dwell_time_min, inbound_volume, delay_rate
            FROM hub_metrics
            ORDER BY time DESC
            LIMIT 500
        ) recent
        GROUP BY hub_id
        ORDER BY hub_id
        """
    )

    def _congestion(dwell_min: float, delay_rate: float) -> str:
        if dwell_min > 180 or delay_rate > 0.15:
            return "high"
        if dwell_min > 120 or delay_rate > 0.08:
            return "medium"
        return "low"

    hubs_result = []
    seen_ids = set()

    for row in rows:
        hub_id = row["hub_id"]
        seen_ids.add(hub_id)
        dwell = float(row["avg_dwell_time_min"] or 120.0)
        delay = float(row["delay_rate"] or 0.0)
        hubs_result.append({
            "hub_id": hub_id,
            "hub_name": hub_names.get(hub_id, hub_id.replace("_", " ").title()),
            "congestion_level": _congestion(dwell, delay),
            "avg_dwell_time_min": round(dwell, 1),
            "current_inbound_volume": int(row["inbound_volume"] or 0),
            "delay_rate": round(delay, 4),
        })

    # Include hubs with no metrics yet (show as idle)
    for h in HUB_DATA:
        if h["id"] not in seen_ids:
            hubs_result.append({
                "hub_id": h["id"],
                "hub_name": h["name"],
                "congestion_level": "low",
                "avg_dwell_time_min": 120.0,
                "current_inbound_volume": 0,
                "delay_rate": 0.0,
            })

    return ok({"hubs": hubs_result})
