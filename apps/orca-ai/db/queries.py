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
          AND ($1::uuid IS NULL OR s.id > $1::uuid)
          AND ($2::text IS NULL OR s.origin_hub_id = $2)
          AND ($3::float IS NULL OR COALESCE(l.sla_risk_score, 0) >= $3)
        ORDER BY s.id
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
          $4,
          ROUND(($3::numeric / 1000.0)::numeric, 4),
          emission_factor,
          glec_version
        FROM glec_emission_factors
        WHERE vehicle_type = $4
        ON CONFLICT (shipment_id) DO NOTHING
        """,
        records,
    )
