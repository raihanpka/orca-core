from core.config import get_settings


def compute_sla_risk(delay_probability: float, remaining_hours: float) -> tuple[float, str]:
    """Compute SLA risk score [0, 100] and urgency tier.

    Formula:
        risk_score = clip(delay_probability × urgency_weight × risk_amplifier × 100, 0, 100)

    The amplifier is needed because calibrated probabilities on imbalanced data
    (e.g., 5% positive rate) cap at ~0.20, so naive amplifier=1 would yield max
    score ~24 — never crossing the 70 alert threshold. With amplifier=4, a
    high-urgency shipment with delay_probability=0.20 gets score=96 → "high".
    """
    settings = get_settings()

    if remaining_hours > 24:
        urgency_weight = 0.5
    elif remaining_hours > 8:
        urgency_weight = 0.8
    else:
        urgency_weight = 1.2

    raw = max(delay_probability, 0.0) * urgency_weight * settings.sla_risk_amplifier * 100
    score = min(raw, 100.0)

    if score >= 70:
        urgency = "high"
    elif score >= 40:
        urgency = "medium"
    else:
        urgency = "low"
    return round(score, 2), urgency
