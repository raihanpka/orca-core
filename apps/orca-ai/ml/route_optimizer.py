"""Multi-objective route optimizer using NSGA-II (pymoo).

Optimizations applied:
  - Opt #1: Per-run metrics cache (_metrics_cache) eliminates duplicate
    distance calculations for identical stop orderings that NSGA-II revisits.
  - Opt #2: ElementwiseProblem + explicit per-chromosome evaluation keeps
    memory usage flat (no large F/G matrix allocation) and enables future
    parallelism via pymoo's runner argument.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import TYPE_CHECKING

import numpy as np
from pymoo.algorithms.moo.nsga2 import NSGA2
from pymoo.core.problem import ElementwiseProblem
from pymoo.optimize import minimize

from api.schemas.optimize import DeliveryStop
from core.config import get_settings
from ml.osmnx_provider import RoadNetworkProvider, get_road_network_provider

if TYPE_CHECKING:
    pass


def _emission_factor(vehicle_type: str) -> float:
    return 0.025 if "electric" in vehicle_type else 0.243


def _origin_for_hub(origin_hub: str) -> tuple[float, float]:
    hubs = {
        "hub_jakarta_selatan": (-6.2610, 106.8060),
        "hub_jakarta_timur": (-6.2200, 106.9000),
        "hub_tangerang": (-6.1780, 106.6300),
    }
    return hubs.get(origin_hub, (-6.2000, 106.8167))


class RoutingProblem(ElementwiseProblem):
    """NSGA-II problem definition for multi-stop route optimization.

    Uses ElementwiseProblem so each chromosome is evaluated independently,
    making it easy to add parallel evaluation later (n_process argument).

    Opt #1: _metrics_cache stores results for already-evaluated orderings so
    that when NSGA-II revisits the same stop permutation (common in early
    generations), we skip all distance calculations.
    """

    def __init__(
        self,
        stops: list[DeliveryStop],
        vehicle_type: str,
        load_weight_kg: float,
        origin_hub: str,
        road_network: RoadNetworkProvider,
    ):
        super().__init__(n_var=len(stops), n_obj=4, n_ieq_constr=1, xl=0.0, xu=1.0)
        self.stops = stops
        self.vehicle_type = vehicle_type
        self.load_weight_kg = load_weight_kg
        self.origin = _origin_for_hub(origin_hub)
        self.factor = _emission_factor(vehicle_type)
        self.road_network = road_network
        # Opt #1: cache computed metrics keyed by the sorted order tuple.
        # Only caches non-geometry results (used during NSGA-II iterations).
        self._metrics_cache: dict[tuple[int, ...], dict] = {}

    def _evaluate(self, x: np.ndarray, out: dict, *args, **kwargs) -> None:
        """Evaluate a single chromosome. Called by ElementwiseProblem."""
        order = np.argsort(x)
        metrics = self.metrics_for_order(order)
        out["F"] = [
            metrics["travel_time_min"],
            metrics["fuel_cost_idr"],
            metrics["co2_kg"],
            metrics["sla_risk_score"],
        ]
        out["G"] = [max(metrics["sla_risk_score"] - 69.999, 0.0)]

    def metrics_for_order(self, order: np.ndarray, include_geometry: bool = False) -> dict:
        """Compute route metrics for a given stop ordering.

        Args:
            order:            Integer array, indices into self.stops.
            include_geometry: If True, also compute the full route_coordinates
                              polyline (slow — only called in post-processing).

        Returns:
            Dict with travel_time_min, co2_kg, fuel_cost_idr, sla_risk_score,
            stops_order, route_geometry, distance_source.
        """
        cache_key = tuple(int(i) for i in order)

        # Opt #1: Return cached result for non-geometry evaluations.
        if not include_geometry and cache_key in self._metrics_cache:
            return self._metrics_cache[cache_key]

        total_km = 0.0
        cursor = self.origin
        ordered_stops = [self.stops[int(i)] for i in order]
        route_points = [self.origin]

        for stop in ordered_stops:
            point = (stop.destination_lat, stop.destination_lng)
            total_km += self.road_network.distance_km(cursor, point, vehicle_type=self.vehicle_type)
            cursor = point
            route_points.append(point)

        traffic_multiplier = 1.25
        travel_time_min = max(1, int(total_km / 35 * 60 * traffic_multiplier))
        co2_kg = round(total_km * (self.load_weight_kg / 1000.0) * self.factor, 4)
        fuel_cost_idr = int(total_km * (900 if "electric" in self.vehicle_type else 1800))

        latest_deadline = min(stop.sla_deadline for stop in ordered_stops)
        remaining_min = (latest_deadline - datetime.now(timezone.utc)).total_seconds() / 60
        sla_risk = (
            100.0
            if travel_time_min > remaining_min
            else min(65.0, travel_time_min / max(remaining_min, 1) * 50)
        )

        geometry_coordinates = (
            self.road_network.route_coordinates(route_points, vehicle_type=self.vehicle_type)
            if include_geometry
            else [[lng, lat] for lat, lng in route_points]
        )

        result: dict = {
            "stops_order": [stop.shipment_id for stop in ordered_stops],
            "route_geometry": {
                "type": "LineString",
                "coordinates": geometry_coordinates,
            },
            "distance_source": self.road_network.last_source,
            "travel_time_min": travel_time_min,
            "co2_kg": co2_kg,
            "fuel_cost_idr": fuel_cost_idr,
            "sla_risk_score": round(sla_risk, 2),
        }

        # Opt #1: Cache only non-geometry results (geometry path is called once).
        if not include_geometry:
            self._metrics_cache[cache_key] = result

        return result


def _label_solutions(solutions: list[dict]) -> list[dict]:
    fastest = min(solutions, key=lambda item: item["travel_time_min"])["index"]
    lowest = min(solutions, key=lambda item: item["co2_kg"])["index"]
    for item in solutions:
        if item["index"] == fastest:
            item["label"] = "fastest"
        elif item["index"] == lowest:
            item["label"] = "lowest_emission"
        else:
            item["label"] = "balanced"
    return solutions


import asyncio

async def optimize_route(
    stops: list[DeliveryStop],
    vehicle_type: str,
    load_weight_kg: float,
    origin_hub: str,
    routing_engine: str = "osmnx",
) -> tuple[list[dict], int, bool]:
    """Run NSGA-II and return the Pareto-optimal route solutions."""
    return await asyncio.to_thread(_optimize_route_sync, stops, vehicle_type, load_weight_kg, origin_hub, routing_engine)

def _optimize_route_sync(
    stops: list[DeliveryStop],
    vehicle_type: str,
    load_weight_kg: float,
    origin_hub: str,
    routing_engine: str = "osmnx",
) -> tuple[list[dict], int, bool]:
    started = time.perf_counter()
    settings = get_settings()

    # Demo mode uses a smaller population / generation count so the API
    # responds within the 5-second target for live demonstrations.
    if settings.demo_mode:
        pop_size = min(settings.nsga2_population_size, 30)
        n_gen = min(settings.nsga2_generations, 50)
    else:
        pop_size = settings.nsga2_population_size
        n_gen = settings.nsga2_generations

    if routing_engine == "stadia":
        from ml.stadia_provider import get_stadia_provider
        provider = get_stadia_provider()
    else:
        provider = get_road_network_provider()

    problem = RoutingProblem(
        stops,
        vehicle_type,
        load_weight_kg,
        origin_hub,
        provider,
    )
    # Opt #2: ElementwiseProblem allows future n_process parallelism.
    algorithm = NSGA2(pop_size=pop_size)
    result = minimize(
        problem,
        algorithm,
        ("n_gen", n_gen),
        seed=42,
        verbose=False,
    )

    rows = (
        result.X
        if result.X is not None
        else np.random.default_rng(42).random((1, len(stops)))
    )

    seen: set[tuple[str, ...]] = set()
    solutions: list[dict] = []
    for row in rows:
        # include_geometry=True here — called once per unique solution.
        metrics = problem.metrics_for_order(np.argsort(row), include_geometry=True)
        key = tuple(metrics["stops_order"])
        if key in seen:
            continue
        seen.add(key)
        metrics["index"] = len(solutions)
        metrics["label"] = "balanced"
        solutions.append(metrics)
        if len(solutions) >= 8:
            break

    if not solutions:
        metrics = problem.metrics_for_order(np.arange(len(stops)), include_geometry=True)
        metrics["index"] = 0
        metrics["label"] = "balanced"
        solutions.append(metrics)

    pareto = sorted(
        solutions,
        key=lambda item: (item["sla_risk_score"], item["travel_time_min"], item["co2_kg"]),
    )
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    compliant = all(item["sla_risk_score"] < 70 for item in pareto)
    return _label_solutions(pareto), elapsed_ms, compliant
