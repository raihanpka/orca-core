from fastapi import APIRouter, Depends, Request

from api.schemas.common import ok
from api.schemas.prediction import InternalPredictRequest
from core.security import require_internal_token
from ml.delay_predictor import DelayPredictor
from ml.indonesia_calendar import compute as compute_id_calendar
from ml.sla_scorer import compute_sla_risk
from services.bmkg import BMKGClient

router = APIRouter(
    prefix="/internal",
    tags=["internal"],
    include_in_schema=False,
    dependencies=[Depends(require_internal_token)],
)


def _get_bmkg_client(request: Request) -> BMKGClient:
    from core.config import get_settings
    settings = get_settings()
    return BMKGClient(
        base_url=settings.bmkg_api_base_url,
        redis=request.app.state.redis,
        default_kelurahan=settings.bmkg_default_kelurahan,
    )


@router.post("/predict")
async def predict_delay(payload: InternalPredictRequest, request: Request):
    row = payload.model_dump()

    # Enrich with live BMKG weather if not already provided (default is 0.0).
    if row.get("weather_severity_score", 0.0) == 0.0:
        bmkg = _get_bmkg_client(request)
        row["weather_severity_score"] = await bmkg.weather_severity()

    # Enrich with Indonesia calendar features from current timestamp.
    from datetime import datetime, timezone
    id_cal = compute_id_calendar(datetime.now(timezone.utc))
    for key, val in id_cal.items():
        if row.get(key) in (None, 0):
            row[key] = val

    predictor = DelayPredictor(
        request.app.state.delay_model,
        request.app.state.label_encoder,
        request.app.state.model_version,
    )
    result = predictor.predict(row)
    risk_score, _ = compute_sla_risk(result["delay_probability"], payload.remaining_hours_to_sla)
    response = {
        "shipment_id": payload.shipment_id,
        "delay_probability": result["delay_probability"],
        "sla_risk_score": risk_score,
        "predicted_delay_hours": result["predicted_delay_hours"],
        "model_version": result["model_version"],
    }
    return ok(response)
