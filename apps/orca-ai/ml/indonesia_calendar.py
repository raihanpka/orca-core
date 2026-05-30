"""Indonesian calendar features for delivery delay prediction.

Computes 7 features from a datetime that capture Indonesia-specific
disruption patterns: Lebaran (Eid al-Fitr), Harbolnas 11.11/12.12, Ramadan,
cuti bersama, and e-commerce peak seasons.

Lebaran dates cover 2016-2030 so features are non-zero for Olist (2016-2018)
training data as well as live Indonesian inference.
"""
from datetime import date, datetime, timedelta
from typing import Any

LEBARAN_DATES: dict[int, date] = {
    # Historical (covers Olist Brazil 2016–2018 training data)
    2016: date(2016, 7, 6),   # Eid al-Fitr 1437H
    2017: date(2017, 6, 26),  # Eid al-Fitr 1438H
    2018: date(2018, 6, 15),  # Eid al-Fitr 1439H
    2019: date(2019, 6, 5),   # Eid al-Fitr 1440H
    # Current / future
    2020: date(2020, 5, 24),
    2021: date(2021, 5, 13),
    2022: date(2022, 5, 2),
    2023: date(2023, 4, 22),
    2024: date(2024, 4, 10),
    2025: date(2025, 3, 30),
    2026: date(2026, 3, 20),
    2027: date(2027, 3, 10),
    2028: date(2028, 2, 27),
    2029: date(2029, 2, 15),
    2030: date(2030, 2, 5),
}

RAMADAN_START_OFFSETS_DAYS = 30

HARBOLNAS_DATES: set[date] = set()
for _y in range(2016, 2031):
    HARBOLNAS_DATES.add(date(_y, 11, 11))
    HARBOLNAS_DATES.add(date(_y, 12, 12))

INDONESIA_FEATURES = [
    "days_to_lebaran",
    "is_lebaran_window",
    "is_harbolnas",
    "is_ramadan",
    "is_post_longweekend",
    "is_harbolnas_buildup",
    "indonesia_peak_season",
]


def _nearest_lebaran(d: date) -> tuple[date, int]:
    """Find the next upcoming Lebaran date and return (date, days_until).

    Always returns a non-negative `days_until` in [0, ~365].
    Past Lebaran dates are skipped; the function looks forward only.
    """
    best_date = None
    best_delta = 99999
    for year_date in sorted(LEBARAN_DATES.values()):
        delta = (year_date - d).days
        if delta < 0:
            continue  # skip past Lebaran dates
        if delta < best_delta:
            best_delta = delta
            best_date = year_date
    if best_date is None:
        # All known dates exhausted (shouldn't happen with 2030 coverage)
        best_date = date(2030, 2, 5)
        best_delta = (best_date - d).days
    return best_date, max(best_delta, 0)


def compute(dt: datetime | date | None) -> dict[str, int | float]:
    """Compute 7 Indonesia calendar features from a datetime.

    Returns a dict matching INDONESIA_FEATURES keys, all defaulting to 0
    when dt is None (safe for Brazilian training data).
    """
    if dt is None:
        return {k: 0 for k in INDONESIA_FEATURES}

    d = dt.date() if isinstance(dt, datetime) else dt

    lebaran_date, days_to_lebaran = _nearest_lebaran(d)

    # Lebaran window: ±7 days around any known Lebaran date
    is_lebaran_window = int(
        any(abs((d - ld).days) <= 7 for ld in LEBARAN_DATES.values())
    )

    # Ramadan: approximately 30 days before each known Lebaran
    is_ramadan = int(
        any(
            (ld - timedelta(days=RAMADAN_START_OFFSETS_DAYS)) <= d <= ld
            for ld in LEBARAN_DATES.values()
        )
    )

    # Harbolnas (Hari Belanja Online Nasional): 11.11 and 12.12
    is_harbolnas = int(d in HARBOLNAS_DATES)

    # Harbolnas buildup: 3 days before and the day of 11.11 / 12.12
    is_harbolnas_buildup = 0
    for hd in HARBOLNAS_DATES:
        if 0 <= (hd - d).days <= 3:
            is_harbolnas_buildup = 1
            break

    # Post long-weekend: Monday after a Saturday/Sunday holiday cluster
    # Simplified: first working day after any weekend is always Monday (weekday=0)
    is_post_longweekend = int(d.weekday() == 0 and (is_lebaran_window or is_ramadan))

    # Indonesia peak season: Nov 1 - Dec 31 (Harbolnas) or Ramadan/Lebaran window
    is_peak = int(
        d.month in (11, 12)
        or is_ramadan
        or is_lebaran_window
    )

    return {
        "days_to_lebaran": min(days_to_lebaran, 365),
        "is_lebaran_window": is_lebaran_window,
        "is_harbolnas": is_harbolnas,
        "is_ramadan": is_ramadan,
        "is_post_longweekend": is_post_longweekend,
        "is_harbolnas_buildup": is_harbolnas_buildup,
        "indonesia_peak_season": is_peak,
    }
