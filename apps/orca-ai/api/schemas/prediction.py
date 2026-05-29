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
    # v2 features — optional with sensible defaults for backwards compatibility.
    freight_value: float = Field(default=15.0, ge=0)
    price: float = Field(default=100.0, ge=0)
    payment_installments: int = Field(default=1, ge=1)
    same_state_delivery: int = Field(default=0, ge=0, le=1)
    # v3 Gem #1: hub dwell
    historical_hub_dwell_hours: float = Field(default=24.0, ge=0)
    # v3 Gem #2: payment type flags
    payment_boleto: int = Field(default=0, ge=0, le=1)
    payment_voucher: int = Field(default=0, ge=0, le=1)
    payment_debit: int = Field(default=0, ge=0, le=1)
    # v3 Gem #3: seller review
    historical_seller_review: float = Field(default=4.0, ge=1, le=5)
    # v3 Gem #4: product category delay rate
    category_delay_rate: float = Field(default=0.08, ge=0, le=1)
    # v3 Gem #5: seller punctuality
    historical_seller_punctuality: float = Field(default=0.0)
    # v3 Gem #6: calendar flags
    is_holiday: int = Field(default=0, ge=0, le=1)
    is_strike_window: int = Field(default=0, ge=0, le=1)
    is_pre_christmas: int = Field(default=0, ge=0, le=1)
    is_black_friday_week: int = Field(default=0, ge=0, le=1)
    # v3 Gem #7: product volume/density
    product_volume_cm3: float = Field(default=3000.0, ge=0)
    product_density: float = Field(default=0.33, ge=0)
    is_bulky: int = Field(default=0, ge=0, le=1)
    # v4: Indonesia calendar features
    days_to_lebaran: int = Field(default=365, ge=0)
    is_lebaran_window: int = Field(default=0, ge=0, le=1)
    is_harbolnas: int = Field(default=0, ge=0, le=1)
    is_ramadan: int = Field(default=0, ge=0, le=1)
    is_post_longweekend: int = Field(default=0, ge=0, le=1)
    is_harbolnas_buildup: int = Field(default=0, ge=0, le=1)
    indonesia_peak_season: int = Field(default=0, ge=0, le=1)
    # v4: Delhivery-derived features
    is_ftl_route: int = Field(default=0, ge=0, le=1)
    congestion_ratio: float = Field(default=1.0, ge=0)
    remaining_hours_to_sla: float


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
