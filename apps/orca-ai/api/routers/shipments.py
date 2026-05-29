from datetime import datetime, timezone

import numpy as np
import pandas as pd
import uuid
from fastapi import APIRouter, Query, Request, HTTPException
from api.schemas.shipment import CreateShipmentRequest

from api.schemas.common import ok
from core.config import get_settings
from db.queries import (
    bulk_insert_carbon_records,
    bulk_insert_prediction_cache,
    get_active_shipments,
    get_latest_prediction,
    get_shipment_events,
)
from ml.features import FEATURE_COLUMNS, build_feature_vector
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


async def _batch_fallback_predictions(request: Request, rows) -> dict[str, dict]:
    predictor = DelayPredictor(
        request.app.state.delay_model,
        request.app.state.label_encoder,
        request.app.state.model_version,
    )
    # Opt #7: read amplifier once per batch instead of per-row get_settings() calls.
    amplifier = get_settings().sla_risk_amplifier
    fallback_by_id = {}
    prediction_records = []
    carbon_records = []
    for row in rows:
        if row["delay_probability"] is not None:
            continue
        features = _features_from_shipment(row)
        prediction = predictor.predict(features)
        risk_score, _ = compute_sla_risk(
            prediction["delay_probability"],
            features["remaining_hours_to_sla"],
            amplifier=amplifier,
        )
        shipment_id = str(row["id"])
        payload = {
            "shipment_id": shipment_id,
            "delay_probability": prediction["delay_probability"],
            "sla_risk_score": risk_score,
            "predicted_delay_hours": prediction["predicted_delay_hours"],
            "model_version": prediction["model_version"],
        }
        fallback_by_id[shipment_id] = payload
        prediction_records.append((shipment_id, payload, features))
        carbon_records.append((shipment_id, features["distance_km"], float(row["load_weight_kg"] or 1.0), row["vehicle_type"]))

    await bulk_insert_prediction_cache(request.app.state.db_pool, prediction_records)
    await bulk_insert_carbon_records(request.app.state.db_pool, carbon_records)
    return fallback_by_id


def _fallback_contributions(features: dict) -> list[dict]:
    weights = {
        "distance_km": 0.18,
        "estimated_delivery_days": -0.06,
        "weather_severity_score": 0.16,
        "historical_hub_delay_rate": 0.28,
        "historical_driver_rate": -0.22,
        "item_count": 0.06,
        "product_weight_g": 0.10,
    }
    contributions = []
    for feature, weight in weights.items():
        if feature not in features:
            continue
        value = float(features[feature] or 0)
        scale = max(abs(value), 1.0)
        contributions.append(
            {
                "feature": feature,
                "value": value,
                "contribution": round((value / scale) * weight, 4),
            }
        )
    return sorted(contributions, key=lambda item: abs(item["contribution"]), reverse=True)[:5]


def _shap_contributions(explainer: object | None, model: object, label_encoder: object, features: dict) -> list[dict]:
    """Compute SHAP feature contributions using the pre-built cached explainer.

    Falls back to the rule-based _fallback_contributions if the explainer is
    unavailable or SHAP raises an unexpected error.
    """
    if explainer is None:
        return _fallback_contributions(features)
    try:
        import shap
        vector = build_feature_vector(features, label_encoder)
        row = pd.DataFrame([[vector[column] for column in FEATURE_COLUMNS]], columns=FEATURE_COLUMNS)
        values = explainer(row)
        shap_values = values.values
        if shap_values.ndim == 3:
            class_values = shap_values[0, :, 1]
        else:
            class_values = shap_values[0]
        ranked = np.argsort(np.abs(class_values))[::-1][:5]
        return [
            {
                "feature": FEATURE_COLUMNS[int(index)],
                "value": float(row.iloc[0, int(index)]),
                "contribution": round(float(class_values[int(index)]), 4),
            }
            for index in ranked
        ]
    except Exception:
        return _fallback_contributions(features)


HUB_COORDS = {
    "hub_jakarta_selatan": (-6.2610, 106.8060),
    "hub_jakarta_utara": (-6.1420, 106.8900),
    "hub_bogor": (-6.5960, 106.7970),
    "hub_depok": (-6.4025, 106.7942)
}

@router.post("/", response_model=dict)
async def create_shipment(req: CreateShipmentRequest, request: Request):
    now = datetime.now(timezone.utc)
    
    if req.sla_deadline.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=400, detail="SLA deadline cannot be in the past")
        
    hub_coords = HUB_COORDS.get(req.origin_hub_id)
    if not hub_coords:
        raise HTTPException(status_code=400, detail="Invalid origin_hub_id")
        
    import asyncio
    # Automatic distance calculation using graphml/pkl
    provider = request.app.state.road_provider
    distance_km = await asyncio.to_thread(provider.distance_km, hub_coords, (req.customer_lat, req.customer_lng))
    
    shipment_id = uuid.uuid4()
    ext_id = req.external_id or f"MNL-{shipment_id.hex[:8]}"
    
    async with request.app.state.db_pool.acquire() as conn:
        # Insert shipment
        await conn.execute(
            """
            INSERT INTO shipments (
              id, external_id, origin_hub_id, destination_zone, 
              customer_lat, customer_lng, vehicle_type,
              load_weight_kg, item_count, sla_deadline, dispatched_at, status, distance_km
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'in_transit', $12)
            """,
            shipment_id, ext_id, req.origin_hub_id,
            req.destination_zone, req.customer_lat, req.customer_lng, req.vehicle_type,
            req.load_weight_kg, req.item_count, req.sla_deadline, now, distance_km
        )
        
    # Trigger prediction caching automatically for this manual shipment
    row = {
        "id": shipment_id,
        "dispatched_at": now,
        "created_at": now,
        "sla_deadline": req.sla_deadline,
        "distance_km": distance_km,
        "origin_hub_id": req.origin_hub_id,
        "item_count": req.item_count,
        "load_weight_kg": req.load_weight_kg,
        "vehicle_type": req.vehicle_type,
        "delay_probability": None
    }
    await _batch_fallback_predictions(request, [row])
    
    return ok({"shipment_id": str(shipment_id), "distance_km": distance_km, "message": "Shipment created successfully"})


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
    fallback_predictions = await _batch_fallback_predictions(request, rows)
    for row in rows:
        shipment_id = str(row["id"])
        fallback = fallback_predictions.get(shipment_id)
        delay_probability = (
            fallback["delay_probability"]
            if fallback
            else float(row["delay_probability"]) if row["delay_probability"] is not None else None
        )
        risk = (
            fallback["sla_risk_score"]
            if fallback
            else float(row["sla_risk_score"]) if row["sla_risk_score"] is not None else None
        )
        predicted_delay_hours = (
            fallback["predicted_delay_hours"]
            if fallback
            else float(row["predicted_delay_hrs"]) if row["predicted_delay_hrs"] is not None else None
        )
        shipments.append(
            {
                "id": shipment_id,
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
    shap_values = (
        _shap_contributions(
            request.app.state.shap_explainer,
            request.app.state.delay_model,
            request.app.state.label_encoder,
            features,
        )
        if features
        else []
    )
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


@router.get("/{shipment_id}/events")
async def shipment_events(shipment_id: str, request: Request, limit: int = Query(default=20, ge=1, le=100)):
    rows = await get_shipment_events(request.app.state.db_pool, shipment_id, limit)
    return ok(
        {
            "events": [
                {
                    "id": str(row["id"]),
                    "shipment_id": str(row["shipment_id"]),
                    "event_type": row["event_type"],
                    "event_payload": row["event_payload"] or {},
                    "created_at": row["created_at"],
                }
                for row in rows
            ]
        }
    )
