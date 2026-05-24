import itertools
import math
import time
from datetime import datetime, timezone

from api.schemas.optimize import DeliveryStop


def _distance(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) * 111


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
    origin = (-6.2000, 106.8167)
    emission_factor = 0.025 if "electric" in vehicle_type else 0.243
    permutations = list(itertools.permutations(stops))
    if len(permutations) > 120:
        permutations = permutations[:120]

    solutions = []
    for index, route in enumerate(permutations):
        total_km = 0.0
        cursor = origin
        for stop in route:
            point = (stop.destination_lat, stop.destination_lng)
            total_km += _distance(cursor, point)
            cursor = point
        traffic_multiplier = 1.25
        travel_time_min = max(1, int(total_km / 35 * 60 * traffic_multiplier))
        co2_kg = round(total_km * (load_weight_kg / 1000.0) * emission_factor, 4)
        fuel_cost_idr = int(total_km * (900 if "electric" in vehicle_type else 1800))
        latest_deadline = min(stop.sla_deadline for stop in route)
        remaining_min = (latest_deadline - datetime.now(timezone.utc)).total_seconds() / 60
        sla_risk = 100.0 if travel_time_min > remaining_min else min(65.0, travel_time_min / max(remaining_min, 1) * 50)
        solutions.append(
            {
                "index": index,
                "label": "balanced",
                "stops_order": [stop.shipment_id for stop in route],
                "travel_time_min": travel_time_min,
                "co2_kg": co2_kg,
                "fuel_cost_idr": fuel_cost_idr,
                "sla_risk_score": round(sla_risk, 2),
            }
        )

    pareto = sorted(solutions, key=lambda item: (item["travel_time_min"], item["co2_kg"]))[: min(8, len(solutions))]
    return _label_solutions(pareto), int((time.perf_counter() - started) * 1000), all(item["sla_risk_score"] < 70 for item in pareto)
