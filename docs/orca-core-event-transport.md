# ORCA Core Event Transport

Decision record that amends `orca-core-restructure.md`: the gRPC contract and
proto directory are dropped. All inter-service communication rides Redis
Streams. Date: 2026-09-02.

## Problem Statement

How might we connect the Go gateway and the Python AI layer with no gRPC at
all, using one event-driven transport that keeps both services independently
deployable, keeps the dashboard contract stable, and keeps the demo
deterministic and resilient?

## Recommended Direction

All communication goes through **Redis Streams**, the only coupling between
the two services in the `orca-core` monorepo: `services/gateway` (Go) and
`services/ai` (Python), each its own container, restartable and deployable
independently. No gRPC, no proto, no direct service-to-service HTTP.

Streams and event contract:

- `orca:events:shipments`: the 6 canonical shipment events, published by the
  gateway (REST ingest, scenario engine, future partner adapters), consumed
  by the AI layer via consumer group `ai`.
- `orca:events:results`: derived events (`prediction.updated`, `alert.raised`,
  `optimize.result`), published by the AI layer, consumed by the gateway via
  consumer group `gateway`, which persists and broadcasts to the dashboard.
- `orca:events:jobs`: optimizer jobs (async pattern below).
- Every event carries `schema_version`, `event_id` (idempotency key), and
  `correlation_id`. Delivery is at-least-once, so consumers must be idempotent.
- Streams are trimmed with MAXLEN.

The optimizer becomes an **async job**: `POST /optimize/jobs` returns a
`job_id`, the gateway publishes `optimize.request`, the AI layer runs NSGA-II
and publishes `optimize.result`, the dispatcher polls
`GET /optimize/jobs/{id}`. The frontend only changes on the optimizer screen
(poll job status, SWR is already in place).

Because the broker is just a URL in config, moving to a managed Redis later
touches no code.

## Key Assumptions to Validate

- [ ] Idempotency: replaying a stream twice does not duplicate prediction
      rows. Test: dedupe on `event_id`, replay twice, count rows.
- [ ] Optimizer job latency on the demo laptop is acceptable with reduced
      population/generations. Test: measure end to end.
- [ ] Memory stays stable in a long demo. Test: MAXLEN trim plus a 30 minute
      replay run.
- [ ] The optimizer contract migrates on both sides in the same PR; there is
      no mixed-state period.

## MVP Scope

Two main streams plus one jobs stream, consumer groups per service,
`event_id` dedupe, the optimizer job pattern, and removal of all gRPC/proto
plans. Frontend: only the optimizer screen learns to wait for a job.

## Not Doing (and Why)

- **Broker-agnostic abstraction** (an interface that could swap Kafka or
  RabbitMQ): YAGNI, switching brokers means swapping the client and URL.
- **Outbox/saga patterns**: one writer per service is enough for the demo.
- **SSE**: SWR polling is enough; do not change two things at once.
- **Kafka, RabbitMQ**: no requirement that Redis Streams does not already
  cover.

## Open Questions

- Final stream and consumer group names (`orca:events:shipments` with groups
  `ai` / `gateway`?)
- Stream retention window (trim policy) for demo replay.
