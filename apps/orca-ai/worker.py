import asyncio
from typing import Any
from arq import Worker
from arq.connections import RedisSettings

# A sample background task
async def process_shipment_delay(ctx: dict[str, Any], shipment_id: str) -> None:
    print(f"Background task starting: calculating AI delay for shipment {shipment_id}")
    await asyncio.sleep(2) # Simulate ML inference time
    print(f"Background task finished: shipment {shipment_id}")

async def startup(ctx: dict[str, Any]) -> None:
    print("ARQ Worker starting up...")
    # Initialize DB connections or ML models here

async def shutdown(ctx: dict[str, Any]) -> None:
    print("ARQ Worker shutting down...")
    # Clean up connections here

class WorkerSettings:
    # Use standard redis URL, typically mapped in docker-compose
    # Ensure this matches your redis service name/port
    redis_settings = RedisSettings(host='redis', port=6380)
    functions = [process_shipment_delay]
    on_startup = startup
    on_shutdown = shutdown

if __name__ == "__main__":
    # Usually you run this via the CLI: `arq worker.WorkerSettings`
    import sys
    print("Please run this worker using: arq worker.WorkerSettings")
    sys.exit(1)
