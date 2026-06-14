"""
app/core/security.py — JWT creation/validation + bcrypt password verification.

Security rules:
- JWT signed with HS256.
- Stored in React memory only on the frontend (never URL params / localStorage).
- WebSocket auth uses one-time ticket system, NOT JWT in URL.
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings
from app.core.logging import get_logger, redact_ticket

logger = get_logger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------------------------------------------------------------------------
# WebSocket Ticket Store
# in-memory dict: ticket_uuid → {"expires_at": datetime, "used": bool}
# ---------------------------------------------------------------------------
_ticket_store: dict[str, dict] = {}

# Cleanup tickets every N validations to prevent unbounded growth
_TICKET_CLEANUP_INTERVAL = 50
_ticket_validation_count = 0


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    logger.info("token.created", subject=subject)
    return token


def decode_access_token(token: str) -> Optional[str]:
    """
    Decode and validate a JWT. Returns the subject (username) or None.
    NEVER log the token itself.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        subject: str = payload.get("sub")
        if subject is None:
            return None
        return subject
    except JWTError:
        return None


# ---------------------------------------------------------------------------
# WebSocket Ticket System
# ---------------------------------------------------------------------------

def create_ws_ticket() -> str:
    """
    Generate a UUID v4 one-time ticket with a 30-second TTL.
    Stores ticket in memory. Returns the ticket string.
    """
    ticket = str(uuid.uuid4())
    _ticket_store[ticket] = {
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=30),
        "used": False,
    }
    logger.info("ws_ticket.created", ticket_prefix=redact_ticket(ticket))
    _maybe_cleanup_tickets()
    return ticket


def validate_and_burn_ticket(ticket: str) -> bool:
    """
    Validate a WebSocket ticket:
    - Must exist in the store
    - Must not be expired (30s TTL)
    - Must not already have been used (single-use)

    On success, marks ticket as used (burned). Returns True if valid.
    On failure, returns False. Expired/used tickets return False (→ 403).
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
