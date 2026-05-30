"""SLA risk scoring formula.

Combines LightGBM delay_probability with SLA time pressure:
  1. urgency_weight — tighter deadline → higher weight
  2. slack dampening — generous buffer (remaining >> travel time) lowers effective risk
  3. optional amplifier — legacy scale for imbalanced uncalibrated models (default 1.0)
"""

from __future__ import annotations


def compute_sla_risk(
    delay_probability: float,
    remaining_hours: float,
    amplifier: float = 1.0,
    distance_km: float | None = None,
    avg_speed_kmh: float = 35.0,
) -> tuple[float, str]:
    """Compute SLA risk score [0, 100] and urgency tier.

    Formula:
        effective_prob = delay_probability × slack_dampen(remaining, travel_time)
        risk_score = clip(effective_prob × urgency_weight × amplifier × 100, 0, 100)

    slack_dampen reduces risk when the SLA window has much more time than the
    estimated drive (e.g. 48 h remaining for a 30 km / ~1 h route).

    Args:
        delay_probability: LightGBM output in [0, 1].
        remaining_hours:   Hours until SLA deadline (from now).
        amplifier:         Legacy scale factor; default 1.0 for calibrated v2 model.
        distance_km:       Route distance; enables slack dampening when provided.
        avg_speed_kmh:     Assumed average speed for travel-time estimate.

    Returns:
        (risk_score, urgency_tier)  where urgency_tier ∈ {"low", "medium", "high"}.
    """
    if remaining_hours > 24:
        urgency_weight = 0.5
    elif remaining_hours > 8:
        urgency_weight = 0.8
    else:
        urgency_weight = 1.2

    effective_prob = max(delay_probability, 0.0)

    if distance_km is not None and distance_km > 0 and remaining_hours > 0:
        travel_hours = distance_km / avg_speed_kmh
        slack = remaining_hours / max(travel_hours, 0.1)
        if slack > 1.0:
            # e.g. slack=55 (48h for 0.87h drive) → dampen≈0.11
            dampen = 1.0 / (1.0 + (slack - 1.0) * 0.15)
            effective_prob *= dampen

    raw = effective_prob * urgency_weight * amplifier * 100
    score = min(raw, 100.0)

    if score >= 70:
        urgency = "high"
    elif score >= 40:
        urgency = "medium"
    else:
        urgency = "low"
    return round(score, 2), urgency
