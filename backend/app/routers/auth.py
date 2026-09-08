"""
app/routers/auth.py — Multi-Tenant Authentication & Session Management.

Endpoints:
- POST /auth/token     — exchange credentials for JWT + refresh token (rate-limited 5/min/IP)
- POST /auth/refresh   — exchange rotating refresh token for fresh access token
- POST /auth/ws-ticket — exchange JWT for one-time WebSocket ticket (tenant-bound)

Security rules:
- Credentials accepted in JSON body only. NEVER in URL params or headers.
- Rate limiting: 5 attempts per IP per minute (in-memory counter).
- Access tokens contain sub, tenant_id claims (60 min expiry).
- Refresh tokens support session rotation (7-day expiry).
- Ticket is UUID v4, 30s TTL, single-use (burned on WS connect).
- NEVER log full tokens, passwords, or ticket values.
"""

import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.config import get_settings
from app.core.dependencies import require_jwt
from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_ws_ticket,
    decode_token_payload,
    verify_password,
)
from app.models.schemas import (
    RefreshTokenRequest,
    TokenRequest,
    TokenResponse,
    WSTicketResponse,
)

logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# In-memory rate limiter — max 5 /auth/token attempts per IP per minute.
# ---------------------------------------------------------------------------
_rate_limit_store: defaultdict[str, list[float]] = defaultdict(list)
_RATE_LIMIT_MAX = 5
_RATE_LIMIT_WINDOW = 60.0  # seconds


def _check_rate_limit(ip: str) -> None:
    now = time.monotonic()
    window_start = now - _RATE_LIMIT_WINDOW

    attempts = [t for t in _rate_limit_store[ip] if t > window_start]
    _rate_limit_store[ip] = attempts

    if len(attempts) >= _RATE_LIMIT_MAX:
        logger.warning("auth.rate_limited", ip=ip, attempts=len(attempts))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again in 60 seconds.",
            headers={"Retry-After": "60"},
        )

    _rate_limit_store[ip].append(now)


# ---------------------------------------------------------------------------
# POST /auth/token
# ---------------------------------------------------------------------------

@router.post("/token", response_model=TokenResponse)
async def login(request: Request, body: TokenRequest) -> TokenResponse:
    """
    Exchange credentials for signed JWT access token and rotating refresh token.
    Rate limited: 5 attempts per IP per 60 seconds.
    """
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    settings = get_settings()

    # Validate username
    if body.username != settings.allowed_username:
        logger.warning("auth.invalid_username", ip=client_ip, tenant_id=body.tenant_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate password (bcrypt hash comparison)
    if not verify_password(body.password, settings.allowed_password):
        logger.warning("auth.invalid_password", ip=client_ip, username=body.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=body.username, tenant_id=body.tenant_id)
    refresh_token = create_refresh_token(subject=body.username, tenant_id=body.tenant_id)

    logger.info("auth.tokens_issued", username=body.username, tenant_id=body.tenant_id, ip=client_ip)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.jwt_expire_minutes * 60,
        tenant_id=body.tenant_id,
    )


# ---------------------------------------------------------------------------
# POST /auth/refresh
# ---------------------------------------------------------------------------

@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(body: RefreshTokenRequest) -> TokenResponse:
    """
    Exchange a valid 7-day refresh token for a fresh access token and new refresh token.
    Enforces token type validation and multi-tenant claim continuity.
    """
    payload = decode_token_payload(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    subject = payload.get("sub")
    tenant_id = payload.get("tenant_id", "default_tenant")

    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token claims",
        )

    settings = get_settings()
    new_access = create_access_token(subject=subject, tenant_id=tenant_id)
    new_refresh = create_refresh_token(subject=subject, tenant_id=tenant_id)

    logger.info("auth.token_refreshed", username=subject, tenant_id=tenant_id)
    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        expires_in=settings.jwt_expire_minutes * 60,
        tenant_id=tenant_id,
    )


# ---------------------------------------------------------------------------
# POST /auth/ws-ticket
# ---------------------------------------------------------------------------

@router.post("/ws-ticket", response_model=WSTicketResponse)
async def get_ws_ticket(
    tenant_id: str = "default_tenant",
    _username: str = Depends(require_jwt),
) -> WSTicketResponse:
    """
    Exchange a valid JWT for a one-time WebSocket ticket bound to tenant_id.
    Single-use, 30s TTL.
    """
    ticket = create_ws_ticket(tenant_id=tenant_id)
    return WSTicketResponse(ticket=ticket, tenant_id=tenant_id)
