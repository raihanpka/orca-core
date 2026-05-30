import json
import uuid
import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Request

from api.schemas.common import ok
from api.schemas.optimize import OptimizeRouteRequest
from core.config import get_settings
from ml.route_optimizer import optimize_route

router = APIRouter(prefix="/optimize", tags=["optimize"])

def _get_cache_key(payload: OptimizeRouteRequest) -> str:
    """Create a unique stable fingerprint for the route request."""
    stops_data = [{"id": str(s.shipment_id), "lat": s.destination_lat, "lng": s.destination_lng} for s in payload.delivery_stops]
    # Sort stops by ID to ensure same set of stops yields same key regardless of input order
    fingerprint = {
        "stops": sorted(stops_data, key=lambda x: x["id"]),
        "vehicle": payload.vehicle_type,
        "load": payload.load_weight_kg,
        "hub": payload.origin_hub_id,
        "engine": payload.routing_engine
    }
    dump = json.dumps(fingerprint, sort_keys=True)
    return f"orca:cache:route:{hashlib.md5(dump.encode()).hexdigest()}"

_DEFAULT_VEHICLES = ["van_diesel", "truck_lt35t", "truck_35_75t", "truck_gt75t", "scooter_electric"]

@router.get("/vehicles")
async def vehicles(request: Request):
    pool = request.app.state.db_pool
    if not pool:
        return ok({"vehicles": _DEFAULT_VEHICLES})
    rows = await pool.fetch("SELECT vehicle_type FROM glec_emission_factors ORDER BY vehicle_type")
    vehicle_list = [row["vehicle_type"] for row in rows]
    return ok({"vehicles": vehicle_list if vehicle_list else _DEFAULT_VEHICLES})


@router.post("/route")
async def route(payload: OptimizeRouteRequest, request: Request):
    settings = get_settings()
    redis = request.app.state.redis
    
    # 1. Check Redis Cache
    cache_key = _get_cache_key(payload)
    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return ok(json.loads(cached))
        except Exception:
            pass # Continue to fresh calculation if redis fails

    request_id = f"opt-{uuid.uuid4()}"
    
    # TomTom/Traffic multiplier skipped as per user request (prioritize free OpenMeteo)
    traffic_multiplier = 1.25 

    solutions, elapsed_ms, compliant = await optimize_route(
        payload.delivery_stops,
        payload.vehicle_type,
        payload.load_weight_kg,
        payload.origin_hub_id,
        payload.routing_engine,
        traffic_multiplier=traffic_multiplier,
    )
    
    # Re-calculate travel time and risk with real traffic multiplier for the final Pareto set
    for sol in solutions:
        base_km = sol["travel_time_min"] * 35 / 60 / 1.25
        sol["travel_time_min"] = max(1, int(base_km / 35 * 60 * traffic_multiplier))
        
        # Recalculate SLA Risk
        latest_deadline = min(stop.sla_deadline for stop in payload.delivery_stops)
        remaining_min = (latest_deadline.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)).total_seconds() / 60
        sla_risk = (
            100.0
            if sol["travel_time_min"] > remaining_min
            else min(65.0, sol["travel_time_min"] / max(remaining_min, 1) * 50)
        )
        sol["sla_risk_score"] = round(sla_risk, 2)

    pool = request.app.state.db_pool
    if pool is not None:
        await pool.execute(
            """
            INSERT INTO route_optimizations (
              request_id, vehicle_id, shipment_ids, pareto_solutions, optimization_ms
            )
            VALUES ($1, $2, $3::uuid[], $4::jsonb, $5)
            """,
            request_id,
            payload.vehicle_id,
            [stop.shipment_id for stop in payload.delivery_stops],
            json.dumps(solutions),
            elapsed_ms,
        )
    
    response_data = {
        "request_id": request_id,
        "vehicle_id": payload.vehicle_id,
        "pareto_solutions": solutions,
        "optimization_time_ms": elapsed_ms,
        "sla_compliance_guaranteed": compliant,
        "cached": False
    }

    # 3. Store in Cache (1 hour TTL)
    if redis:
        try:
            cached_payload = response_data.copy()
            cached_payload["cached"] = True
            await redis.set(cache_key, json.dumps(cached_payload), ex=3600)
        except Exception:
            pass

    return ok(response_data)
