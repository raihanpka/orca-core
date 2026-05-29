"""BMKG (Badan Meteorologi, Klimatologi, dan Geofisika) weather client.

Fetches real-time weather forecasts from the BMKG public API and maps the
cuaca description to a 0-3 severity score used by the delay prediction model.

API docs: https://api.bmkg.go.id
Endpoint: https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={kelurahan_code}
"""
import logging

import httpx

logger = logging.getLogger(__name__)


class BMKGClient:
    SEVERITY = {
        "cerah": 0.0,
        "cerah berawan": 0.5,
        "berawan": 1.0,
        "berawan tebal": 1.5,
        "udara kabur": 1.0,
        "asap": 1.5,
        "kabut": 1.5,
        "hujan ringan": 2.0,
        "hujan sedang": 2.0,
        "hujan": 2.0,
        "hujan lebat": 3.0,
        "hujan petir": 3.0,
        "badai": 3.0,
    }

    BMKG_API_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca"

    def __init__(self, base_url: str, redis=None, default_kelurahan: str = "31.71.03.1001"):
        self.base_url = base_url
        self.redis = redis
        self.default_kelurahan = default_kelurahan

    async def weather_severity(self, kelurahan_code: str | None = None) -> float:
        """Fetch weather severity for a kelurahan code (adm4).

        Returns a float in [0, 3]: 0=clear, 1=cloudy, 2=rain, 3=heavy rain/storm.
        Falls back to 0.0 on any error (clear-weather assumption).
        """
        code = kelurahan_code or self.default_kelurahan
        cache_key = f"orca:weather:{code}"

        if self.redis is not None:
            try:
                cached = await self.redis.get(cache_key)
                if cached is not None:
                    return float(cached)
            except Exception:
                pass

        severity = 0.0
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(self.BMKG_API_URL, params={"adm4": code})
                resp.raise_for_status()
                data = resp.json()

            cuaca_list = data.get("data", [{}])[0].get("cuaca", [[]])
            if cuaca_list and cuaca_list[0]:
                latest = cuaca_list[0][0]
                weather_desc = str(
                    latest.get("weather_desc") or latest.get("weather_desc_en") or ""
                ).lower().strip()

                for keyword, score in self.SEVERITY.items():
                    if keyword in weather_desc:
                        severity = score
                        break
        except Exception as exc:
            logger.warning("BMKG request failed for %s; using clear-weather fallback: %s", code, exc)

        if self.redis is not None:
            try:
                await self.redis.set(cache_key, str(severity), ex=10800)
            except Exception:
                pass

        return severity
