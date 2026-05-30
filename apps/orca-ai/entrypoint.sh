#!/bin/bash
set -e

# Wait for DB to be ready
echo "⏳ Waiting for database to be ready..."
until python -c "import asyncpg; import asyncio; import os; asyncio.run(asyncpg.connect(os.getenv('DATABASE_URL')))" > /dev/null 2>&1; do
  sleep 2
done

echo "Running initial seeding (idempotent)..."
# Use the pre-installed python environment directly to avoid permission issues with .venv creation
python scripts/ingest/seed_db.py

if [ $# -eq 0 ]; then
    echo "Starting ORCA AI Server..."
    exec uvicorn main:app --host 0.0.0.0 --port 8000
else
    echo "Running command: $@"
    exec "$@"
fi
