from datetime import datetime

from pydantic import BaseModel, Field


class DeliveryStop(BaseModel):
    shipment_id: str
    destination_lat: float
    destination_lng: float
    sla_deadline: datetime
    weight_kg: float = Field(ge=0)


class OptimizeRouteRequest(BaseModel):
    vehicle_id: str
    vehicle_type: str
    load_weight_kg: float = Field(ge=0)
    origin_hub_id: str
    delivery_stops: list[DeliveryStop] = Field(min_length=1, max_length=10)
    current_traffic_level: str = "normal"
    routing_engine: str = "osmnx"


class ParetoSolution(BaseModel):
    index: int
    label: str
    stops_order: list[str]
    route_geometry: dict
    distance_source: str = "haversine_fallback"
    travel_time_min: int
    co2_kg: float
    fuel_cost_idr: int
    sla_risk_score: float


class OptimizeRouteResponse(BaseModel):
    request_id: str
    vehicle_id: str
    pareto_solutions: list[ParetoSolution]
    optimization_time_ms: int
    sla_compliance_guaranteed: bool
