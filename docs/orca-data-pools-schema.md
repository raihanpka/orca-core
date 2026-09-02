# ORCA Data Pools, Inputs, Processing, and Output Events

Decision record that extends `orca-parcel-data-model.md` into a complete data
catalog: pools, every input, every processing step, every output event, and
the full schema with explicit data types. SQL DDL is intentionally not
included here; it will be derived into `orca-core/infra/init-db/
02_parcel_model.sql` when implementation starts. Date: 2026-09-02.

## Schema evolution rule

The existing `01_schema.sql` stays untouched. The parcel model lands as
additive `02_parcel_model.sql`. The legacy flat tables (`shipments`,
`shipment_predictions`, `carbon_records`, `alert_logs`, `route_optimizations`)
remain for the current FastAPI era and are turned into compatibility views or
dropped at the Go gateway cutover.

## The 5 data pools

| Pool | Store | Character | Contents |
|---|---|---|---|
| 1. Master | TimescaleDB | slow-changing, small | node, catchment, partner, vehicle, driver, seller, sku, lane, rate card, SLA matrix, calendar, GLEC factors |
| 2. Operational | TimescaleDB | transactional, grows per run | customer, order, order_item, package, waybill, leg_plan, vehicle_run, run_manifest, scan_event, delivery_attempt, shipment_exception |
| 3. Stream | Redis Streams | in-flight buffer | 3 streams, consumer groups `ai` and `gateway`, pending entries |
| 4. Derived | TimescaleDB | intelligence output | waybill_prediction, carbon_record, alert, hub_metric, optimize_job, agent_note |
| 5. Context | TimescaleDB cache | external, polled | weather_observation, traffic_index, fuel_price_index |

Pool 3 is only a buffer; the source of truth is always pools 2 and 4.
Context (pool 5) enters via poll and cache, NOT through the stream, so the
event contract stays 6 canonical plus 4 derived types.

## Input catalog (8 entries)

| # | Input | Source | Path | Frequency | Key data |
|---|---|---|---|---|---|
| I1 | Create shipment | REST `POST /shipments` | gateway writes DB plus `XADD shipment_created` | per order | order, package split, billed weight, tier, leg plan v1 |
| I2 | Partner webhook | mock adapters (JNE, J&T, Wahana style) | `POST /webhooks/{partner}` mapped to canonical types then `XADD` | event-driven | AWB, partner status code to canonical code, reason code, node, timestamp |
| I3 | Scenario engine | Go mock generator | direct `XADD` | 50k shipments per run, daily wave | 6 canonical events, tiers FAS/NEXT_DAY/REGULER, Jabodetabek-heavy skew |
| I4 | Optimize request | REST `POST /optimize/jobs` | gateway writes DB plus `XADD orca:events:jobs` | on demand | stops, vehicle, tier, objective weights |
| I5 | Weather | Open-Meteo API | gateway scheduler poll into cache table | hourly per catchment city | temp_c, precip_mm, wind_kph, severity 0 to 4 |
| I6 | Traffic index | simulator (TomTom optional) | writes cache table | every 15 minutes per corridor | congestion_multiplier 1.00 to 3.00 |
| I7 | Fuel index | mock seed or reference | DB seed | daily | price_per_liter per fuel_type |
| I8 | Calendar | computed | DB seed | once per year | holidays, ramadan, lebaran window, harbolnas |

## Processing catalog

Fast tier (Go, per event, sub-second rules):

| Rule | Trigger | Output |
|---|---|---|
| R1 SLA watcher | remaining SLA below remaining planned ETA | `alert.raised` (sla_risk) |
| R2 Dwell breach | `hub_in` without `hub_out` past the node threshold | dwell alert plus hub metric update |
| R3 COD risk | cod_amount above threshold AND attempt_count >= 1 AND tier REGULER | cod_failure_risk flag |
| R4 Carbon per leg | leg completes (transit or delivered event) | `carbon.recorded` plus carbon_record insert |
| R5 Run accounting | load events on a run | update run load_factor |
| R6 Broadcast | after successful persistence | dashboard snapshot for SWR |

Deep tier (Python, batch `XREADGROUP COUNT 256`):

| Step | Detail |
|---|---|
| P1 Feature builder | 16-feature contract plus leg features (leg_no, load_factor, billed_weight, attempt_count, weather severity, traffic multiplier); FAS tier skipped (rule-based until retrain) |
| P2 Predict batch | one LightGBM `predict_proba` per batch, insert `waybill_prediction` |
| P3 Explain | SHAP top-k into `top_features` JSONB |
| P4 Carbon verify | recompute GLEC with actual per-leg load factor |
| P5 Hub aggregation | dwell p50 and p95, inbound and outbound per window into `hub_metric` |

Optimizer (Python, per job): consume `orca:events:jobs`, run NSGA-II with
population and generations sized for the demo laptop, publish
`optimize.result`, update `optimize_job`.

Agent (read-only): watches `alert.raised`, explains risk drivers, writes
`agent_note`, may attach a playbook suggestion to the alert. Never executes.

## Output event catalog (`orca:events:results`, 4 types)

`prediction.updated`

- schema_version INT, event_id VARCHAR(40), correlation_id VARCHAR(60),
  waybill_id VARCHAR(30), tier VARCHAR(10)
- delay_probability DECIMAL(5,4) in [0,1], sla_risk_score DECIMAL(5,2) in
  [0,100], risk_level in (low, medium, high)
- predicted_delay_hrs DECIMAL(6,2), model_version VARCHAR(50)
- top_features JSONB: array of {feature, value, contribution}
- at TIMESTAMPTZ

`alert.raised`

- same envelope fields, plus alert_type in (sla_risk, dwell_breach,
  cod_failure_risk, hub_congestion), risk_score DECIMAL(5,2), source in
  (fast_tier, deep_tier, agent), message TEXT, dedupe_key VARCHAR(80) unique

`carbon.recorded`

- same envelope fields, plus leg_no SMALLINT, vehicle_type VARCHAR(30),
  distance_km DECIMAL(8,2), load_ton DECIMAL(8,4), emission_factor
  DECIMAL(8,6), co2_kg DECIMAL(8,4)

`optimize.result`

- same envelope fields, plus job_id VARCHAR(40), status in (done, failed),
  pareto JSONB: array of {label, total_time_min, distance_km, cost_idr (integer),
  co2_kg, sla_risk}, best_for JSONB, optimization_ms INT

## Schema catalog (33 tables)

### Pool 1: Master (12 tables)

| Table | Key columns (types) |
|---|---|
| `node` | id VARCHAR(40) PK ('wh_cakung'), type CHECK(warehouse, hub), name VARCHAR(80), city VARCHAR(50), province VARCHAR(50), is_jabodetabek BOOL, lat DECIMAL(9,6), lng DECIMAL(9,6), area_sqm INT, capacity_shipments_day INT, active BOOL |
| `postal_catchment` | postal_code VARCHAR(5), node_id FK, tiers TEXT[], PK(postal_code, node_id) |
| `partner` | id VARCHAR(30) PK, name, kind CHECK(internal, 3pl), webhook_format VARCHAR(30), active BOOL |
| `vehicle` | id VARCHAR(40) PK, plate VARCHAR(15) UNIQUE, vehicle_type FK glec, capacity_kg DECIMAL(8,2), capacity_m3 DECIMAL(6,2), owned BOOL, partner_id FK NULL |
| `driver` | id VARCHAR(40) PK, name VARCHAR(80), partner_id FK NULL |
| `seller` | id UUID PK, name, city, postal_code VARCHAR(5), pickup_node_id FK |
| `sku` | id UUID PK, seller_id FK, name, category VARCHAR(40), actual_weight_kg DECIMAL(8,3), length_cm/width_cm/height_cm DECIMAL(6,2), volumetric_factor SMALLINT DEFAULT 6000, fragile BOOL, hazmat BOOL, unit_value DECIMAL(14,0) |
| `lane` | id UUID PK, from_node FK, to_node FK, mode CHECK(road, air, ferry), distance_km DECIMAL(8,2), base_transit_hours DECIMAL(5,2), base_tariff_per_kg DECIMAL(10,0), UNIQUE(from_node, to_node, mode) |
| `rate_card` | id UUID PK, partner_id FK, tier, base_fee DECIMAL(14,0), per_kg_fee DECIMAL(10,0), fuel_surcharge_pct DECIMAL(5,2), remote_surcharge DECIMAL(10,0), effective_from DATE |
| `sla_matrix` | tier CHECK(FAS, NEXT_DAY, REGULER), from_city, to_city, promise_hours SMALLINT, cutoff TIME, PK(tier, from_city, to_city) |
| `calendar_day` | day DATE PK, is_holiday BOOL, is_ramadan BOOL, is_lebaran_window BOOL, is_harbolnas BOOL |
| `glec_emission_factors` | exists; add rows `air_short` (approx 0.8 to 1.0) and `air_long` (approx 0.5 to 0.6), final values from GLEC v3.2 tables at implementation |

### Pool 2: Operational (12 tables)

| Table | Key columns (types) |
|---|---|
| `customer` | id UUID PK, name_masked VARCHAR(60), city, province, postal_code VARCHAR(5), lat DECIMAL(9,6), lng DECIMAL(9,6) |
| `order` | id UUID PK, customer FK, placed_at TIMESTAMPTZ, payment_method CHECK(prepaid, cod), cod_amount DECIMAL(14,0), promised_by TIMESTAMPTZ, status VARCHAR(20) |
| `order_item` | id UUID PK, order FK, sku FK, qty SMALLINT, unit_price DECIMAL(14,0), package_id FK NULL (allocation), UNIQUE(order, sku) |
| `package` | id UUID PK, order FK, source_node FK, actual_weight_kg DECIMAL(8,3), volumetric_weight_kg DECIMAL(8,3), billed_weight_kg DECIMAL(8,3), dims JSONB, created_at |
| `waybill` | id VARCHAR(30) PK (AWB number), package FK UNIQUE, tier CHECK(FAS, NEXT_DAY, REGULER), cod_amount DECIMAL(14,0), insurance_value DECIMAL(14,0), status CHECK(created, picked_up, in_transit, out_for_delivery, delivered, failed, rts), current_leg_no SMALLINT, leg_plan_version SMALLINT, sla_deadline TIMESTAMPTZ, created_at, delivered_at |
| `leg_plan` | id UUID PK, waybill FK, version SMALLINT, leg_no SMALLINT, leg_type CHECK(FIRST_MILE, LINEHAUL, LAST_MILE, RETURN), from_node FK, to_node FK, mode, planned_vehicle_type FK glec, planned_depart_at TIMESTAMPTZ, planned_arrive_at TIMESTAMPTZ, distance_km DECIMAL(8,2), UNIQUE(waybill, version, leg_no) |
| `vehicle_run` | id VARCHAR(40) PK, vehicle FK, driver FK, from_node FK, to_node FK, mode, depart_at TIMESTAMPTZ, arrive_at TIMESTAMPTZ, capacity_kg DECIMAL(10,2), load_kg DECIMAL(10,2), status CHECK(planned, loading, running, done) |
| `run_manifest` | run_id FK, waybill FK, leg_no SMALLINT, PK(run_id, waybill, leg_no) |
| `scan_event` | id UUID PK, event_id VARCHAR(40) UNIQUE (idempotency key), waybill FK, event_type CHECK(6 canonical), leg_no SMALLINT, from_node, to_node, vehicle_run_id NULL, vehicle_type NULL, load_factor DECIMAL(4,3) NULL, billed_weight_kg DECIMAL(8,3), cod_amount DECIMAL(14,0), attempt_count SMALLINT, payload JSONB, occurred_at TIMESTAMPTZ, received_at TIMESTAMPTZ, HYPERTABLE(occurred_at) |
| `delivery_attempt` | id UUID PK, waybill FK, attempt_no SMALLINT, attempted_at TIMESTAMPTZ, outcome CHECK(delivered, failed), reason_code VARCHAR(40), lat NULL, lng NULL, courier_ref VARCHAR(40) NULL |
| `shipment_exception` | id UUID PK, waybill FK, type CHECK(damage, lost, weather_hold, address_issue, capacity_hold), opened_at TIMESTAMPTZ, resolved_at NULL, note TEXT |
| Indexes | scan_event(waybill, occurred_at), waybill(status, sla_deadline) partial on active, leg_plan(waybill, version, leg_no) |

### Pool 4: Derived (6 tables)

| Table | Key columns (types) |
|---|---|
| `waybill_prediction` | time TIMESTAMPTZ, waybill FK, tier, delay_probability DECIMAL(5,4), sla_risk_score DECIMAL(5,2), risk_level CHECK(low, medium, high), predicted_delay_hrs DECIMAL(6,2), model_version VARCHAR(50), features_json JSONB, top_features JSONB, HYPERTABLE(time) |
| `carbon_record` | id UUID PK, waybill FK, leg_no SMALLINT, vehicle_type, distance_km DECIMAL(8,2), load_ton DECIMAL(8,4), load_factor DECIMAL(4,3), emission_factor DECIMAL(8,6), co2_kg DECIMAL(8,4), glec_version VARCHAR(10), calculated_at, UNIQUE(waybill, leg_no) |
| `alert` | id UUID PK, waybill FK NULL (hub alerts have no waybill), alert_type CHECK(sla_risk, dwell_breach, cod_failure_risk, hub_congestion), risk_score DECIMAL(5,2), source CHECK(fast_tier, deep_tier, agent), message TEXT, status CHECK(open, acknowledged, resolved), dedupe_key VARCHAR(80) UNIQUE, created_at |
| `hub_metric` | time TIMESTAMPTZ, node_id FK, inbound INT, outbound INT, avg_dwell_min DECIMAL(6,2), p95_dwell_min DECIMAL(6,2), congestion_index DECIMAL(4,2), active_waybills INT, HYPERTABLE(time) |
| `optimize_job` | id UUID PK, job_id VARCHAR(40) UNIQUE, status CHECK(queued, running, done, failed), request JSONB, result JSONB, submitted_at, started_at NULL, finished_at NULL, optimization_ms INT NULL |
| `agent_note` | id UUID PK, waybill FK NULL, scope CHECK(waybill, hub, network), risk_drivers JSONB, suggestion TEXT, model VARCHAR(60), created_at |

### Pool 5: Context (3 tables)

| Table | Key columns (types) |
|---|---|
| `weather_observation` | time TIMESTAMPTZ, node_id FK, temp_c DECIMAL(4,1), precip_mm DECIMAL(5,1), wind_kph DECIMAL(5,1), severity SMALLINT CHECK(0-4), source VARCHAR(20), HYPERTABLE(time) |
| `traffic_index` | time TIMESTAMPTZ, from_node FK, to_node FK, congestion_multiplier DECIMAL(4,2) CHECK(1.0-3.0), source CHECK(simulated, tomtom), HYPERTABLE(time) |
| `fuel_price_index` | day DATE PK, fuel_type VARCHAR(20), price_per_liter DECIMAL(8,0), source VARCHAR(30) |

## Design consequences worth remembering

- Carbon is now **per leg**, not per shipment: vehicle mode changes across
  legs, and GLEC factors differ per mode. The legacy per-shipment
  `carbon_records` cannot express this.
- `scan_event` is a hypertable with `event_id` UNIQUE: the database itself is
  the idempotency guard for at-least-once delivery.
- Context data never rides the shipment stream; it lives in pool 5 cache
  tables that the feature builder reads.
- The dashboard keeps reading pool 4 through the gateway; the stream is
  never queried by the frontend.

## Provenance and justification

Every naming, format, and structural choice traces to one of four buckets.

**A. External standards (binding):**

- Event envelope (event_id, type, schema_version, at, correlation_id):
  CloudEvents. Required attributes there are id, source, specversion, type,
  with optional time, and producers must guarantee id uniqueness. Our
  `event_id` UNIQUE is that guarantee; `schema_version` is the specversion
  analogue versioning our own data schema.
- `glec_emission_factors` structure (vehicle_type, fuel_type, kg CO2e per
  tonne-km) and per-leg accounting, plus air_short/air_long: GLEC Framework
  v3.x selects intensity per deck (belly, freighter) and haul (short, long).
  Compressing to short/long is a stated demo simplification, not a claim of
  full GLEC fidelity.
- Timestamps: RFC 3339 / ISO 8601 in UTC, TIMESTAMPTZ everywhere.
- Volumetric weight P x L x T / 6000 with billed = max(actual, volumetric):
  official J&T practice, common across JNE and SiCepat.
- `postal_code VARCHAR(5)` and province/city fields: Indonesian
  administrative structure, 5-digit national postal codes.

**B. Industry vocabulary (strong conventions, sourced in the references):**

- `waybill` / AWB: the parcel tracking document in carrier practice
  (JNE, J&T); also avoids colliding with the legacy `shipments` table during
  migration.
- `leg`, linehaul, first/middle/last mile: Amazon network topology and the
  carrier literature.
- `node` with warehouse/hub types: a generalization of Amazon's fulfillment
  center, sortation center, delivery station and SPX hub-and-spoke.
- The 6 canonical event types: a compression of carrier scan taxonomies
  (manifested, pickup, arrived at hub, departed hub, in transit, out for
  delivery, delivered, failed attempt).
- Waybill status lifecycle through `rts`, reason codes, load factor, rate
  card, fuel surcharge: standard TMS and carrier practice.
- Tier `FAS`: Blibli's official Fulfillment At Speed; NEXT_DAY and REGULER
  are generic carrier tiers.

**C. Repo conventions (binding internally):**

- UUID PKs with gen_random_uuid(), TIMESTAMPTZ, JSONB, VARCHAR with CHECK
  for small enums, hypertables, snake_case plural tables: all from
  `infra/init-db/01_schema.sql`.
- The `orca:` Redis namespace continues the existing
  `orca:cache:pred:{id}` and `orca:cache:hub_rates:{hub_id}` patterns.
- DECIMAL(8,6) emission factor, sla_risk_score 0 to 100, the 70 alert
  threshold: existing schema and env.
- The 16-feature contract: `apps/orca-ai/ml/features.py`, frozen.

**D. Design proposals (marked, replaceable):**

- The three-layer split and context staying out of the stream.
- `leg_plan` versioning for reroutes.
- Naming calls: `node` over `hub`, `at` over `time` in payloads, dot
  notation event types (`prediction.updated`, the event sourcing
  order.created pattern).
- Precision: lat/lng DECIMAL(9,6) (about 11 cm at the equator), probability
  DECIMAL(5,4), load_factor DECIMAL(4,3).
- IDR correction from this review: rupiah has no cents, so all IDR amounts
  are DECIMAL(14,0), per-kg tariffs DECIMAL(10,0), fuel prices DECIMAL(8,0),
  cost_idr integer. The earlier 2-decimal money format was habit, not
  justification.

## Open Questions

- Final values for the GLEC air factors (short and long haul) at
  implementation time, from the GLEC v3.2 reference tables.
- Retention policy for the hypertables across repeated demo replays (chunk
  interval versus drop-and-reseed).
- Whether partner webhooks get a separate ingest endpoint per partner or one
  endpoint with a partner discriminator.
