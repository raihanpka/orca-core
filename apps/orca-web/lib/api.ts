export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001";
export const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN ?? "orca-public-local-token";

type ApiEnvelope<T> = {
  status?: string;
  data?: T;
};

export type Shipment = {
  id: string;
  external_id?: string | null;
  origin_hub_id: string;
  destination_zone: string;
  vehicle_type: string;
  sla_deadline?: string | null;
  dispatched_at?: string | null;
  delay_probability?: number | null;
  sla_risk_score?: number | null;
  predicted_delay_hours?: number | null;
  co2_kg?: number | null;
  distance_km?: number | null;
  load_weight_kg?: number | null;
  status: string;
  intervention_recommended?: string | null;
};

export type ShipmentDetail = {
  id: string;
  external_id?: string | null;
  origin_hub_id: string;
  destination_zone: string;
  vehicle_type: string;
  load_weight_kg: number;
  item_count: number;
  distance_km: number;
  status: string;
  sla_deadline: string;
  dispatched_at: string;
  created_at: string;
  carbon?: {
    co2_kg: number | null;
    distance_km: number | null;
    emission_factor: number | null;
    glec_version: string | null;
  } | null;
};

export type ShapContribution = {
  feature: string;
  value: number;
  contribution: number;
};

export type ActiveShipmentsResponse = {
  shipments: Shipment[];
  next_cursor?: string | null;
  total_at_risk: number;
};

export type PredictionDetail = {
  shipment_id: string;
  delay_probability: number;
  sla_risk_score: number;
  predicted_delay_hours: number;
  model_version: string;
  shap_contributions: Array<{
    feature: string;
    value: number;
    contribution: number;
  }>;
  intervention_options: string[];
};

export type ShipmentEvent = {
  id: string;
  shipment_id: string;
  event_type: string;
  event_payload: Record<string, unknown>;
  created_at: string;
};

export type CarbonAnalytics = {
  total_co2_kg: number;
  avg_co2_per_shipment_kg: number;
  vs_baseline_pct: number;
  by_day: Array<{date: string; co2_kg: number; shipment_count: number}>;
  by_vehicle_type: Array<{vehicle_type: string; co2_kg: number; shipment_count: number}>;
  recent_routes: {
    shipment_id: string
    external_id: string
    origin: string
    destination: string
    vehicle_type: string
    co2_kg: number
    distance_km: number
    load_weight_kg: number
    calculated_at: string
  }[]
  glec_version: string;
};

export type HubMetric = {
  hub_id: string;
  hub_name: string;
  current_inbound_volume: number;
  avg_dwell_time_min: number;
  delay_rate_7d: number;
  congestion_level: "low" | "medium" | "high";
  alert: boolean;
};

export type RecentAlert = {
  id: string;
  shipment_id: string;
  external_id?: string | null;
  alert_type: string;
  sla_risk_score: number;
  intervention: string;
  created_at: string;
};

export type RouteSolution = {
  index: number;
  label: string;
  stops_order: string[];
  route_geometry?: {
    type: "LineString";
    coordinates: [number, number][];
  };
  travel_time_min: number;
  co2_kg: number;
  fuel_cost_idr: number;
  sla_risk_score: number;
};

export type RouteOptimizationResponse = {
  request_id: string;
  vehicle_id: string;
  pareto_solutions: RouteSolution[];
  optimization_time_ms: number;
  sla_compliance_guaranteed: boolean;
};

export async function apiFetch<T>(path: string, init?: RequestInit, timeoutMs = 120_000): Promise<T> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-API-Token": API_TOKEN,
        ...(init?.headers ?? {})
      }
    });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    const payload = (await response.json()) as ApiEnvelope<T> | T;
    if (payload && typeof payload === "object" && "data" in payload) {
      return (payload as ApiEnvelope<T>).data as T;
    }
    return payload as T;
  } finally {
    clearTimeout(timerId);
  }
}
