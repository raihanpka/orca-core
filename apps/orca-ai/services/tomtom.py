import logging
import httpx

logger = logging.getLogger(__name__)

class TomTomClient:
    def __init__(self, api_key: str, redis=None):
        self.api_key = api_key
        self.base_url = "https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json"
        self.redis = redis

    async def get_traffic_multiplier(self, lat: float, lng: float) -> float:
        if not self.api_key:
            return 1.25

        # Cache key based on rounded coordinates for wider hit area
        key = f"orca:traffic:{round(lat, 2)}:{round(lng, 2)}"
        
        if self.redis is not None:
            cached = await self.redis.get(key)
            if cached is not None:
                return float(cached)
                
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    self.base_url,
                    params={
                        "point": f"{lat},{lng}",
                        "key": self.api_key
                    }
                )
                resp.raise_for_status()
                data = resp.json()
                
                flow = data.get("flowSegmentData", {})
                current_speed = flow.get("currentSpeed", 1)
                free_flow_speed = flow.get("freeFlowSpeed", 1)
                
                # Protect against zero division
                if current_speed <= 0:
                    current_speed = 1
                if free_flow_speed <= 0:
                    free_flow_speed = 1
                
                # Multiplier is the ratio of free flow to current speed.
                # If current speed is half of free flow, multiplier is 2.0 (it takes twice as long).
                # Cap the multiplier between 1.0 (no traffic) and 3.0 (heavy traffic)
                multiplier = max(1.0, min(3.0, free_flow_speed / current_speed))
                    
        except Exception as exc:
            logger.warning("TomTom request failed; using default traffic multiplier: %s", exc)
            multiplier = 1.25
            
        if self.redis is not None:
            await self.redis.set(key, str(multiplier), ex=1800)  # Cache for 30 minutes
            
        return multiplier
