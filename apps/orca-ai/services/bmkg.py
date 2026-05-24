import logging

import httpx

logger = logging.getLogger(__name__)


class BMKGClient:
    SEVERITY = {
        "cerah": 0.0,
        "berawan": 1.0,
        "hujan ringan": 2.0,
        "hujan": 2.0,
        "hujan lebat": 3.0,
        "badai": 3.0,
    }

    def __init__(self, base_url: str, redis=None):
        self.base_url = base_url
        self.redis = redis

    async def weather_severity(self, city: str) -> float:
        key = f"orca:weather:{city.lower()}"
        if self.redis is not None:
            cached = await self.redis.get(key)
            if cached is not None:
                return float(cached)
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.get(self.base_url)
        except Exception as exc:
            logger.warning("BMKG request failed; using clear-weather fallback: %s", exc)
            return 0.0
        if self.redis is not None:
            await self.redis.set(key, "0.0", ex=10800)
        return 0.0
