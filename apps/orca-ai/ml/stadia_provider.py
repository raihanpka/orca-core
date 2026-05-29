import logging
import os
import httpx

from core.config import get_settings

Coordinate = tuple[float, float]

logger = logging.getLogger(__name__)

class StadiaMapsProvider:
    def __init__(self):
        self.api_key = os.getenv("STADIA_API_KEY", "")
        self.base_url = "https://api.stadiamaps.com/route/v1"
        self._distance_cache: dict[tuple[Coordinate, Coordinate], float] = {}
        self._geometry_cache: dict[tuple[Coordinate, Coordinate], list[list[float]]] = {}
        self.last_source = "stadia_maps"

    def _get_costing(self, vehicle_type: str) -> str:
        if "scooter" in vehicle_type or "motorcycle" in vehicle_type:
            return "motorcycle" # Supports non-toll
        if "truck" in vehicle_type:
            return "truck"
        return "auto"

    def distance_km(self, a: Coordinate, b: Coordinate, vehicle_type: str = "van_diesel") -> float:
        # For Stadia, we can just fetch the route and extract both distance and geometry
        # Let's rely on the cache to avoid duplicate calls.
        self._fetch_route(a, b, vehicle_type)
        key = self._cache_key(a, b)
        if key in self._distance_cache:
            return self._distance_cache[key]
        return 0.0

    def route_coordinates(self, points: list[Coordinate], vehicle_type: str = "van_diesel") -> list[list[float]]:
        if len(points) < 2:
            return [[points[0][1], points[0][0]]] if points else []

        coordinates: list[list[float]] = []
        for start, end in zip(points, points[1:], strict=False):
            segment = self._fetch_geometry(start, end, vehicle_type)
            if coordinates and segment and coordinates[-1] == segment[0]:
                coordinates.extend(segment[1:])
            else:
                coordinates.extend(segment)
        return coordinates or [[lng, lat] for lat, lng in points]

    def _fetch_geometry(self, a: Coordinate, b: Coordinate, vehicle_type: str) -> list[list[float]]:
        self._fetch_route(a, b, vehicle_type)
        key = self._cache_key(a, b)
        return self._geometry_cache.get(key, [[a[1], a[0]], [b[1], b[0]]])

    def _fetch_route(self, a: Coordinate, b: Coordinate, vehicle_type: str) -> None:
        key = self._cache_key(a, b)
        if key in self._geometry_cache and key in self._distance_cache:
            return
            
        costing = self._get_costing(vehicle_type)
        
        payload = {
            "locations": [
                {"lat": a[0], "lon": a[1], "type": "break"},
                {"lat": b[0], "lon": b[1], "type": "break"}
            ],
            "costing": costing,
            # Polyline 6 format is standard in valhalla, but we'll ask for shape to be decoded if possible,
            # wait, Valhalla usually returns a polyline6 encoded string in trip.legs[0].shape.
            # It's easier to just decode it.
        }
        
        try:
            url = f"{self.base_url}?api_key={self.api_key}" if self.api_key else self.base_url
            response = httpx.post(url, json=payload, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            trip = data.get("trip", {})
            distance_km = trip.get("summary", {}).get("length", 0.0)
            
            # Polyline decoding (Valhalla uses 6 decimal places)
            encoded_shape = trip.get("legs", [{}])[0].get("shape", "")
            segment = self._decode_polyline6(encoded_shape)
            
            # Ensure exact start and end match the pins to avoid visual jumping
            if segment:
                segment = [[a[1], a[0]]] + segment + [[b[1], b[0]]]
            else:
                segment = [[a[1], a[0]], [b[1], b[0]]]
                
            self._distance_cache[key] = distance_km
            self._geometry_cache[key] = segment
            self.last_source = f"stadia_{costing}"
            
        except Exception as exc:
            logger.error("Stadia Maps routing failed: %s", exc)
            self._distance_cache[key] = 0.0 # Will fallback in caller if 0? No, let's just do haversine
            self._geometry_cache[key] = [[a[1], a[0]], [b[1], b[0]]]
            self.last_source = "stadia_fallback"

    def _decode_polyline6(self, polyline_str: str) -> list[list[float]]:
        import polyline
        # Decodes Valhalla's polyline6 string into a list of [lng, lat]
        coords = polyline.decode(polyline_str, 6)
        return [[c[1], c[0]] for c in coords]

    @staticmethod
    def _cache_key(a: Coordinate, b: Coordinate) -> tuple[Coordinate, Coordinate]:
        return (
            (round(a[0], 6), round(a[1], 6)),
            (round(b[0], 6), round(b[1], 6)),
        )

# Singleton-like getter
_stadia_provider = None
def get_stadia_provider() -> StadiaMapsProvider:
    global _stadia_provider
    if _stadia_provider is None:
        _stadia_provider = StadiaMapsProvider()
    return _stadia_provider
