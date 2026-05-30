FROM python:3.11-slim AS builder

WORKDIR /app
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl && rm -rf /var/lib/apt/lists/*
RUN python -m venv "$VIRTUAL_ENV"
RUN pip install --no-cache-dir uv

COPY apps/orca-ai/pyproject.toml apps/orca-ai/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv pip install --python "$VIRTUAL_ENV/bin/python" .

FROM python:3.11-slim AS runtime

WORKDIR /app
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
# Copy the app source and the scripts needed for seeding
COPY apps/orca-ai /app
COPY scripts /app/scripts

RUN adduser --system --uid 1001 orca
USER orca

# Make entrypoint executable
USER root
RUN chmod +x /app/entrypoint.sh
USER orca

EXPOSE 8010
ENTRYPOINT ["./entrypoint.sh"]
