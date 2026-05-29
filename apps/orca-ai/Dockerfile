FROM python:3.11-slim AS builder

WORKDIR /app
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl && rm -rf /var/lib/apt/lists/*
RUN python -m venv "$VIRTUAL_ENV"
RUN pip install --no-cache-dir uv

COPY . .
RUN --mount=type=cache,target=/root/.cache/uv uv pip install --python "$VIRTUAL_ENV/bin/python" .

FROM python:3.11-slim AS runtime

WORKDIR /app
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /app /app

RUN adduser --system --uid 1001 orca
USER orca

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
