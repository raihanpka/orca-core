import asyncio
import json
import logging

from fastapi import FastAPI
from redis import asyncio as aioredis

from ml.delay_predictor import DelayPredictor
from ml.sla_scorer import compute_sla_risk
from core.config import get_settings

logger = logging.getLogger("orca-subscriber")


async def process_shipment_event(app: FastAPI, payload: dict):
    pool = app.state.db_pool
    if not pool:
        return

    shipment_id = payload.get("shipment_id")
    if not shipment_id:
        return

    settings = get_settings()

    predictor = DelayPredictor(
        app.state.delay_model,
        app.state.label_encoder,
        app.state.model_version,
    )
    result = predictor.predict(payload)
    remaining_hours = float(payload.get("remaining_hours_to_sla", 0.0))
    delay_prob = result["delay_probability"]
    risk_score, _ = compute_sla_risk(delay_prob, remaining_hours, amplifier=settings.sla_risk_amplifier)
    predicted_delay_hrs = result["predicted_delay_hours"]

    ext_id = payload.get("external_id") or f"SIM-{str(shipment_id)[:8]}"

    # Upsert shipment (columns match infra/init-db/01_schema.sql)
    await pool.execute(
        """
        INSERT INTO shipments (
            id, external_id, status, origin_hub_id,
            destination_zone, customer_lat, customer_lng, load_weight_kg,
            item_count, vehicle_type, sla_deadline, dispatched_at, distance_km
        )
        VALUES ($1::uuid, $2, 'in_transit', $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11)
        ON CONFLICT (id) DO NOTHING
        """,
        shipment_id,
        ext_id,
        payload.get("origin_hub_id", "hub_unknown"),
        payload.get("destination_zone", "Unknown Zone"),
        payload.get("customer_lat", 0.0),
        payload.get("customer_lng", 0.0),
        float(payload.get("load_weight_kg", 1.0)),
        int(payload.get("item_count", 1)),
        payload.get("vehicle_type", "van_diesel"),
        payload.get("sla_deadline"),
        float(payload.get("distance_km", 30.0)),
    )

    # Insert prediction
    await pool.execute(
        """
        INSERT INTO shipment_predictions (time, shipment_id, delay_probability, sla_risk_score, predicted_delay_hrs, model_version)
        VALUES (NOW(), $1::uuid, $2, $3, $4, $5)
        """,
        shipment_id, delay_prob, risk_score, predicted_delay_hrs, result["model_version"]
    )

    # Alerts for high-risk shipments
    if risk_score >= settings.alert_risk_threshold:
        existing = await pool.fetchrow(
            """
            SELECT id FROM alert_logs
            WHERE shipment_id = $1::uuid AND alert_type = $2 AND created_at >= NOW() - INTERVAL '2 hours'
            ORDER BY created_at DESC LIMIT 1
            """,
            shipment_id, "sla_risk"
        )
        if not existing:
            sent = False
            if settings.fonnte_api_key and settings.alert_recipient_phone:
                from services.fonnte import FonnteClient
                client = FonnteClient(settings.fonnte_api_key, settings.fonnte_api_url)
                msg = (
                    f"ORCA AI ALERT\n"
                    f"Shipment {ext_id} is at HIGH RISK ({risk_score:.1f}%).\n"
                    f"Suggested: Dispatch via Alternate Route."
                )
                sent = await client.send_alert(settings.alert_recipient_phone, msg)

            await pool.execute(
                """
                INSERT INTO alert_logs (shipment_id, alert_type, sla_risk_score, intervention, notified_via)
                VALUES ($1::uuid, $2, $3, $4, $5)
                """,
                shipment_id, "sla_risk", risk_score, "Dispatch via Alternate Route",
                ["whatsapp"] if sent else []
            )
            logger.info("Alert recorded for shipment %s (Risk: %.1f)", shipment_id, risk_score)

    # Hub metrics
    origin_hub = payload.get("origin_hub_id", "hub_unknown")
    from db.queries import get_hub_historical_rates
    rates = await get_hub_historical_rates(pool, origin_hub)
    await pool.execute(
        """
        INSERT INTO hub_metrics (time, hub_id, active_shipments, avg_dwell_time_min, delay_rate, inbound_volume)
        VALUES (NOW(), $1, 1, $2, $3, 1)
        """,
        origin_hub, rates["avg_dwell_min"], risk_score / 100.0
    )


async def run_subscriber(app: FastAPI):
    if not app.state.redis:
        logger.warning("Redis is not connected. Subscriber will not run.")
        return

    redis: aioredis.Redis = app.state.redis
    pubsub = redis.pubsub()
    await pubsub.subscribe("orca:events:shipments")
    logger.info("Subscribed to orca:events:shipments")

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    payload = json.loads(message["data"])
                    await process_shipment_event(app, payload)
                except Exception as e:
                    logger.error("Error processing event: %s", e)
    except asyncio.CancelledError:
        logger.info("Subscriber task cancelled.")
    finally:
        await pubsub.unsubscribe("orca:events:shipments")
        await pubsub.close()
