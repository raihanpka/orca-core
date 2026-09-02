# ORCA Parcel Data Model & Stream Handling

Decision record that extends `orca-core-restructure.md` (partner checklist)
and `orca-core-event-transport.md` (stream transport) with the physical
logistics data model, its real-world cardinality, and the high-volume stream
strategy. Date: 2026-09-02.

## Problem Statement

How might we model the physical delivery chain (item, package, waybill, leg
chain, vehicles, nodes) richly enough to be faithful to real e-commerce
logistics (Blibli, Tokopedia, Shopee, Amazon), handle roughly 400 thousand
events per demo run through the AI layer in real time, and still keep one
canonical event contract and a schema small enough to build before the
competition?

## Recommended Direction

**The waybill is the tracked unit, the leg chain is its structure, and the
richness lives in three layers, not in 30 normalized tables.**

### Layer 1: Master and reference data (small, slow-changing)

- `node` (32 rows): 13 warehouses (5 Jabodetabek, 5 Java, 3 non-Java) plus
  19 hubs, with type, city, coordinates, capacity, area_sqm. Mirrors the
  official Blibli network.
- `node_catchment`: postal code to node mapping (which hub serves which
  area, the basis of coverage and FAS radius).
- `vehicle`, `driver`: type (motor, van, pickup, truck, air), GVW, capacity
  kg and m3, GLEC emission class.
- `lane`: from_node, to_node, mode, distance_km, base_tariff,
  transit_hours. Air lanes Java to non-Java included, with GLEC air factors
  in `glec_emission_factors`.
- `rate_card` per partner: base, per kg, zone multiplier, fuel and remote
  surcharges (feeds the cost atlas).
- `sla_matrix`: service tier by origin and destination to promise hours
  (FAS 2h, NEXT_DAY, REGULER).
- `sku` master: actual weight, dimensions, volumetric factor, fragile,
  hazmat, value.
- `calendar`: holidays, Lebaran window, Harbolnas (existing feature set).

### Layer 2: Operational lifecycle (the stream's source of truth)

- `order` → `order_item` → `sku`: 1 to N per order, split across sellers and
  warehouses.
- `order` → `package`: 1 to N (split by warehouse, seller, or size). Each
  package carries measured weight, volumetric weight, and billed weight
  (max of the two, DIM factor around 6000 as common Indonesian practice).
- `package` → `waybill` (AWB): 1 to 1 in the demo, consolidation deferred.
  Waybill adds service tier, COD amount, insurance value, status.
- `waybill` → `leg_plan` (versioned): the ordered leg chain materialized at
  `shipment_created`, deterministic. Reroute scenarios create a new plan
  version.
- `leg` N to 1 `vehicle_run` 1 to 1 `vehicle` + `driver`, with
  `run_manifest` linking many waybills to one run (load factor = capacity
  used, feeds cost-to-serve and GLEC carbon).
- `waybill` → `scan_event` (the raw stream), `delivery_attempt` (outcome
  plus reason code), `exception` (damage, lost, weather hold).
- Reverse flow: after N failed attempts, RTS is an event, not a full return
  chain.

### Layer 3: What ORCA deliberately does NOT own

Pick waves, pack tasks, packing slips, invoice lines, COD remittance
ledger, WMS bin positions. ORCA is a decision-intelligence layer, not a TMS
(PRD section 1). These are never emitted in the demo, and that is honest:
ORCA consumes the trail, source systems own the process.

**The rule that keeps the schema small: a detail either becomes a table in
layers 1 or 2, a field on the canonical event payload, or a model feature.
Anything else stays out of scope.**

### Event payload carries the dozen details

The 6 canonical event types do not grow. Each event is enriched:

```json
{
  "schema_version": 1,
  "event_id": "evt_01J9XK...",
  "correlation_id": "ord_BL123:pkgA",
  "type": "hub_out",
  "waybill_id": "AWB-8812",
  "leg_no": 2,
  "leg_type": "LINEHAUL",
  "from_node": "hub_cakung",
  "to_node": "hub_bekasi",
  "vehicle_run_id": "run_88",
  "vehicle_type": "truck_lt35t",
  "load_factor": 0.72,
  "billed_weight_kg": 4.1,
  "cod_amount": 0,
  "attempt_count": 0,
  "at": "2026-09-02T14:22:31Z",
  "planned_arrive": "2026-09-02T15:40:00Z",
  "sla_deadline": "2026-09-03T20:00:00Z"
}
```

Details that intelligence actually consumes become features: billed weight,
load factor, leg number, dwell so far, attempt count, COD amount, hour of
day, weather and congestion multipliers, lane history.

### Stream handling: tolerate lag, batch everything

- Producer (scenario engine): batch `XADD`, MAXLEN trim, 3 service tiers,
  Jabodetabek-heavy geographic skew, daily wave pattern (morning pickup,
  midday sortation, night linehaul, next-morning last mile).
- AI layer: `XREADGROUP COUNT 256`, build the feature matrix vectorized, one
  batch `predict_proba`, batch `COPY` into TimescaleDB, then `XACK`.
- The production-consumption gap is a buffer in the stream, not an alarm.
  The Go fast tier keeps the dashboard alive while the deep tier catches up.
  Lag is monitored via `XINFO GROUPS`, idempotency via `event_id`, stalled
  consumers recovered via `XAUTOCLAIM`.
- Volume math: 50k shipments x 8 events = 400k events; at 1k events/s the
  replay finishes in about 7 minutes. One stream, no sharding.

### Blibli calibration (master data, not decoration)

- 32 nodes modeled exactly: 13 warehouses (5 Jabodetabek, 5 Java,
  3 non-Java) plus 19 hubs.
- Marunda is 100 thousand sqm of the roughly 200 thousand sqm total, half
  the capacity sits in Jabodetabek, hence the order skew.
- FAS 2 hours for 350 thousand SKUs in 40+ cities implies a 10 to 15 km
  rider radius around each warehouse, that is the catchment bound in the
  generator. FAS is a first-class demo scenario (single leg, sharpest SLA).
- 3 non-Java warehouses justify air lanes in the atlas with GLEC air
  factors (higher per tonne-km, a strong ESG story).
- The three non-Java warehouse cities are stated mock assumptions, marked
  as mock in the UI method note.

## Key Assumptions to Validate

- [ ] Leg plan materialized at creation covers every demo scenario; reroute
      only needs a new plan version. Test: road incident mid-linehaul.
- [ ] FAS gets a sensible risk score from the rule-based tier before the
      model is retrained with service-tier features. Test: FAS waybill
      appears in the risk queue.
- [ ] The batch pipeline sustains 5k events/s on the demo laptop. Test:
      replay 400k events, measure peak lag and p99 persistence.
- [ ] Event payload stays under ~1 KB so a 400k-event replay stays trivial
      for Redis memory with MAXLEN.

## MVP Scope

In: layer 1 and 2 tables in the schema; enriched event payloads; wave
generator (50k shipments, 3 tiers, Jabodetabek skew); FAS scenario; air
lanes in the cost atlas with GLEC air factors; batched AI consumer with
idempotency.

## Not Doing (and Why)

- **Item-level tracking**: no production parcel network tracks individual
  items through vehicles; volume doubles with no new story.
- **Stream sharding per region**: one stream covers 400k events.
- **Consolidation of multiple packages into one waybill**: deferred,
  1-to-1 covers the demo.
- **Driver shift rostering and WMS internals**: out of ORCA's ownership.
- **Linehaul multi-stop optimization**: NSGA-II stays on last mile and lane
  choice.

## Open Questions

- Cities for the 3 non-Java warehouses in the mock (Medan, Makassar,
  Denpasar as stated assumptions?).
- Does an incident reroute replace the whole remaining chain or only the
  active leg?
- TimescaleDB hypertable retention for repeated replays (chunk interval vs
  drop-and-reseed).

## References

- Blibli press release, Gudang Marunda and the 13 warehouses plus 19 hubs
  network: https://about.blibli.com/id/media/press-release/gudang-marunda-perkuat-smart-logistics-dan-supply-chain-management-blibli-lewat-teknologi-terintegrasi
- Blibli supply chain coverage (VOI):
  https://voi.id/en/economy/541973
- Shopee SPX hub-and-spoke flow (Senarai):
  https://senarai.co/alur-pengiriman-shopee-express/
- Tokopedia seller pickup flow:
  https://seller-id.tokopedia.com/university/essay?knowledge_id=3125888909788930&lang=en
- Amazon fulfillment network topology (INFORMS):
  https://pubsonline.informs.org/do/10.1287/orms.2022.05.24n/full/
- First, middle and last mile on a unified ledger (FarEye):
  https://fareye.com/resources/blogs/first-middle-last-mile-delivery-logistics
