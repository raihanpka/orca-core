from fastapi import APIRouter, Request

from api.schemas.common import ok
from api.schemas.prediction import InternalPredictRequest
from db.queries import upsert_prediction_cache
from ml.delay_predictor import DelayPredictor
from ml.sla_scorer import compute_sla_risk

router = APIRouter(prefix="/internal", tags=["internal"], include_in_schema=False)


@router.post("/predict")
async def predict_delay(payload: InternalPredictRequest, request: Request):
    predictor = DelayPredictor(
        request.app.state.delay_model,
        request.app.state.label_encoder,
        request.app.state.model_version,
    )
    result = predictor.predict(payload.model_dump())
    risk_score, _ = compute_sla_risk(result["delay_probability"], payload.remaining_hours_to_sla)
    response = {
        "shipment_id": payload.shipment_id,
        "delay_probability": result["delay_probability"],
        "sla_risk_score": risk_score,
        "predicted_delay_hours": result["predicted_delay_hours"],
        "model_version": result["model_version"],
    }
    await upsert_prediction_cache(request.app.state.db_pool, payload.shipment_id, response, payload.model_dump())
    return ok(response)
