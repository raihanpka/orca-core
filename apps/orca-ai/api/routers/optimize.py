import json
import uuid

from fastapi import APIRouter, Request

from api.schemas.common import ok
from api.schemas.optimize import OptimizeRouteRequest
from ml.route_optimizer import optimize_route

router = APIRouter(prefix="/optimize", tags=["optimize"])

@router.get("/vehicles")
async def vehicles(request: Request):
    pool = request.app.state.db_pool
    if not pool:
        return ok({"vehicles": []})
    rows = await pool.fetch("SELECT vehicle_type FROM glec_emission_factors")
    return ok({"vehicles": [row["vehicle_type"] for row in rows]})


@router.post("/route")
async def route(payload: OptimizeRouteRequest, request: Request):
    request_id = f"opt-{uuid.uuid4()}"
    solutions, elapsed_ms, compliant = await optimize_route(
        payload.delivery_stops,
        payload.vehicle_type,
        payload.load_weight_kg,
        payload.origin_hub_id,
        payload.routing_engine,
    )
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
    return ok(
        {
            "request_id": request_id,
            "vehicle_id": payload.vehicle_id,
            "pareto_solutions": solutions,
            "optimization_time_ms": elapsed_ms,
            "sla_compliance_guaranteed": compliant,
        }
    )
