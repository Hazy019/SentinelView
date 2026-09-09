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

import secrets
import time
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.config import get_settings
from app.core.dependencies import require_jwt
from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_ws_ticket,
    decode_token_payload,
    get_password_hash,
    verify_password,
)
from app.db.database import create_user, get_user_by_username
from app.models.schemas import (
    RefreshTokenRequest,
    RegisterRequest,
    TokenRequest,
    TokenResponse,
    UserProfileResponse,
    WSTicketResponse,
)

logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# In-memory rate limiter — max 5 /auth/token or /auth/register attempts per IP per minute.
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
            detail="Too many attempts. Try again in 60 seconds.",
            headers={"Retry-After": "60"},
        )

    _rate_limit_store[ip].append(now)


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: Request, body: RegisterRequest) -> TokenResponse:
    """
    Register a new user account with personal tenant isolation and dedicated ingestion API key.
    Rate limited: 5 attempts per IP per 60 seconds.
    """
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    # Prevent collision with reserved 'demo' account
    if body.username.lower() == "demo":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username 'demo' is reserved for demonstration sandbox.",
        )

    existing = await get_user_by_username(body.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username is already registered. Please choose another username.",
        )

    settings = get_settings()
    tenant_id = (body.tenant_name.strip() if body.tenant_name else f"tenant_{body.username.lower()}")
    api_key = f"sv_live_{secrets.token_urlsafe(24)}"
    password_hash = get_password_hash(body.password)

    await create_user(
        username=body.username,
        password_hash=password_hash,
        tenant_id=tenant_id,
        api_key=api_key,
        role="analyst",
    )

    access_token = create_access_token(subject=body.username, tenant_id=tenant_id)
    refresh_token = create_refresh_token(subject=body.username, tenant_id=tenant_id)

    logger.info("auth.user_registered", username=body.username, tenant_id=tenant_id, ip=client_ip)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.jwt_expire_minutes * 60,
        tenant_id=tenant_id,
        api_key=api_key,
        is_demo=False,
    )


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

    # Look up user in database
    user = await get_user_by_username(body.username)
    if user:
        if not verify_password(body.password, user["password_hash"]):
            logger.warning("auth.invalid_password", ip=client_ip, username=body.username)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        tenant_id = user["tenant_id"]
        api_key = user["api_key"]
        is_demo = (user["username"] == "demo" or user["role"] == "demo")
    elif body.username == settings.allowed_username:
        # Fallback to runtime environment credentials
        if not verify_password(body.password, settings.allowed_password):
            logger.warning("auth.invalid_password", ip=client_ip, username=body.username)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        tenant_id = body.tenant_id or "default_tenant"
        api_key = "sv_demo_key_999a0b1c2d3e"
        is_demo = True
    else:
        logger.warning("auth.invalid_username", ip=client_ip, username=body.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=body.username, tenant_id=tenant_id)
    refresh_token = create_refresh_token(subject=body.username, tenant_id=tenant_id)

    logger.info("auth.tokens_issued", username=body.username, tenant_id=tenant_id, ip=client_ip)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.jwt_expire_minutes * 60,
        tenant_id=tenant_id,
        api_key=api_key,
        is_demo=is_demo,
    )


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserProfileResponse)
async def get_current_user(username: str = Depends(require_jwt)) -> UserProfileResponse:
    """
    Retrieve authenticated user profile, tenant ID, and personal ingestion API key.
    """
    user = await get_user_by_username(username)
    if user:
        return UserProfileResponse(
            username=user["username"],
            tenant_id=user["tenant_id"],
            api_key=user["api_key"],
            role=user["role"],
            is_demo=(user["username"] == "demo" or user["role"] == "demo"),
            created_at=user["created_at"],
        )

    settings = get_settings()
    if username == settings.allowed_username:
        return UserProfileResponse(
            username=username,
            tenant_id="default_tenant",
            api_key="sv_demo_key_999a0b1c2d3e",
            role="demo",
            is_demo=True,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="User not found",
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
