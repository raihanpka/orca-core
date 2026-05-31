import json
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import uuid
from fastapi import APIRouter, Query, Request, HTTPException
from api.schemas.shipment import CreateShipmentRequest

from api.schemas.common import ok
from api.routers.hubs import HUB_DATA
from core.config import get_settings
from db.queries import (
    bulk_insert_alerts,
    bulk_insert_carbon_records,
    bulk_insert_prediction_cache,
    get_active_shipments,
    get_hub_historical_rates,
    get_latest_prediction,
    get_shipment,
    get_shipment_events,
)
from ml.features import FEATURE_COLUMNS, build_feature_vector
from ml.delay_predictor import DelayPredictor
from ml.sla_scorer import compute_sla_risk

router = APIRouter(prefix="/shipments", tags=["shipments"])

HUB_COORDS: dict[str, tuple[float, float]] = {
    h["id"]: (h["lat"], h["lng"]) for h in HUB_DATA
}


def _intervention(risk_score: float | None) -> str:
    if risk_score is None or risk_score < 40:
        return "monitor"
    if risk_score < 70:
        return "notify_customer_proactively"
    return "reroute_via_toll"


async def _get_cached_hub_rates(hub_id: str, request: Request) -> dict[str, float]:
    redis = request.app.state.redis
    cache_key = f"orca:cache:hub_rates:{hub_id}"

    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    rates = await get_hub_historical_rates(request.app.state.db_pool, hub_id)

    if redis:
        try:
            await redis.set(cache_key, json.dumps(rates), ex=1800)
        except Exception:
            pass

    return rates

def _parse_features_json(raw) -> dict:
    """Normalize features_json from DB (dict, JSON string, or None) to a dict."""
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}
    return {}


def _features_from_shipment(row, historical_rates: dict | None = None) -> dict:
    dispatched = row["dispatched_at"] or row["created_at"]
    now = datetime.now(timezone.utc)
    deadline = row["sla_deadline"]
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    if dispatched is not None and dispatched.tzinfo is None:
        dispatched = dispatched.replace(tzinfo=timezone.utc)
    
    rates = historical_rates or {"delay_rate": 0.0, "avg_dwell_min": 120.0}
    
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
        "historical_hub_delay_rate": rates["delay_rate"],
        "historical_driver_rate": 1.0, # TODO: Track per-driver performance
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
    
    from services.weather import OpenMeteoClient
    weather_client = OpenMeteoClient(get_settings().open_meteo_api_url, request.app.state.redis)
    
    fallback_by_id = {}
    prediction_records = []
    carbon_records = []
    alert_records = []
    
    # Pre-fetch historical rates for all hubs in this batch
    unique_hubs = {row["origin_hub_id"] for row in rows if row["delay_probability"] is None}
    hub_rates_map = {hub_id: await _get_cached_hub_rates(hub_id, request) for hub_id in unique_hubs}

    for row in rows:
        if row["delay_probability"] is not None:
            continue
        
        features = _features_from_shipment(row, historical_rates=hub_rates_map.get(row["origin_hub_id"]))
        
        # Real weather integration
        if "customer_lat" in row and "customer_lng" in row:
            try:
                features["weather_severity_score"] = await weather_client.weather_severity(row["customer_lat"], row["customer_lng"])
            except Exception:
                features["weather_severity_score"] = 0.0
            
        prediction = predictor.predict(features)
        risk_score, _ = compute_sla_risk(
            prediction["delay_probability"],
            features["remaining_hours_to_sla"],
            amplifier=amplifier,
            distance_km=features["distance_km"],
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
        if risk_score >= 70.0:
            alert_records.append((shipment_id, risk_score, _intervention(risk_score)))

    await bulk_insert_prediction_cache(request.app.state.db_pool, prediction_records)
    await bulk_insert_carbon_records(request.app.state.db_pool, carbon_records)
    await bulk_insert_alerts(request.app.state.db_pool, alert_records)
    return fallback_by_id


def _live_sla_risk(row, delay_probability: float | None, amplifier: float) -> float | None:
    """Recompute SLA risk from stored delay_prob + live remaining time + distance."""
    if delay_probability is None:
        return None
    deadline = row["sla_deadline"]
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    remaining = max((deadline - datetime.now(timezone.utc)).total_seconds() / 3600, 0.0)
    distance = float(row["distance_km"] or 0) or None
    risk, _ = compute_sla_risk(delay_probability, remaining, amplifier=amplifier, distance_km=distance)
    return risk


def _fallback_contributions(features: dict) -> list[dict]:
    if not isinstance(features, dict):
        features = _parse_features_json(features)
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
    features = _parse_features_json(features)
    if not features:
        return []
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


@router.post("/")
async def create_shipment(req: CreateShipmentRequest, request: Request):
    now = datetime.now(timezone.utc)

    # Normalize deadline to UTC regardless of input timezone offset
    sla_utc = req.sla_deadline.astimezone(timezone.utc) if req.sla_deadline.tzinfo else req.sla_deadline.replace(tzinfo=timezone.utc)
    if sla_utc < now:
        raise HTTPException(status_code=400, detail="SLA deadline cannot be in the past")

    hub_coords = HUB_COORDS.get(req.origin_hub_id)
    if not hub_coords:
        raise HTTPException(status_code=400, detail=f"Invalid origin_hub_id '{req.origin_hub_id}'. Valid IDs: {list(HUB_COORDS.keys())}")

    if request.app.state.db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    import asyncio
    provider = request.app.state.road_provider
    distance_km = await asyncio.to_thread(provider.distance_km, hub_coords, (req.customer_lat, req.customer_lng))

    shipment_id = uuid.uuid4()
    ext_id = req.external_id or f"BLI-M{shipment_id.hex[:8].upper()}"

    async with request.app.state.db_pool.acquire() as conn:
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
            req.load_weight_kg, req.item_count, sla_utc, now, distance_km,
        )

    # Trigger ML prediction immediately for this shipment
    row = {
        "id": shipment_id,
        "dispatched_at": now,
        "created_at": now,
        "sla_deadline": sla_utc,
        "distance_km": distance_km,
        "origin_hub_id": req.origin_hub_id,
        "customer_lat": req.customer_lat,   # needed for weather enrichment
        "customer_lng": req.customer_lng,
        "item_count": req.item_count,
        "load_weight_kg": req.load_weight_kg,
        "vehicle_type": req.vehicle_type,
        "delay_probability": None,
    }
    await _batch_fallback_predictions(request, [row])

    return ok({"shipment_id": str(shipment_id), "distance_km": round(distance_km, 3), "message": "Shipment created and ML prediction triggered"})


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
    amplifier = get_settings().sla_risk_amplifier
    live_alert_records = []

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
            else _live_sla_risk(row, delay_probability, amplifier)
        )
        
        if not fallback and risk is not None and risk >= 70.0:
            live_alert_records.append((shipment_id, risk, _intervention(risk)))

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
                "distance_km": float(row["distance_km"]) if row["distance_km"] is not None else None,
                "load_weight_kg": float(row["load_weight_kg"]) if row["load_weight_kg"] is not None else None,
                "status": row["status"],
                "intervention_recommended": risk is not None and risk >= 70.0,
            }
        )

    if live_alert_records:
        from db.queries import bulk_insert_alerts
        await bulk_insert_alerts(request.app.state.db_pool, live_alert_records)

    return ok({
        "shipments": shipments,
        "next_cursor": next_cursor,
        "total_at_risk": total_at_risk,
    })


@router.get("/{shipment_id}")
async def get_shipment_detail(shipment_id: str, request: Request):
    """Return core shipment fields joined with latest carbon record."""
    row = await get_shipment(request.app.state.db_pool, shipment_id)
    if row is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Shipment not found")
    pool = request.app.state.db_pool
    carbon = None
    if pool:
        carbon = await pool.fetchrow(
            "SELECT co2_kg, route_distance_km, emission_factor, glec_version FROM carbon_records WHERE shipment_id = $1::uuid",
            shipment_id,
        )
    return ok({
        "id": str(row["id"]),
        "external_id": row["external_id"],
        "origin_hub_id": row["origin_hub_id"],
        "destination_zone": row["destination_zone"],
        "vehicle_type": row["vehicle_type"],
        "load_weight_kg": float(row["load_weight_kg"] or 0),
        "item_count": int(row["item_count"] or 0),
        "distance_km": float(row["distance_km"] or 0),
        "status": row["status"],
        "sla_deadline": row["sla_deadline"],
        "dispatched_at": row["dispatched_at"],
        "created_at": row["created_at"],
        "carbon": {
            "co2_kg": float(carbon["co2_kg"]) if carbon else None,
            "distance_km": float(carbon["route_distance_km"]) if carbon else None,
            "emission_factor": float(carbon["emission_factor"]) if carbon else None,
            "glec_version": carbon["glec_version"] if carbon else None,
        },
    })


async def _ensure_prediction(request: Request, shipment_id: str):
    """Return latest prediction row, running on-demand inference if missing."""
    pool = request.app.state.db_pool
    prediction = await get_latest_prediction(pool, shipment_id)
    if prediction is not None:
        return prediction

    row = await get_shipment(pool, shipment_id)
    if row is None:
        return None

    batch_row = {
        "id": row["id"],
        "dispatched_at": row["dispatched_at"],
        "created_at": row["created_at"],
        "sla_deadline": row["sla_deadline"],
        "distance_km": row["distance_km"],
        "origin_hub_id": row["origin_hub_id"],
        "customer_lat": row["customer_lat"],
        "customer_lng": row["customer_lng"],
        "item_count": row["item_count"],
        "load_weight_kg": row["load_weight_kg"],
        "vehicle_type": row["vehicle_type"],
        "delay_probability": None,
    }
    await _batch_fallback_predictions(request, [batch_row])
    return await get_latest_prediction(pool, shipment_id)


def _prediction_response(shipment_id: str, prediction, request: Request, shipment_row=None) -> dict:
    features = _parse_features_json(prediction["features_json"])
    shap_values = _shap_contributions(
        request.app.state.shap_explainer,
        request.app.state.delay_model,
        request.app.state.label_encoder,
        features,
    )
    delay_prob = float(prediction["delay_probability"])
    distance_km = float(features.get("distance_km") or 0) or None
    remaining_hours = float(features.get("remaining_hours_to_sla") or 0)

    if shipment_row is not None:
        deadline = shipment_row["sla_deadline"]
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        remaining_hours = max((deadline - datetime.now(timezone.utc)).total_seconds() / 3600, 0.0)
        if not distance_km:
            distance_km = float(shipment_row["distance_km"] or 0) or None

    amplifier = get_settings().sla_risk_amplifier
    risk, _ = compute_sla_risk(
        delay_prob,
        remaining_hours,
        amplifier=amplifier,
        distance_km=distance_km,
    )
    return {
        "shipment_id": shipment_id,
        "delay_probability": delay_prob,
        "sla_risk_score": risk,
        "predicted_delay_hours": float(prediction["predicted_delay_hrs"] or 0),
        "model_version": prediction["model_version"] or request.app.state.model_version,
        "shap_contributions": shap_values,
        "intervention_options": ["reroute_via_toll", "notify_customer_proactively", "escalate_to_courier_manager"]
        if risk >= 70
        else ["monitor"],
    }


@router.get("/{shipment_id}/prediction")
async def shipment_prediction(shipment_id: str, request: Request):
    prediction = await _ensure_prediction(request, shipment_id)
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
    shipment_row = await get_shipment(request.app.state.db_pool, shipment_id)
    return ok(_prediction_response(shipment_id, prediction, request, shipment_row))


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
