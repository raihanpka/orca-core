import asyncio
import json
import logging
import subprocess

from fastapi import FastAPI
from redis import asyncio as aioredis

from ml.delay_predictor import DelayPredictor
from ml.sla_scorer import compute_sla_risk
from core.config import get_settings

logger = logging.getLogger("orca-subscriber")

RETRAIN_THRESHOLD = 500

async def process_shipment_event(app: FastAPI, payload: dict):
    pool = app.state.db_pool
    print(f"Processing shipment: {payload.get('shipment_id')}")
    if not pool:
        return

    # 1. Predict SLA Risk
    predictor = DelayPredictor(
        app.state.delay_model,
        app.state.label_encoder,
        app.state.model_version,
    )
    result = predictor.predict(payload)
    remaining_hours = payload.get("remaining_hours_to_sla", 0.0)
    delay_prob = result.get("delay_probability", 0.0)
    risk_score, _ = compute_sla_risk(delay_prob, remaining_hours)
    
    shipment_id = payload.get("shipment_id")
    if not shipment_id:
        return

    # 1.5. Ensure shipment exists in shipments table
    await pool.execute(
        """
        INSERT INTO shipments (
            id, external_id, status, origin_hub_id, current_hub_id, 
            destination_zone, customer_lat, customer_lng, weight_kg, 
            item_count, vehicle_type, created_at, updated_at
        )
        VALUES ($1::uuid, $2, 'in_transit', $3, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
        """,
        shipment_id, 
        payload.get("external_id") or f"SIM-{str(shipment_id)[:8]}",
        payload.get("origin_hub_id", "hub_unknown"),
        payload.get("destination_zone", "Unknown Zone"),
        payload.get("destination_lat", 0.0),
        payload.get("destination_lng", 0.0),
        payload.get("weight_kg", 1.0),
        payload.get("item_count", 1),
        payload.get("vehicle_type", "van_diesel")
    )

    # 2. Update DB with new prediction state
    await pool.execute(
        """
        INSERT INTO shipment_predictions (time, shipment_id, delay_probability, sla_risk_score, predicted_delay_hrs)
        VALUES (NOW(), $1::uuid, $2, $3, 0)
        """,
        shipment_id, delay_prob, risk_score
    )

    # 3. Handle Alerts
    if risk_score >= 70.0:
        settings = get_settings()
        alert_type = "sla_risk"
        existing = await pool.fetchrow(
            """
            SELECT id FROM alert_logs
            WHERE shipment_id = $1::uuid AND alert_type = $2 AND created_at >= NOW() - INTERVAL '2 hours'
            ORDER BY created_at DESC LIMIT 1
            """,
            shipment_id, alert_type
        )
        if not existing:
            sent = False
            if settings.fonnte_api_key and settings.alert_recipient_phone:
                from services.fonnte import FonnteClient
                client = FonnteClient(settings.fonnte_api_key, settings.fonnte_api_url)
                msg = f"ORCA AI ALERT 🚨\nShipment {ext_id if 'ext_id' in locals() else str(shipment_id)[:8]} is at HIGH RISK ({risk_score:.1f}%).\nSuggested Intervention: Dispatch via Alternate Route."
                sent = await client.send_alert(settings.alert_recipient_phone, msg)
            
            await pool.execute(
                """
                INSERT INTO alert_logs (shipment_id, alert_type, sla_risk_score, intervention, notified_via)
                VALUES ($1::uuid, $2, $3, $4, $5)
                """,
                shipment_id, alert_type, risk_score, "Dispatch via Alternate Route", ["whatsapp"] if sent else []
            )
            logger.info("Alert recorded for shipment %s (Risk: %.1f)", shipment_id, risk_score)

    # 4. Hub Metrics Update
    origin_hub = payload.get("origin_hub_id", "hub_unknown")
    
    # Fetch historical dwell time for more realistic tracking
    from db.queries import get_hub_historical_rates
    rates = await get_hub_historical_rates(pool, origin_hub)
    realistic_dwell = rates["avg_dwell_min"]
    
    await pool.execute(
        """
        INSERT INTO hub_metrics (time, hub_id, active_shipments, avg_dwell_time_min, delay_rate, inbound_volume)
        VALUES (NOW(), $1, 1, $3, $2, 1)
        """,
        origin_hub, risk_score / 100.0, realistic_dwell
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

                    # 5. MLflow Auto-Retraining Logic
                    count = await redis.incr("orca:metrics:incoming_count")
                    if count % RETRAIN_THRESHOLD == 0:
                        logger.info("Threshold reached (%d). Triggering MLflow retraining...", count)
                        # We use Popen to run the training asynchronously so it doesn't block the subscriber
                        subprocess.Popen(
                            ["uv", "run", "python", "training/train_delay.py"],
                            cwd="/app" if get_settings().database_url else ".", # Safe fallback
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL
                        )
                except Exception as e:
                    logger.error("Error processing event: %s", e)
    except asyncio.CancelledError:
        logger.info("Subscriber task cancelled.")
    finally:
        await pubsub.unsubscribe("orca:events:shipments")
        await pubsub.close()
