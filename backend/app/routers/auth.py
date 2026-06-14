"""
app/routers/auth.py — Authentication endpoints.

POST /auth/token    — exchange credentials for JWT (rate-limited 5/min/IP)
POST /auth/ws-ticket — exchange JWT for one-time WebSocket ticket

Security rules:
- Credentials accepted in JSON body only. NEVER in URL params or headers.
- Rate limiting: 5 attempts per IP per minute (in-memory counter).
- JWT is returned to client; client stores in React memory ONLY.
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
    create_ws_ticket,
    verify_password,
)
from app.models.schemas import TokenRequest, TokenResponse, WSTicketResponse

logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# In-memory rate limiter — max 5 /auth/token attempts per IP per minute.
# Keyed by IP address. No Redis required.
# ---------------------------------------------------------------------------
_rate_limit_store: defaultdict[str, list[float]] = defaultdict(list)
_RATE_LIMIT_MAX = 5
_RATE_LIMIT_WINDOW = 60.0  # seconds


def _check_rate_limit(ip: str) -> None:
    now = time.monotonic()
    window_start = now - _RATE_LIMIT_WINDOW

    # Evict timestamps outside the window
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
    Exchange credentials for a signed JWT (HS256, 1-hour expiry).

    Rate limited: 5 attempts per IP per 60 seconds.
    Credentials loaded from environment variables — never from a database.
    """
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    settings = get_settings()

    # Validate username
    if body.username != settings.allowed_username:
        logger.warning("auth.invalid_username", ip=client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate password (bcrypt hash comparison — never plaintext check)
    if not verify_password(body.password, settings.allowed_password):
        logger.warning("auth.invalid_password", ip=client_ip, username=body.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(subject=body.username)
    logger.info("auth.token_issued", username=body.username, ip=client_ip)
    return TokenResponse(access_token=token)


# ---------------------------------------------------------------------------
# POST /auth/ws-ticket
# ---------------------------------------------------------------------------

@router.post("/ws-ticket", response_model=WSTicketResponse)
async def get_ws_ticket(
    _username: str = Depends(require_jwt),
) -> WSTicketResponse:
    """
    Exchange a valid JWT for a one-time WebSocket ticket.

    The ticket is a UUID v4 with a 30-second TTL and a single-use flag.
    It is passed as a query parameter to /ws (the ONLY safe place — JWT
    is never put in a URL). The ticket is burned on first use.
    """
    ticket = create_ws_ticket()
    return WSTicketResponse(ticket=ticket)
