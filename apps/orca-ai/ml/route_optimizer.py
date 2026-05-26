import math
import time
from datetime import datetime, timezone

import numpy as np
from pymoo.algorithms.moo.nsga2 import NSGA2
from pymoo.core.problem import Problem
from pymoo.optimize import minimize

from api.schemas.optimize import DeliveryStop
from core.config import get_settings


def _distance(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) * 111


def _emission_factor(vehicle_type: str) -> float:
    return 0.025 if "electric" in vehicle_type else 0.243


def _origin_for_hub(origin_hub: str) -> tuple[float, float]:
    hubs = {
        "hub_jakarta_selatan": (-6.2610, 106.8060),
        "hub_jakarta_timur": (-6.2200, 106.9000),
        "hub_tangerang": (-6.1780, 106.6300),
    }
    return hubs.get(origin_hub, (-6.2000, 106.8167))


class RoutingProblem(Problem):
    def __init__(self, stops: list[DeliveryStop], vehicle_type: str, load_weight_kg: float, origin_hub: str):
        super().__init__(n_var=len(stops), n_obj=4, n_ieq_constr=1, xl=0.0, xu=1.0)
        self.stops = stops
        self.vehicle_type = vehicle_type
        self.load_weight_kg = load_weight_kg
        self.origin = _origin_for_hub(origin_hub)
        self.factor = _emission_factor(vehicle_type)

    def _evaluate(self, x, out, *args, **kwargs):
        objectives = []
        constraints = []
        for chromosome in x:
            metrics = self.metrics_for_order(np.argsort(chromosome))
            objectives.append(
                [
                    metrics["travel_time_min"],
                    metrics["fuel_cost_idr"],
                    metrics["co2_kg"],
                    metrics["sla_risk_score"],
                ]
            )
            constraints.append([max(metrics["sla_risk_score"] - 69.999, 0.0)])
        out["F"] = np.array(objectives, dtype=float)
        out["G"] = np.array(constraints, dtype=float)

    def metrics_for_order(self, order: np.ndarray) -> dict:
        total_km = 0.0
        cursor = self.origin
        ordered_stops = [self.stops[int(index)] for index in order]
        for stop in ordered_stops:
            point = (stop.destination_lat, stop.destination_lng)
            total_km += _distance(cursor, point)
            cursor = point

        traffic_multiplier = 1.25
        travel_time_min = max(1, int(total_km / 35 * 60 * traffic_multiplier))
        co2_kg = round(total_km * (self.load_weight_kg / 1000.0) * self.factor, 4)
        fuel_cost_idr = int(total_km * (900 if "electric" in self.vehicle_type else 1800))
        latest_deadline = min(stop.sla_deadline for stop in ordered_stops)
        remaining_min = (latest_deadline - datetime.now(timezone.utc)).total_seconds() / 60
        sla_risk = 100.0 if travel_time_min > remaining_min else min(65.0, travel_time_min / max(remaining_min, 1) * 50)
        geometry_coordinates = [[self.origin[1], self.origin[0]]] + [
            [stop.destination_lng, stop.destination_lat] for stop in ordered_stops
        ]
        return {
            "stops_order": [stop.shipment_id for stop in ordered_stops],
            "route_geometry": {
                "type": "LineString",
                "coordinates": geometry_coordinates,
            },
            "travel_time_min": travel_time_min,
            "co2_kg": co2_kg,
            "fuel_cost_idr": fuel_cost_idr,
            "sla_risk_score": round(sla_risk, 2),
        }


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


async def optimize_route(stops: list[DeliveryStop], vehicle_type: str, load_weight_kg: float, origin_hub: str) -> tuple[list[dict], int, bool]:
    started = time.perf_counter()
    settings = get_settings()
    problem = RoutingProblem(stops, vehicle_type, load_weight_kg, origin_hub)
    algorithm = NSGA2(pop_size=settings.nsga2_population_size)
    result = minimize(
        problem,
        algorithm,
        ("n_gen", settings.nsga2_generations),
        seed=42,
        verbose=False,
    )

    rows = result.X if result.X is not None else np.random.default_rng(42).random((1, len(stops)))
    seen: set[tuple[str, ...]] = set()
    solutions = []
    for row in rows:
        metrics = problem.metrics_for_order(np.argsort(row))
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
        metrics = problem.metrics_for_order(np.arange(len(stops)))
        metrics["index"] = 0
        metrics["label"] = "balanced"
        solutions.append(metrics)

    pareto = sorted(solutions, key=lambda item: (item["sla_risk_score"], item["travel_time_min"], item["co2_kg"]))
    return _label_solutions(pareto), int((time.perf_counter() - started) * 1000), all(item["sla_risk_score"] < 70 for item in pareto)
