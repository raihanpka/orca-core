async def load_emission_factors(db_pool) -> dict[str, dict]:
    if db_pool is None:
        return {"van_diesel": {"emission_factor": 0.243, "glec_version": "3.0"}}
    rows = await db_pool.fetch("SELECT vehicle_type, emission_factor, glec_version FROM glec_emission_factors")
    return {
        row["vehicle_type"]: {
            "emission_factor": float(row["emission_factor"]),
            "glec_version": row["glec_version"],
        }
        for row in rows
    }


def compute_co2(distance_km: float, load_weight_kg: float, vehicle_type: str, emission_factors: dict) -> float:
    load_weight_ton = load_weight_kg / 1000.0
    factor = emission_factors.get(vehicle_type, emission_factors.get("van_diesel", {})).get("emission_factor", 0.243)
    return round(distance_km * load_weight_ton * factor, 4)


async def write_carbon_record(db_pool, shipment_id: str, distance_km: float, load_weight_kg: float, vehicle_type: str) -> None:
    if db_pool is None:
        return
    factors = await load_emission_factors(db_pool)
    factor = factors.get(vehicle_type, factors["van_diesel"])
    co2_kg = compute_co2(distance_km, load_weight_kg, vehicle_type, factors)
    await db_pool.execute(
        """
        INSERT INTO carbon_records (
          shipment_id, route_distance_km, co2_kg, vehicle_type, load_weight_ton, emission_factor, glec_version
        )
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (shipment_id) DO NOTHING
        """,
        shipment_id,
        distance_km,
        co2_kg,
        vehicle_type,
        load_weight_kg / 1000.0,
        factor["emission_factor"],
        factor["glec_version"],
    )
