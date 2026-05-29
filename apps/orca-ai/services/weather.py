import logging
import httpx

logger = logging.getLogger(__name__)

class OpenMeteoClient:
    def __init__(self, base_url: str = "https://api.open-meteo.com/v1/forecast", redis=None):
        self.base_url = base_url
        self.redis = redis

    async def weather_severity(self, lat: float, lng: float) -> float:
        # Cache key based on rounded coordinates for wider hit area
        key = f"orca:weather:{round(lat, 2)}:{round(lng, 2)}"
        
        if self.redis is not None:
            cached = await self.redis.get(key)
            if cached is not None:
                return float(cached)
                
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    self.base_url,
                    params={
                        "latitude": lat,
                        "longitude": lng,
                        "current_weather": "true"
                    }
                )
                resp.raise_for_status()
                data = resp.json()
                weather_code = data.get("current_weather", {}).get("weathercode", 0)
                
                # WMO Weather interpretation codes
                # 0-3: Clear/Cloudy
                # 51-67: Rain/Drizzle
                # 71-77: Snow
                # 80-99: Showers/Thunderstorm
                if weather_code >= 80:
                    severity = 3.0
                elif weather_code >= 50:
                    severity = 2.0
                elif weather_code > 0:
                    severity = 1.0
                else:
                    severity = 0.0
                    
        except Exception as exc:
            logger.warning("OpenMeteo request failed; using clear-weather fallback: %s", exc)
            severity = 0.0
            
        if self.redis is not None:
            await self.redis.set(key, str(severity), ex=3600)  # Cache for 1 hour
            
        return severity
