from __future__ import annotations

import logging
import math
import threading
from functools import lru_cache
from pathlib import Path

from core.config import Settings, get_settings

Coordinate = tuple[float, float]

logger = logging.getLogger(__name__)


def haversine_km(a: Coordinate, b: Coordinate) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1
    radius_km = 6371.0
    value = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    )
    return 2 * radius_km * math.asin(math.sqrt(value))


class RoadNetworkProvider:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.graph_path = Path(settings.osmnx_graph_path)
        if not self.graph_path.is_absolute():
            self.graph_path = Path(__file__).resolve().parents[1] / self.graph_path
        self._graph = None
        self._ox = None
        self._nx = None
        self._distance_cache: dict[tuple[Coordinate, Coordinate], float] = {}
        self._geometry_cache: dict[tuple[Coordinate, Coordinate], list[list[float]]] = {}
        self._fallback_reported = False
        self.last_source = "haversine_fallback"
        # Opt #5: prevent race condition when multiple async tasks trigger load simultaneously.
        self._load_lock = threading.Lock()

    def distance_km(self, a: Coordinate, b: Coordinate, **kwargs) -> float:
        key = self._cache_key(a, b)
        if key in self._distance_cache:
            return self._distance_cache[key]

        graph = self._load_graph()
        if graph is None:
            distance = haversine_km(a, b)
            self.last_source = "haversine_fallback"
        else:
            distance = self._road_distance_km(graph, a, b)

        self._distance_cache[key] = distance
        return distance

    def route_coordinates(self, points: list[Coordinate], **kwargs) -> list[list[float]]:
        if len(points) < 2:
            return [[points[0][1], points[0][0]]] if points else []

        graph = self._load_graph()
        if graph is None:
            self.last_source = "haversine_fallback"
            return [[lng, lat] for lat, lng in points]

        coordinates: list[list[float]] = []
        for start, end in zip(points, points[1:], strict=False):
            segment = self._road_geometry(graph, start, end)
            if coordinates and segment and coordinates[-1] == segment[0]:
                coordinates.extend(segment[1:])
            else:
                coordinates.extend(segment)
        return coordinates or [[lng, lat] for lat, lng in points]

    def _road_distance_km(self, graph, a: Coordinate, b: Coordinate) -> float:
        try:
            start_node = self._nearest_node(graph, a)
            end_node = self._nearest_node(graph, b)
            meters = self._nx.shortest_path_length(graph, start_node, end_node, weight="length")
            self.last_source = "osmnx_west_java"
            return float(meters) / 1000.0
        except Exception as exc:
            logger.warning("OSMnx distance failed, using haversine fallback: %s", exc)
            self.last_source = "haversine_fallback"
            return haversine_km(a, b)

    def _road_geometry(self, graph, a: Coordinate, b: Coordinate) -> list[list[float]]:
        key = self._cache_key(a, b)
        if key in self._geometry_cache:
            return self._geometry_cache[key]
        try:
            start_node = self._nearest_node(graph, a)
            end_node = self._nearest_node(graph, b)
            path = self._nx.shortest_path(graph, start_node, end_node, weight="length")
            # Inject exact start and end coordinates so the UI line connects perfectly to the pins
            segment = [[a[1], a[0]]] + [[graph.nodes[node]["x"], graph.nodes[node]["y"]] for node in path] + [[b[1], b[0]]]
            self.last_source = "osmnx_west_java"
        except Exception as exc:
            logger.warning("OSMnx route geometry failed, using straight fallback: %s", exc)
            self.last_source = "haversine_fallback"
            segment = [[a[1], a[0]], [b[1], b[0]]]
        self._geometry_cache[key] = segment
        return segment

    def _nearest_node(self, graph, point: Coordinate):
        lat, lng = point
        return self._ox.distance.nearest_nodes(graph, X=lng, Y=lat)

    def _load_graph(self):
        # Fast path: graph already loaded, no lock needed.
        if self._graph is not None:
            return self._graph

        # Opt #5: double-check locking prevents duplicate heavy load when two
        # requests arrive before the first load finishes.
        # If we cannot acquire the lock, it means another thread (like warmup) is currently
        # loading the 1.8GB file. We should not block the request for 3 minutes!
        # Just fallback to Haversine for now.
        acquired = self._load_lock.acquire(blocking=False)
        if not acquired:
            logger.info("Graph is currently loading in another thread. Fallback to haversine for this request.")
            return None
            
        try:
            if self._graph is not None:  # Re-check inside lock
                return self._graph

            try:
                import networkx as nx
                import osmnx as ox
                self._ox = ox
                self._nx = nx
            except Exception as exc:
                logger.warning("OSMnx unavailable, using haversine fallback: %s", exc)
                return None

            if not self.graph_path.exists() and not self.settings.osmnx_enable_download:
                if not self._fallback_reported:
                    logger.info(
                        "OSMnx graph not found at %s, using haversine fallback", self.graph_path
                    )
                    self._fallback_reported = True
                return None
            self._nx = nx
            if self.graph_path.exists():
                try:
                    import os
                    import pickle
                    pkl_path = str(self.graph_path).replace(".graphml", ".pkl")
                    
                    if os.path.exists(pkl_path):
                        logger.info("Loading pickled OSMnx graph from %s", pkl_path)
                        with open(pkl_path, "rb") as f:
                            self._graph = pickle.load(f)
                        return self._graph

                    logger.warning(
                        "Pickle file %s not found. Loading 1.8GB GraphML directly causes OOM. "
                        "Please run pickle_graph.py locally first. Falling back to haversine.",
                        pkl_path
                    )
                    return None
                except Exception as exc:
                    logger.warning("Failed to load OSMnx graph (Parse error): %s", exc)
                    return None
            self.graph_path.parent.mkdir(parents=True, exist_ok=True)
            self._graph = ox.graph_from_place(
                self.settings.osmnx_place_name,
                network_type="drive",
                simplify=True,
            )
            ox.save_graphml(self._graph, self.graph_path)
            logger.info(
                "Downloaded OSMnx graph for %s to %s", self.settings.osmnx_place_name, self.graph_path
            )
            return self._graph
        finally:
            self._load_lock.release()

    @staticmethod
    def _cache_key(a: Coordinate, b: Coordinate) -> tuple[Coordinate, Coordinate]:
        return (
            (round(a[0], 6), round(a[1], 6)),
            (round(b[0], 6), round(b[1], 6)),
        )


@lru_cache
def get_road_network_provider() -> RoadNetworkProvider:
    return RoadNetworkProvider(get_settings())
