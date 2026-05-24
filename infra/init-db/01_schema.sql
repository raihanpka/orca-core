CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

CREATE TABLE IF NOT EXISTS glec_emission_factors (
  vehicle_type VARCHAR(30) PRIMARY KEY,
  fuel_type VARCHAR(20) NOT NULL,
  emission_factor DECIMAL(8,6) NOT NULL,
  glec_version VARCHAR(10) NOT NULL DEFAULT '3.0',
  notes TEXT
);

INSERT INTO glec_emission_factors VALUES
  ('scooter_electric', 'electric', 0.025000, '3.0', 'Urban last-mile electric scooter'),
  ('van_diesel', 'diesel', 0.243000, '3.0', 'Diesel van < 3.5t GVW'),
  ('truck_lt35t', 'diesel', 0.218000, '3.0', 'Diesel truck < 3.5t GVW'),
  ('truck_35_75t', 'diesel', 0.178000, '3.0', 'Diesel truck 3.5 to 7.5t GVW'),
  ('truck_gt75t', 'diesel', 0.147000, '3.0', 'Diesel truck > 7.5t GVW')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(100) UNIQUE,
  origin_hub_id VARCHAR(50) NOT NULL,
  destination_zone VARCHAR(50),
  customer_lat DECIMAL(9,6),
  customer_lng DECIMAL(9,6),
  vehicle_type VARCHAR(30) NOT NULL REFERENCES glec_emission_factors(vehicle_type),
  load_weight_kg DECIMAL(10,2),
  item_count INT,
  sla_deadline TIMESTAMPTZ NOT NULL,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'delivered', 'failed')),
  distance_km DECIMAL(8,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_hub ON shipments(origin_hub_id);
CREATE INDEX IF NOT EXISTS idx_shipments_sla ON shipments(sla_deadline) WHERE status = 'in_transit';

CREATE TABLE IF NOT EXISTS shipment_predictions (
  time TIMESTAMPTZ NOT NULL,
  shipment_id UUID NOT NULL REFERENCES shipments(id),
  delay_probability DECIMAL(5,4) NOT NULL,
  sla_risk_score DECIMAL(5,2) NOT NULL,
  predicted_delay_hrs DECIMAL(6,2),
  model_version VARCHAR(50),
  features_json JSONB
);
SELECT create_hypertable('shipment_predictions', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_predictions_shipment ON shipment_predictions(shipment_id, time DESC);

CREATE TABLE IF NOT EXISTS carbon_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL UNIQUE REFERENCES shipments(id),
  route_distance_km DECIMAL(8,2) NOT NULL,
  co2_kg DECIMAL(8,4) NOT NULL,
  vehicle_type VARCHAR(30) NOT NULL,
  load_weight_ton DECIMAL(8,4) NOT NULL,
  emission_factor DECIMAL(8,6) NOT NULL,
  glec_version VARCHAR(10) NOT NULL DEFAULT '3.0',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS route_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR(100) NOT NULL,
  vehicle_id VARCHAR(50),
  shipment_ids UUID[] NOT NULL,
  pareto_solutions JSONB NOT NULL,
  selected_index INT,
  optimization_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_metrics (
  time TIMESTAMPTZ NOT NULL,
  hub_id VARCHAR(50) NOT NULL,
  inbound_volume INT NOT NULL DEFAULT 0,
  avg_dwell_time_min DECIMAL(6,2),
  delay_rate DECIMAL(5,4),
  active_shipments INT NOT NULL DEFAULT 0
);
SELECT create_hypertable('hub_metrics', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_hub_metrics_hub ON hub_metrics(hub_id, time DESC);

CREATE TABLE IF NOT EXISTS alert_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id),
  alert_type VARCHAR(50) NOT NULL,
  sla_risk_score DECIMAL(5,2),
  intervention VARCHAR(100),
  notified_via TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_logs_shipment ON alert_logs(shipment_id, created_at DESC);
