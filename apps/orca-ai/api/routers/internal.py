from fastapi import APIRouter, Depends, Request

from api.schemas.common import ok
from api.schemas.prediction import InternalPredictRequest
from core.security import require_internal_token
from ml.delay_predictor import DelayPredictor
from ml.sla_scorer import compute_sla_risk

router = APIRouter(
    prefix="/internal",
    tags=["internal"],
    include_in_schema=False,
    dependencies=[Depends(require_internal_token)],
)


@router.post("/predict")
async def predict_delay(payload: InternalPredictRequest, request: Request):
    row = payload.model_dump()

    # Weather enrichment via Open-Meteo if lat/lng provided and score is default
    if row.get("weather_severity_score", 0.0) == 0.0 and row.get("lat") and row.get("lng"):
        from services.weather import OpenMeteoClient
        from core.config import get_settings
        client = OpenMeteoClient(get_settings().open_meteo_api_url, request.app.state.redis)
        row["weather_severity_score"] = await client.weather_severity(row["lat"], row["lng"])

    predictor = DelayPredictor(
        request.app.state.delay_model,
        request.app.state.label_encoder,
        request.app.state.model_version,
    )
    result = predictor.predict(row)
    risk_score, _ = compute_sla_risk(result["delay_probability"], payload.remaining_hours_to_sla, distance_km=payload.distance_km)
    response = {
        "shipment_id": payload.shipment_id,
        "delay_probability": result["delay_probability"],
        "sla_risk_score": risk_score,
        "predicted_delay_hours": result["predicted_delay_hours"],
        "model_version": result["model_version"],
    }
    return ok(response)
