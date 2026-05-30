"""SLA risk scoring formula.

Opt #7: amplifier is now an explicit parameter with a sensible default,
so callers processing batches of shipments can read settings once and pass it
in directly — avoiding 50 LRU lookups per batch call.
"""

from __future__ import annotations


def compute_sla_risk(
    delay_probability: float,
    remaining_hours: float,
    amplifier: float = 2.0,
) -> tuple[float, str]:
    """Compute SLA risk score [0, 100] and urgency tier.

    Formula:
        risk_score = clip(delay_probability × urgency_weight × amplifier × 100, 0, 100)

    The amplifier is needed because calibrated probabilities on imbalanced data
    (e.g., 5% positive rate) cap at ~0.20, so naive amplifier=1 would yield max
    score ~24 — never crossing the 70 alert threshold. With amplifier=4, a
    high-urgency shipment with delay_probability=0.20 gets score=96 → "high".

    Args:
        delay_probability: Model output in [0, 1].
        remaining_hours:   Hours until SLA deadline.
        amplifier:         Scaling factor; read from settings by the caller.
                           Defaults to 4.0 (matches Settings.sla_risk_amplifier).

    Returns:
        (risk_score, urgency_tier)  where urgency_tier ∈ {"low", "medium", "high"}.
    """
    if remaining_hours > 24:
        urgency_weight = 0.5
    elif remaining_hours > 8:
        urgency_weight = 0.8
    else:
        urgency_weight = 1.2

    raw = max(delay_probability, 0.0) * urgency_weight * amplifier * 100
    score = min(raw, 100.0)

    if score >= 70:
        urgency = "high"
    elif score >= 40:
        urgency = "medium"
    else:
        urgency = "low"
    return round(score, 2), urgency
