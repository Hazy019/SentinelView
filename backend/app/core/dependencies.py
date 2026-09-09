"""
app/core/dependencies.py — FastAPI dependency injection helpers.
"""

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import get_settings
from app.core.security import decode_access_token, decode_token_payload
from app.db.database import get_user_by_api_key

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
    1. A valid Bearer JWT (attaches tenant_id from claims).
    2. A static INGEST_API_KEY.
    3. A personal tenant API key from the database (attaches tenant_id).

    Allows external websites and automated log shippers (Fluent Bit, Vector, cURL)
    to push logs securely.
    """
    settings = get_settings()

    # 1. Check X-API-Key header
    if x_api_key:
        if settings.ingest_api_key and x_api_key == settings.ingest_api_key:
            request.state.tenant_id = "default_tenant"
            return "api_key_service"

        user = await get_user_by_api_key(x_api_key)
        if user:
            request.state.tenant_id = user["tenant_id"]
            return user["username"]

    # 2. Check Bearer credential (can be JWT or API Key)
    if credentials and credentials.credentials:
        token = credentials.credentials
        if settings.ingest_api_key and token == settings.ingest_api_key:
            request.state.tenant_id = "default_tenant"
            return "api_key_service"

        user = await get_user_by_api_key(token)
        if user:
            request.state.tenant_id = user["tenant_id"]
            return user["username"]

        payload = decode_token_payload(token)
        if payload and payload.get("type") == "access":
            subject = payload.get("sub")
            if subject:
                request.state.tenant_id = payload.get("tenant_id", "default_tenant")
                return subject

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing authentication (requires valid JWT or X-API-Key)",
        headers={"WWW-Authenticate": "Bearer"},
    )

