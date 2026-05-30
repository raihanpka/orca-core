from fastapi import Header, HTTPException, status

from core.config import get_settings


async def require_internal_token(x_internal_token: str | None = Header(default=None)) -> None:
    expected = get_settings().internal_api_token
    if not expected or x_internal_token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid internal token",
        )


def validate_public_token(token: str | None, authorization: str | None = None) -> None:
    """Accept token from X-API-Token header or Authorization: Bearer <token>."""
    expected = get_settings().public_api_token
    if not expected:
        return  # token auth disabled
    # Extract bearer token from Authorization header as fallback
    bearer = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization[7:].strip()
    if token != expected and bearer != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid api token",
        )
