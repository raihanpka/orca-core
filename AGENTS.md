# AGENTS.md

Agent instructions for `orca-core`, the decision-intelligence core of ORCA
(delay prediction, multi-objective routing, carbon analytics, SLA risk). This
file overrides the workspace root `AGENTS.md` and any other guide for anything
inside this tree. The legacy deep-dive guide still lives in
[`docs/Orca_AGENTS.md`](docs/Orca_AGENTS.md) and describes the current
implementation in detail.

## Goal and direction

Today the core is a Python modular monolith: `apps/orca-ai` (FastAPI, LightGBM,
pymoo NSGA-II, GLEC carbon calc, Redis subscriber, ARQ worker) over TimescaleDB
and Redis, with the dashboard in the sibling repo `orca-frontend`. The target
design (see the workspace `../docs/ideas/orca-core-restructure.md` and
`../docs/ideas/orca-core-event-transport.md`) keeps one repo but moves to two
services in a modular monolith: a Go gateway owning the REST API, auth, event
ingest, and the deterministic scenario engine, and a Python AI layer owning
inference and optimization, coupled only by Redis Streams event contracts
(no gRPC, no proto, no direct service-to-service HTTP).

The public REST contract in `docs/ORCA_PRD.md` section 16 is frozen because
`orca-frontend` depends on it. Any service rework must reproduce the exact HTTP
shape (paths, status codes, auth headers) rather than the current
implementation. Until the Go gateway exists, all changes land in
`apps/orca-ai` without breaking that contract. The one deliberate exception:
the optimizer flow moves from sync `POST /optimize/route` to the async job
pattern (`POST /optimize/jobs` + `GET /optimize/jobs/{id}`), migrated on both
sides in the same PR.

## Hard Rules

Non-negotiable, apply to every edit. Inherited from the workspace root
`AGENTS.md`, plus core-specific points.

- Write comments, commit messages, and explanations in English.
- Never use em dashes. Use commas, periods, or parentheses.
- Never use emojis.
- Add exactly one one-line intent comment per function or method, terse style,
  e.g. `# Computes the calibrated delay probability for one shipment.`
- Single-line commits only: `type(scope): summary`, no bullets or bodies.
- Do not add a new dependency without asking first. Python uses `uv`, never pip.
- Fix every linter or type issue you introduce before finishing.
- Commit here; pushing is done manually by the human.
- Never commit datasets, model binaries outside the `.gitignore` whitelist,
  or secrets.

## Architecture

- `apps/orca-ai/`: FastAPI app. Routers stay thin, business logic lives in
  engine services, ML in `ml/`. The 16-feature contract in `ml/features.py` is
  frozen; never build the feature vector by hand, always use
  `build_feature_vector()`.
- `apps/orca-showcase/`: Remotion showcase video, competition material, not
  part of the runtime stack.
- `scripts/ingest/`: dataset build, DB seed, and event replay (simulation).
- `infra/init-db/01_schema.sql`: the schema owner. Every table change starts
  here.
- Target layout `services/gateway/` (Go) and `services/ai/` (Python) with the
  Redis Streams event schema as the only cross-service contract: 6 canonical
  plus 3 result events, each carrying `schema_version`, `event_id`, and
  `correlation_id`. Once the split starts, do not add a second integration
  path (no direct DB writes from new consumers outside the event flow).

## Prediction and alerts

Model loading priority: explicit `MODEL_PATH`, then MLflow registry, then
local artifact, then deterministic heuristic fallback. The service must never
fail startup or a prediction because a model artifact is missing. Alert
dispatch is idempotent per dedupe window and persists even without provider
credentials.

## Config

Environment only (12-factor). One root `.env` (see `.env.example`), defaults
match `docker-compose.yml`. Public routes require `X-API-Token`, internal
routes require `X-Internal-Token`. No secrets in logs or code.

## Database

TimescaleDB (PostgreSQL 15) via Docker Compose. `infra/init-db/01_schema.sql`
auto-mounts on first container start. Seed with `make seed-db`, replay events
with `stream_data.py`. Parameterized queries only. Emission factors live in
`glec_emission_factors` (GLEC v3.0); add `air_short`/`air_long` classes when
air legs arrive, never hardcode factors.

## Testing

- `make test` runs pytest with the dev extras.
- The endpoints in `docs/ORCA_PRD.md` section 16 are the acceptance shape; a
  broken contract is a failing build.
- Focused run: `cd apps/orca-ai && uv run pytest tests -k <name>`.

## Commands

```bash
make install   # uv sync in apps/orca-ai
make build     # docker compose build
make up        # full stack (postgres, redis, mlflow, orca-ai, orca-worker)
make down      # stop the stack
make restart   # down + up
make ps        # compose status
make logs      # follow orca-ai logs
make dev-ai    # uvicorn on :8001 with reload
make test      # pytest
make seed-db   # seed PostgreSQL from processed features
make clean     # remove caches

# simulation replay
cd apps/orca-ai && uv run python ../../scripts/ingest/stream_data.py
```

## Commit convention

`type(scope): summary` in one line, logical units. Prefix types: `feat`, `fix`,
`refactor`, `chore`, `docs`, `test`. Example: `feat(ai): add congestion
multiplier to route scoring`.

## Documentation

- `README.md`: setup and commands.
- `docs/ORCA_PRD.md`: product scope, contracts, acceptance criteria.
- `docs/Orca_AGENTS.md`: legacy deep-dive guide for the current monolith.
- `docs/Orca_Integration Guide.md`: ML and API integration reference.
- `../docs/ideas/orca-core-restructure.md`: the two-service target design,
  event spine, and partner data checklist.
- `../docs/ideas/orca-core-event-transport.md`: the Redis Streams transport
  decision that replaces gRPC, including the optimizer job pattern.
