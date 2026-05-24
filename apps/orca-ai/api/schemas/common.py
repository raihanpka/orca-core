from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


class Envelope(BaseModel):
    success: bool = True
    data: Any = None
    error: str | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def ok(data: Any) -> Envelope:
    return Envelope(data=data)
