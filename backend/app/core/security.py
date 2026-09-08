"""
app/core/security.py — JWT creation/validation + refresh token rotation + WebSocket tickets.

Security rules:
- JWT signed with HS256.
- Multi-tenant claims (sub, tenant_id).
- Short-lived access tokens (60 min default) + 7-day refresh token rotation.
- WebSocket auth uses one-time ticket system with 30s TTL, burned on connect.
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings
from app.core.logging import get_logger, redact_ticket

logger = get_logger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------------------------------------------------------------------------
# WebSocket Ticket Store
# in-memory dict: ticket_uuid → {"expires_at": datetime, "used": bool, "tenant_id": str}
# ---------------------------------------------------------------------------
_ticket_store: dict[str, dict] = {}

# Cleanup tickets every N validations to prevent unbounded growth
_TICKET_CLEANUP_INTERVAL = 50
_ticket_validation_count = 0


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, tenant_id: str = "default_tenant") -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "sub": subject,
        "tenant_id": tenant_id,
        "type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    logger.info("token.created", subject=subject, tenant_id=tenant_id)
    return token


def create_refresh_token(subject: str, tenant_id: str = "default_tenant") -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    payload = {
        "sub": subject,
        "tenant_id": tenant_id,
        "type": "refresh",
        "jti": str(uuid.uuid4()),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    logger.info("refresh_token.created", subject=subject, tenant_id=tenant_id)
    return token


def decode_token_payload(token: str) -> Optional[dict[str, Any]]:
    """Decode and validate a JWT. Returns the payload dict or None."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None


def decode_access_token(token: str) -> Optional[str]:
    """
    Decode and validate an access JWT. Returns the subject (username) or None.
    NEVER log the token itself.
    """
    payload = decode_token_payload(token)
    if not payload:
        return None
    if payload.get("type") and payload.get("type") != "access":
        return None
    return payload.get("sub")


# ---------------------------------------------------------------------------
# WebSocket Ticket System
# ---------------------------------------------------------------------------

def create_ws_ticket(tenant_id: str = "default_tenant") -> str:
    """
    Generate a UUID v4 one-time ticket with a 30-second TTL.
    Stores ticket in memory with tenant binding. Returns the ticket string.
    """
    ticket = str(uuid.uuid4())
    _ticket_store[ticket] = {
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=30),
        "used": False,
        "tenant_id": tenant_id,
    }
    logger.info("ws_ticket.created", ticket_prefix=redact_ticket(ticket), tenant_id=tenant_id)
    _maybe_cleanup_tickets()
    return ticket


def validate_and_burn_ticket(ticket: str, expected_tenant: str | None = None) -> bool:
    """
    Validate a WebSocket ticket:
    - Must exist in the store
    - Must not be expired (30s TTL)
    - Must not already have been used (single-use)
    - Must match expected_tenant if specified

    On success, marks ticket as used (burned). Returns True if valid.
    """
    global _ticket_validation_count
    _ticket_validation_count += 1

    entry = _ticket_store.get(ticket)
    if entry is None:
        logger.warning("ws_ticket.not_found", ticket_prefix=redact_ticket(ticket))
        return False

    if entry["used"]:
        logger.warning("ws_ticket.already_used", ticket_prefix=redact_ticket(ticket))
        del _ticket_store[ticket]
        return False

    if datetime.now(timezone.utc) > entry["expires_at"]:
        logger.warning("ws_ticket.expired", ticket_prefix=redact_ticket(ticket))
        del _ticket_store[ticket]
        return False

    if expected_tenant and entry.get("tenant_id") != expected_tenant:
        logger.warning(
            "ws_ticket.tenant_mismatch",
            expected=expected_tenant,
            actual=entry.get("tenant_id"),
        )
        return False

    # Burn the ticket (single-use)
    entry["used"] = True
    logger.info("ws_ticket.validated", ticket_prefix=redact_ticket(ticket))
    return True


def _maybe_cleanup_tickets() -> None:
    """Prune expired tickets from the store to prevent unbounded growth."""
    if _ticket_validation_count % _TICKET_CLEANUP_INTERVAL != 0:
        return
    now = datetime.now(timezone.utc)
    stale = [k for k, v in _ticket_store.items() if v["expires_at"] < now or v["used"]]
    for k in stale:
        del _ticket_store[k]
    if stale:
        logger.debug("ws_ticket.cleanup", removed=len(stale))
