import type {ActiveShipmentsResponse, CarbonAnalytics, HubMetric, PredictionDetail, RecentAlert, RouteOptimizationResponse, ShipmentEvent} from "./api";

export const demoShipments: ActiveShipmentsResponse = {
  total_at_risk: 3,
  next_cursor: null,
  shipments: [
    {
      id: "7f2a4ef2-5c5a-45a7-9e4a-58ad3a60b101",
      external_id: "ORCA-JKT-1048",
      origin_hub_id: "hub_jakarta_selatan",
      destination_zone: "Bekasi Barat",
      vehicle_type: "van",
      sla_deadline: new Date(Date.now() + 1000 * 60 * 90).toISOString(),
      dispatched_at: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
      delay_probability: 0.78,
      sla_risk_score: 82,
      predicted_delay_hours: 2.6,
      co2_kg: 14.8,
      status: "in_transit",
      intervention_recommended: "reroute_via_toll"
    },
    {
      id: "77bb1147-f19f-4f44-8ca6-b7d53723b102",
      external_id: "ORCA-JKT-1052",
      origin_hub_id: "hub_jakarta_timur",
      destination_zone: "Depok",
      vehicle_type: "motorcycle",
      sla_deadline: new Date(Date.now() + 1000 * 60 * 180).toISOString(),
      dispatched_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      delay_probability: 0.44,
      sla_risk_score: 48,
      predicted_delay_hours: 1.1,
      co2_kg: 3.4,
      status: "in_transit",
      intervention_recommended: "notify_customer_proactively"
    },
    {
      id: "55a88fc2-ea15-4bf1-bb81-9910a01bb103",
      external_id: "ORCA-JKT-1060",
      origin_hub_id: "hub_tangerang",
      destination_zone: "Jakarta Pusat",
      vehicle_type: "truck",
      sla_deadline: new Date(Date.now() + 1000 * 60 * 260).toISOString(),
      dispatched_at: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
      delay_probability: 0.21,
      sla_risk_score: 26,
      predicted_delay_hours: 0.4,
      co2_kg: 31.2,
      status: "in_transit",
      intervention_recommended: "monitor"
    }
  ]
};

export const demoPrediction: PredictionDetail = {
  shipment_id: demoShipments.shipments[0].id,
  delay_probability: 0.78,
  sla_risk_score: 82,
  predicted_delay_hours: 2.6,
  model_version: "fallback-mvp",
  shap_contributions: [
    {feature: "remaining_hours_to_sla", value: 1.5, contribution: 0.32},
    {feature: "historical_hub_delay_rate", value: 0.28, contribution: 0.24},
    {feature: "distance_km", value: 38.4, contribution: 0.18},
    {feature: "weather_severity_score", value: 0.2, contribution: 0.08}
  ],
  intervention_options: ["reroute_via_toll", "notify_customer_proactively", "escalate_to_courier_manager"]
};

export const demoCarbon: CarbonAnalytics = {
  total_co2_kg: 1842.6,
  avg_co2_per_shipment_kg: 9.7,
  vs_baseline_pct: -11.2,
  recent_routes: [],
  glec_version: "3.0",
  by_day: [
    {date: "2026-05-20", co2_kg: 220.4, shipment_count: 21},
    {date: "2026-05-21", co2_kg: 244.2, shipment_count: 25},
    {date: "2026-05-22", co2_kg: 198.7, shipment_count: 18},
    {date: "2026-05-23", co2_kg: 310.3, shipment_count: 32},
    {date: "2026-05-24", co2_kg: 276.9, shipment_count: 28},
    {date: "2026-05-25", co2_kg: 282.8, shipment_count: 30},
    {date: "2026-05-26", co2_kg: 309.3, shipment_count: 36}
  ],
  by_vehicle_type: [
    {vehicle_type: "truck", co2_kg: 820.5, shipment_count: 32},
    {vehicle_type: "van", co2_kg: 641.4, shipment_count: 78},
    {vehicle_type: "motorcycle", co2_kg: 380.7, shipment_count: 80}
  ]
};

export const demoHubs: HubMetric[] = [
  {
    hub_id: "hub_jakarta_selatan",
    hub_name: "Jakarta Selatan",
    current_inbound_volume: 182,
    avg_dwell_time_min: 72,
    delay_rate_7d: 0.31,
    congestion_level: "high",
    alert: true
  },
  {
    hub_id: "hub_jakarta_timur",
    hub_name: "Jakarta Timur",
    current_inbound_volume: 118,
    avg_dwell_time_min: 44,
    delay_rate_7d: 0.19,
    congestion_level: "medium",
    alert: false
  },
  {
    hub_id: "hub_tangerang",
    hub_name: "Tangerang",
    current_inbound_volume: 96,
    avg_dwell_time_min: 28,
    delay_rate_7d: 0.11,
    congestion_level: "low",
    alert: false
  }
];

export const demoAlerts: RecentAlert[] = [
  {
    id: "alert-001",
    shipment_id: demoShipments.shipments[0].id,
    external_id: demoShipments.shipments[0].external_id,
    alert_type: "sla_risk",
    sla_risk_score: 82,
    intervention: "reroute_via_toll",
    created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString()
  }
];

export const demoShipmentEvents: ShipmentEvent[] = [
  {
    id: "event-001",
    shipment_id: demoShipments.shipments[0].id,
    event_type: "shipment_event",
    event_payload: {status: "in_transit", origin_hub_id: "hub_jakarta_selatan"},
    created_at: demoShipments.shipments[0].dispatched_at ?? new Date().toISOString(),
  },
  {
    id: "event-002",
    shipment_id: demoShipments.shipments[0].id,
    event_type: "prediction_update",
    event_payload: {sla_risk_score: 82, intervention: "reroute_via_toll"},
    created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
];

export const demoRoute: RouteOptimizationResponse = {
  request_id: "opt-demo",
  vehicle_id: "B-ORCA-21",
  optimization_time_ms: 184,
  sla_compliance_guaranteed: true,
  pareto_solutions: [
    {index: 0, label: "Fastest", stops_order: ["Bekasi Barat", "Depok", "Jakarta Pusat"], route_geometry: {type: "LineString", coordinates: [[106.806, -6.261], [106.992, -6.238], [106.817, -6.402], [106.827, -6.175]]}, travel_time_min: 92, co2_kg: 18.2, fuel_cost_idr: 72000, sla_risk_score: 24},
    {index: 1, label: "Lowest CO2", stops_order: ["Jakarta Pusat", "Depok", "Bekasi Barat"], route_geometry: {type: "LineString", coordinates: [[106.806, -6.261], [106.827, -6.175], [106.817, -6.402], [106.992, -6.238]]}, travel_time_min: 116, co2_kg: 12.7, fuel_cost_idr: 64000, sla_risk_score: 33},
    {index: 2, label: "Balanced", stops_order: ["Depok", "Jakarta Pusat", "Bekasi Barat"], route_geometry: {type: "LineString", coordinates: [[106.806, -6.261], [106.817, -6.402], [106.827, -6.175], [106.992, -6.238]]}, travel_time_min: 104, co2_kg: 15.1, fuel_cost_idr: 68000, sla_risk_score: 28}
  ]
};

export type Point = {
  label: string
  coordinates: [number, number]
  tone?: "default" | "high" | "medium" | "low"
}

export const jakartaRoutePoints: Point[] = [
  {label: "DC Cakung (Origin)", coordinates: [106.945, -6.182], tone: "default"},
  {label: "Cikarang Hub", coordinates: [107.143, -6.326], tone: "high"},
  {label: "Sunter DC", coordinates: [106.877, -6.143], tone: "medium"},
  {label: "Bogor DC", coordinates: [106.793, -6.597], tone: "low"},
]

export const hubMapPoints: Point[] = [
  {label: "DC Cakung", coordinates: [106.945, -6.182], tone: "high"},
  {label: "Cikarang Hub", coordinates: [107.143, -6.326], tone: "medium"},
  {label: "Sunter DC", coordinates: [106.877, -6.143], tone: "low"},
]
