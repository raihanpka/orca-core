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

    # 2. Update DB with new prediction state
    await pool.execute(
        """
        UPDATE shipments 
        SET delay_probability = $1, sla_risk_score = $2, latest_status = 'in_transit', updated_at = NOW()
        WHERE id = $3::uuid
        """,
        delay_prob, risk_score, shipment_id
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
            # We skip actual WhatsApp sending in background for MVP safety, but we log the alert
            await pool.execute(
                """
                INSERT INTO alert_logs (shipment_id, alert_type, sla_risk_score, intervention, notified_via)
                VALUES ($1::uuid, $2, $3, $4, $5)
                """,
                shipment_id, alert_type, risk_score, "reroute_via_toll", []
            )
            logger.info("Alert recorded for shipment %s (Risk: %.1f)", shipment_id, risk_score)

    # 4. Hub Metrics Update (Upsert simple counter for the MVP)
    origin_hub = payload.get("origin_hub_id", "hub_unknown")
    await pool.execute(
        """
        INSERT INTO hub_metrics (hub_id, active_shipments, avg_dwell_mins, delay_risk_rate)
        VALUES ($1, 1, 0, $2)
        ON CONFLICT (hub_id, recorded_at) DO UPDATE 
        SET active_shipments = hub_metrics.active_shipments + 1,
            delay_risk_rate = (hub_metrics.delay_risk_rate + EXCLUDED.delay_risk_rate) / 2
        """,
        origin_hub, risk_score / 100.0
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
