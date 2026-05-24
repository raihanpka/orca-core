import logging
from typing import Any

import asyncpg

logger = logging.getLogger(__name__)


async def create_pool(database_url: str) -> asyncpg.Pool | None:
    try:
        pool = await asyncpg.create_pool(database_url, min_size=1, max_size=10)
        logger.info("PostgreSQL pool connected")
        return pool
    except Exception as exc:
        logger.warning("PostgreSQL unavailable; API will return empty DB-backed data: %s", exc)
        return None


def record_to_dict(record: Any) -> dict:
    return dict(record) if record is not None else {}
