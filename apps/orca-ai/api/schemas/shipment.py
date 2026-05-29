from datetime import datetime

from pydantic import BaseModel


class ShipmentSummary(BaseModel):
    id: str
    external_id: str | None = None
    origin_hub_id: str
    destination_zone: str | None = None
    vehicle_type: str
    sla_deadline: datetime
    dispatched_at: datetime | None = None
    delay_probability: float | None = None
    sla_risk_score: float | None = None
    predicted_delay_hours: float | None = None
    co2_kg: float | None = None
    status: str
    intervention_recommended: str | None = None


class CreateShipmentRequest(BaseModel):
    origin_hub_id: str
    destination_zone: str
    customer_lat: float
    customer_lng: float
    vehicle_type: str
    load_weight_kg: float
    item_count: int
    sla_deadline: datetime
    external_id: str | None = None

class ActiveShipmentsResponse(BaseModel):
    shipments: list[ShipmentSummary]
    next_cursor: str | None = None
    total_at_risk: int = 0
