from fastapi import APIRouter, Query, Request

from api.schemas.common import ok

router = APIRouter(prefix="/analytics", tags=["analytics"])


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
