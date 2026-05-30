from pydantic import BaseModel, Field


class InternalPredictRequest(BaseModel):
    shipment_id: str
    distance_km: float = Field(ge=0)
    estimated_delivery_days: float = Field(ge=0)
    day_of_week: int = Field(ge=0, le=6)
    hour_of_day: int = Field(ge=0, le=23)
    hub_zone: str
    weather_severity_score: float = Field(default=0.0, ge=0, le=3)
    historical_hub_delay_rate: float = Field(default=0.0, ge=0, le=1)
    historical_driver_rate: float = Field(default=1.0, ge=0, le=1)
    item_count: int = Field(default=1, ge=1)
    product_weight_g: float = Field(default=1000.0, ge=0)
    # v2: Indonesia calendar features (auto-computed if omitted)
    is_lebaran_window: int = Field(default=0, ge=0, le=1)
    is_ramadan: int = Field(default=0, ge=0, le=1)
    is_harbolnas_buildup: int = Field(default=0, ge=0, le=1)
    indonesia_peak_season: int = Field(default=0, ge=0, le=1)
    remaining_hours_to_sla: float
    # Optional lat/lng for weather enrichment via Open-Meteo
    lat: float | None = None
    lng: float | None = None


class PredictionResponse(BaseModel):
    shipment_id: str
    delay_probability: float
    sla_risk_score: float
    predicted_delay_hours: float
    model_version: str


class ShapContribution(BaseModel):
    feature: str
    value: float | int | str
    contribution: float


class PredictionDetail(PredictionResponse):
    shap_contributions: list[ShapContribution]
    intervention_options: list[str]
