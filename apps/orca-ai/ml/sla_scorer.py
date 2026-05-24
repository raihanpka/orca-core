def compute_sla_risk(delay_probability: float, remaining_hours: float) -> tuple[float, str]:
    if remaining_hours > 24:
        urgency_weight = 0.5
    elif remaining_hours > 8:
        urgency_weight = 0.8
    else:
        urgency_weight = 1.2

    score = min(max(delay_probability, 0.0) * urgency_weight * 100, 100.0)
    if score >= 70:
        urgency = "high"
    elif score >= 40:
        urgency = "medium"
    else:
        urgency = "low"
    return round(score, 2), urgency
