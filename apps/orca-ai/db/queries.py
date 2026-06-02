import json
from typing import Any

import asyncpg


async def get_active_shipments(pool, limit: int, cursor: str | None, hub_id: str | None, min_risk: float | None):
    if pool is None:
        return [], None, 0

    rows = await pool.fetch(
        """
        WITH latest AS (
          SELECT DISTINCT ON (shipment_id)
            shipment_id, delay_probability, sla_risk_score, predicted_delay_hrs, model_version, time
          FROM shipment_predictions
          ORDER BY shipment_id, time DESC
        ),
        total AS (
          SELECT COUNT(*) AS total_at_risk
          FROM shipments s
          JOIN latest l ON l.shipment_id = s.id
          WHERE s.status = 'in_transit' AND l.sla_risk_score >= 70
        )
        SELECT
          s.*, l.delay_probability, l.sla_risk_score, l.predicted_delay_hrs,
          l.model_version, c.co2_kg, total.total_at_risk
        FROM shipments s
        LEFT JOIN latest l ON l.shipment_id = s.id
        LEFT JOIN carbon_records c ON c.shipment_id = s.id
        CROSS JOIN total
        WHERE s.status = 'in_transit'
          AND ($1::text IS NULL OR (s.dispatched_at, s.id) < (SELECT dispatched_at, id FROM shipments WHERE id = $1::uuid))
          AND ($2::text IS NULL OR s.origin_hub_id = $2)
          AND ($3::float IS NULL OR COALESCE(l.sla_risk_score, 0) >= $3)
        ORDER BY s.dispatched_at DESC, s.id
        LIMIT $4
        """,
        cursor,
        hub_id,
        min_risk,
        limit + 1,
    )
    page = rows[:limit]
    next_cursor = str(page[-1]["id"]) if len(rows) > limit and page else None
    total_at_risk = rows[0]["total_at_risk"] if rows else 0
    return page, next_cursor, int(total_at_risk or 0)


async def get_latest_prediction(pool, shipment_id: str):
    if pool is None:
        return None
    return await pool.fetchrow(
        """
        SELECT * FROM shipment_predictions
        WHERE shipment_id = $1::uuid
        ORDER BY time DESC
        LIMIT 1
        """,
        shipment_id,
    )


async def get_shipment(pool, shipment_id: str):
    if pool is None:
        return None
    return await pool.fetchrow(
        """
        SELECT * FROM shipments
        WHERE id = $1::uuid
        """,
        shipment_id,
    )


async def get_shipment_events(pool, shipment_id: str, limit: int = 20):
    if pool is None:
        return []
    return await pool.fetch(
        """
        SELECT id, shipment_id, event_type, event_payload, created_at
        FROM shipment_events
        WHERE shipment_id = $1::uuid
        ORDER BY created_at DESC
        LIMIT $2
        """,
        shipment_id,
        limit,
    )


async def upsert_prediction_cache(pool, shipment_id: str, prediction: dict[str, Any], features: dict[str, Any] | None = None):
    if pool is None:
        return
    try:
        await pool.execute(
            """
            INSERT INTO shipment_predictions (
              time, shipment_id, delay_probability, sla_risk_score,
              predicted_delay_hrs, model_version, features_json
            )
            VALUES (NOW(), $1::uuid, $2, $3, $4, $5, $6::jsonb)
            """,
            shipment_id,
            prediction["delay_probability"],
            prediction["sla_risk_score"],
            prediction["predicted_delay_hours"],
            prediction["model_version"],
            json.dumps(features or {}),
        )
    except (asyncpg.ForeignKeyViolationError, asyncpg.InvalidTextRepresentationError):
        return


async def bulk_insert_prediction_cache(pool, records: list[tuple[str, dict[str, Any], dict[str, Any]]]) -> None:
    if pool is None or not records:
        return
    await pool.executemany(
        """
        INSERT INTO shipment_predictions (
          time, shipment_id, delay_probability, sla_risk_score,
          predicted_delay_hrs, model_version, features_json
        )
        VALUES (NOW(), $1::uuid, $2, $3, $4, $5, $6::jsonb)
        """,
        [
            (
                shipment_id,
                prediction["delay_probability"],
                prediction["sla_risk_score"],
                prediction["predicted_delay_hours"],
                prediction["model_version"],
                json.dumps(features),
            )
            for shipment_id, prediction, features in records
        ],
    )


async def bulk_insert_alerts(pool, records: list[tuple[str, float, str]]) -> None:
    if pool is None or not records:
        return
    # Use executemany, but prevent duplicates within the last 2 hours.
    # PostgreSQL executemany doesn't support RETURNING, but we can do a simple loop 
    # or an INSERT with a WHERE NOT EXISTS logic.
    # To keep it simple, we'll do an execute for each, or construct a batched query.
    for shipment_id, risk_score, intervention in records:
        await pool.execute(
            """
            INSERT INTO alert_logs (shipment_id, alert_type, sla_risk_score, intervention, notified_via)
            SELECT $1::uuid, 'sla_risk', $2, $3, '{}'
            WHERE NOT EXISTS (
                SELECT 1 FROM alert_logs 
                WHERE shipment_id = $1::uuid AND alert_type = 'sla_risk' AND created_at >= NOW() - INTERVAL '2 hours'
            )
            """,
            shipment_id, risk_score, intervention
        )

async def get_predictions_for_shipments(pool, shipment_ids: list[str]) -> dict[str, float]:
    """Return latest delay_probability keyed by shipment_id for a batch of IDs.

    Used by the route optimizer to feed real LightGBM probabilities into the
    SLA-risk objective instead of a time-pressure proxy.
    """
    if pool is None or not shipment_ids:
        return {}
    rows = await pool.fetch(
        """
        SELECT DISTINCT ON (shipment_id)
            shipment_id::text,
            delay_probability
        FROM shipment_predictions
        WHERE shipment_id = ANY($1::uuid[])
        ORDER BY shipment_id, time DESC
        """,
        shipment_ids,
    )
    return {row["shipment_id"]: float(row["delay_probability"]) for row in rows}


async def get_hub_historical_rates(pool, hub_id: str) -> dict[str, float]:
    if pool is None:
        return {"delay_rate": 0.0, "avg_dwell_min": 120.0}
    
    row = await pool.fetchrow(
        """
        SELECT 
            AVG(delay_rate) as delay_rate,
            AVG(avg_dwell_time_min) as avg_dwell_min
        FROM (
            SELECT delay_rate, avg_dwell_time_min
            FROM hub_metrics
            WHERE hub_id = $1
            ORDER BY time DESC
            LIMIT 100
        ) sub
        """,
        hub_id,
    )
    if not row or row["delay_rate"] is None:
        return {"delay_rate": 0.0, "avg_dwell_min": 120.0}
        
    return {
        "delay_rate": float(row["delay_rate"]),
        "avg_dwell_min": float(row["avg_dwell_min"]),
    }

async def bulk_insert_carbon_records(pool, records: list[tuple[str, float, float, str]]) -> None:
    if pool is None or not records:
        return
    await pool.executemany(
        """
        INSERT INTO carbon_records (
          shipment_id, route_distance_km, co2_kg, vehicle_type, load_weight_ton,
          emission_factor, glec_version
        )
        SELECT
          $1::uuid,
          $2,
          ROUND(($2::numeric * ($3::numeric / 1000.0) * emission_factor)::numeric, 4),
          $4::varchar,
          ROUND(($3::numeric / 1000.0)::numeric, 4),
          emission_factor,
          glec_version
        FROM glec_emission_factors
        WHERE vehicle_type = $4::varchar
        ON CONFLICT (shipment_id) DO NOTHING
        """,
        records,
    )
