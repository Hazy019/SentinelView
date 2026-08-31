"""
app/core/dependencies.py — FastAPI dependency injection helpers.
"""

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import get_settings
from app.core.security import decode_access_token

_bearer = HTTPBearer(auto_error=False)


async def require_jwt(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """
    Validate Bearer JWT on any protected endpoint.
    Returns the username (subject) on success; raises 401 on failure.
    NEVER logs the token.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    subject = decode_access_token(credentials.credentials)
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return subject


async def require_jwt_or_api_key(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    x_api_key: str | None = Header(None, alias="X-API-Key"),
) -> str:
    """
    Validate either:
    1. A valid Bearer JWT.
    2. A static INGEST_API_KEY passed via X-API-Key header or Bearer header.

    Allows automated log shippers (Fluent Bit, Vector, syslog, cURL)
    to push logs securely without needing interactive JWT user login.
    """
    settings = get_settings()

    # Check X-API-Key header first
    if settings.ingest_api_key and x_api_key:
        if x_api_key == settings.ingest_api_key:
            return "api_key_service"

    # Check Bearer credential (can be JWT or API Key)
    if credentials and credentials.credentials:
        token = credentials.credentials
        if settings.ingest_api_key and token == settings.ingest_api_key:
            return "api_key_service"

        subject = decode_access_token(token)
        if subject is not None:
            return subject

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing authentication (requires valid JWT or X-API-Key)",
        headers={"WWW-Authenticate": "Bearer"},
    )
