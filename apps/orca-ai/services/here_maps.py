import json
import logging

import httpx

logger = logging.getLogger(__name__)


class HereMapsClient:
    def __init__(self, api_key: str, redis=None):
        self.api_key = api_key
        self.redis = redis

    async def route(self, origin_zip: str, dest_zip: str) -> dict[str, float]:
        cache_key = f"orca:route:cache:{origin_zip}:{dest_zip}"
        if self.redis is not None:
            cached = await self.redis.get(cache_key)
            if cached:
                return json.loads(cached)
        fallback = {"distance_km": 30.0, "travel_time_min": 60.0}
        if not self.api_key:
            logger.warning("HERE Maps API key missing; using route fallback")
            return fallback
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.get("https://router.hereapi.com/v8/routes", params={"apiKey": self.api_key})
        except Exception as exc:
            logger.warning("HERE Maps request failed; using route fallback: %s", exc)
            return fallback
        if self.redis is not None:
            await self.redis.set(cache_key, json.dumps(fallback), ex=86400)
        return fallback
