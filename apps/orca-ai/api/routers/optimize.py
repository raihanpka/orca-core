import json
import uuid
import hashlib

from fastapi import APIRouter, Request

from api.schemas.common import ok
from api.schemas.optimize import OptimizeRouteRequest
from core.config import get_settings
from db.queries import get_predictions_for_shipments
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
    traffic_multiplier = 1.25

    # Fetch LightGBM delay_probability for each stop from DB so the optimizer
    # uses real model output for its SLA-risk objective instead of a proxy.
    pool = request.app.state.db_pool
    shipment_ids = [str(stop.shipment_id) for stop in payload.delivery_stops]
    stop_delay_probs = await get_predictions_for_shipments(pool, shipment_ids)

    solutions, elapsed_ms, compliant = await optimize_route(
        payload.delivery_stops,
        payload.vehicle_type,
        payload.load_weight_kg,
        payload.origin_hub_id,
        payload.routing_engine,
        traffic_multiplier=traffic_multiplier,
        stop_delay_probs=stop_delay_probs,
    )

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
