from datetime import datetime, timezone

from fastapi import APIRouter, Query, Request

from api.schemas.common import ok
from db.queries import get_active_shipments, get_latest_prediction, upsert_prediction_cache
from ml.carbon_calc import write_carbon_record
from ml.delay_predictor import DelayPredictor
from ml.sla_scorer import compute_sla_risk

router = APIRouter(prefix="/shipments", tags=["shipments"])


def _intervention(score: float | None) -> str | None:
    if score is None:
        return None
    if score >= 70:
        return "reroute_via_toll"
    if score >= 40:
        return "notify_customer_proactively"
    return "monitor"


def _features_from_shipment(row) -> dict:
    dispatched = row["dispatched_at"] or row["created_at"]
    now = datetime.now(timezone.utc)
    deadline = row["sla_deadline"]
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    if dispatched is not None and dispatched.tzinfo is None:
        dispatched = dispatched.replace(tzinfo=timezone.utc)
    return {
        "shipment_id": str(row["id"]),
        "distance_km": float(row["distance_km"] or 30.0),
        "estimated_delivery_days": max((deadline - dispatched).total_seconds() / 86400, 0.1)
        if dispatched
        else 2.0,
        "day_of_week": dispatched.weekday() if dispatched else now.weekday(),
        "hour_of_day": dispatched.hour if dispatched else now.hour,
        "hub_zone": row["origin_hub_id"].split("_")[-1],
        "weather_severity_score": 0.0,
        "historical_hub_delay_rate": 0.0,
        "historical_driver_rate": 1.0,
        "item_count": int(row["item_count"] or 1),
        "product_weight_g": float(row["load_weight_kg"] or 1.0) * 1000,
        "remaining_hours_to_sla": (deadline - now).total_seconds() / 3600,
    }


async def _ensure_prediction(request: Request, row) -> tuple[float | None, float | None, float | None, str | None]:
    if row["delay_probability"] is not None:
        return (
            float(row["delay_probability"]),
            float(row["sla_risk_score"]) if row["sla_risk_score"] is not None else None,
            float(row["predicted_delay_hrs"]) if row["predicted_delay_hrs"] is not None else None,
            row["model_version"],
        )
    features = _features_from_shipment(row)
    predictor = DelayPredictor(
        request.app.state.delay_model,
        request.app.state.label_encoder,
        request.app.state.model_version,
    )
    prediction = predictor.predict(features)
    risk_score, _ = compute_sla_risk(prediction["delay_probability"], features["remaining_hours_to_sla"])
    payload = {
        "shipment_id": str(row["id"]),
        "delay_probability": prediction["delay_probability"],
        "sla_risk_score": risk_score,
        "predicted_delay_hours": prediction["predicted_delay_hours"],
        "model_version": prediction["model_version"],
    }
    await upsert_prediction_cache(request.app.state.db_pool, str(row["id"]), payload, features)
    await write_carbon_record(
        request.app.state.db_pool,
        str(row["id"]),
        features["distance_km"],
        float(row["load_weight_kg"] or 1.0),
        row["vehicle_type"],
    )
    return (
        payload["delay_probability"],
        payload["sla_risk_score"],
        payload["predicted_delay_hours"],
        payload["model_version"],
    )


@router.get("/active")
async def active_shipments(
    request: Request,
    hub_id: str | None = None,
    min_risk: float | None = Query(default=None, ge=0, le=100),
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = None,
):
    rows, next_cursor, total_at_risk = await get_active_shipments(
        request.app.state.db_pool, limit, cursor, hub_id, min_risk
    )
    shipments = []
    for row in rows:
        delay_probability, risk, predicted_delay_hours, _ = await _ensure_prediction(request, row)
        shipments.append(
            {
                "id": str(row["id"]),
                "external_id": row["external_id"],
                "origin_hub_id": row["origin_hub_id"],
                "destination_zone": row["destination_zone"],
                "vehicle_type": row["vehicle_type"],
                "sla_deadline": row["sla_deadline"],
                "dispatched_at": row["dispatched_at"],
                "delay_probability": delay_probability,
                "sla_risk_score": risk,
                "predicted_delay_hours": predicted_delay_hours,
                "co2_kg": float(row["co2_kg"]) if row["co2_kg"] is not None else None,
                "status": row["status"],
                "intervention_recommended": _intervention(risk),
            }
        )
    return ok({"shipments": shipments, "next_cursor": next_cursor, "total_at_risk": total_at_risk})


@router.get("/{shipment_id}/prediction")
async def shipment_prediction(shipment_id: str, request: Request):
    prediction = await get_latest_prediction(request.app.state.db_pool, shipment_id)
    if prediction is None:
        return ok(
            {
                "shipment_id": shipment_id,
                "delay_probability": 0.0,
                "sla_risk_score": 0.0,
                "predicted_delay_hours": 0.0,
                "model_version": request.app.state.model_version,
                "shap_contributions": [],
                "intervention_options": ["monitor"],
            }
        )
    features = prediction["features_json"] or {}
    shap_values = [
        {"feature": key, "value": value, "contribution": 0.0}
        for key, value in list(features.items())[:5]
        if isinstance(value, (int, float, str))
    ]
    risk = float(prediction["sla_risk_score"])
    return ok(
        {
            "shipment_id": shipment_id,
            "delay_probability": float(prediction["delay_probability"]),
            "sla_risk_score": risk,
            "predicted_delay_hours": float(prediction["predicted_delay_hrs"] or 0),
            "model_version": prediction["model_version"] or request.app.state.model_version,
            "shap_contributions": shap_values,
            "intervention_options": ["reroute_via_toll", "notify_customer_proactively", "escalate_to_courier_manager"]
            if risk >= 70
            else ["monitor"],
        }
    )
