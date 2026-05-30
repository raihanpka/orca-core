export function vehicleLabel(v: string) {
  const map: Record<string, string> = {
    scooter_electric: "Electric Scooter",
    van_diesel: "Diesel Van",
    truck_lt35t: "Truck < 3.5t",
    truck_35_75t: "Truck 3.5–7.5t",
    truck_gt75t: "Truck > 7.5t",
  }
  return map[v] ?? v
}

export function interventionLabel(key: string) {
  const map: Record<string, string> = {
    monitor: "Continue monitoring - risk within acceptable range",
    notify_customer_proactively: "Notify customer proactively about potential delay",
    reroute_via_toll: "Reroute via toll road to save time",
    escalate_to_courier_manager: "Escalate to courier manager immediately",
  }
  return map[key] ?? key
}

export function interventionColor(key: string) {
  if (key === "escalate_to_courier_manager" || key === "reroute_via_toll")
    return "text-red-700 bg-red-50 border-red-200"
  if (key === "notify_customer_proactively")
    return "text-amber-700 bg-amber-50 border-amber-200"
  return "text-emerald-700 bg-emerald-50 border-emerald-200"
}

export function featureLabel(f: string) {
  const map: Record<string, string> = {
    distance_km: "Route Distance",
    weather_severity_score: "Weather Severity",
    historical_hub_delay_rate: "Hub Delay Rate",
    historical_driver_rate: "Driver Reliability",
    estimated_delivery_days: "Delivery Window",
    item_count: "Item Count",
    product_weight_g: "Package Weight",
    hub_zone_encoded: "Hub Zone",
    is_lebaran_window: "Lebaran Window",
    is_ramadan: "Ramadan Period",
    is_harbolnas_buildup: "Harbolnas Build-up",
    indonesia_peak_season: "Peak Season",
  }
  return map[f] ?? f.replace(/_/g, " ")
}
