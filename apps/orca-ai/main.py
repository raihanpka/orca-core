import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis import asyncio as aioredis

from api.routers import alerts, carbon, hubs, internal, optimize, shipments
from api.schemas.common import Envelope
from core.config import get_settings
from core.mlflow_client import load_production_model
from core.security import validate_public_token
from db.connection import create_pool

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("orca-ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    model, encoder, version = load_production_model()
    app.state.delay_model = model
    app.state.label_encoder = encoder
    app.state.model_version = version
    app.state.db_pool = await create_pool(settings.database_url)
    try:
        app.state.redis = aioredis.from_url(settings.redis_url, decode_responses=True)
        await app.state.redis.ping()
        logger.info("Redis connected")
    except Exception as exc:
        app.state.redis = None
        logger.warning("Redis unavailable; cache disabled: %s", exc)
    yield
    if app.state.db_pool is not None:
        await app.state.db_pool.close()
    if app.state.redis is not None:
        await app.state.redis.aclose()


app = FastAPI(title="ORCA AI API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_rate_limit_buckets: dict[str, list[float]] = {}
_public_paths_without_token = {"/", "/health", "/docs", "/redoc", "/openapi.json"}
_internal_paths = {"/alerts/dispatch"}


@app.middleware("http")
async def public_api_guard(request: Request, call_next):
    settings = get_settings()
    path = request.url.path
    if request.method == "OPTIONS":
        return await call_next(request)
    if path not in _public_paths_without_token and not path.startswith("/internal") and path not in _internal_paths:
        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        window_start = now - 60
        hits = [hit for hit in _rate_limit_buckets.get(client_ip, []) if hit >= window_start]
        if len(hits) >= settings.public_rate_limit_per_minute:
            envelope = Envelope(success=False, data=None, error="rate limit exceeded")
            return JSONResponse(status_code=429, content=envelope.model_dump(mode="json"))
        hits.append(now)
        _rate_limit_buckets[client_ip] = hits
        try:
            validate_public_token(request.headers.get("X-API-Token"))
        except Exception as exc:
            status_code = getattr(exc, "status_code", 401)
            detail = getattr(exc, "detail", "unauthorized")
            envelope = Envelope(success=False, data=None, error=str(detail))
            return JSONResponse(status_code=status_code, content=envelope.model_dump(mode="json"))
    return await call_next(request)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    logger.exception("Unhandled request error")
    envelope = Envelope(success=False, data=None, error=str(exc))
    return JSONResponse(status_code=500, content=envelope.model_dump(mode="json"))


@app.get("/")
async def health():
    return {"status": "Orca API is running", "service": "orca-ai"}


@app.get("/health")
async def health_detail():
    return {
        "status": "Orca API and AI Engine are running",
        "service": "orca-ai",
        "model_version": app.state.model_version,
        "database": "connected" if app.state.db_pool is not None else "unavailable",
        "redis": "connected" if app.state.redis is not None else "unavailable",
    }


app.include_router(shipments.router)
app.include_router(optimize.router)
app.include_router(carbon.router)
app.include_router(hubs.router)
app.include_router(alerts.router)
app.include_router(internal.router)
