"""
app/models/schemas.py — Pydantic models for all shared data contracts.

These are the canonical definitions of the Log Event Schema and Alert
Payload Schema. All code MUST import from here — never redefine inline.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class Action(str, Enum):
    LOGIN = "LOGIN"
    REQUEST = "REQUEST"
    TRANSFER = "TRANSFER"


class ThreatType(str, Enum):
    BRUTE_FORCE = "BRUTE_FORCE"
    PORT_SCAN = "PORT_SCAN"
    DATA_EXFIL = "DATA_EXFIL"


class Confidence(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


# ---------------------------------------------------------------------------
# Rules Engine Thresholds — hardcoded constants, NO magic numbers elsewhere
# ---------------------------------------------------------------------------

class Thresholds:
    # BRUTE_FORCE: failed LOGIN events from one source_ip within a window
    BRUTE_FORCE_WINDOW_SECONDS: int = 10
    BRUTE_FORCE_HIGH_COUNT: int = 5       # > 5 → HIGH
    BRUTE_FORCE_MEDIUM_COUNT: int = 3     # 3–5 → MEDIUM

    # PORT_SCAN: distinct dest_ips from one source_ip within a window
    PORT_SCAN_WINDOW_SECONDS: int = 5
    PORT_SCAN_HIGH_DEST_COUNT: int = 10   # > 10 distinct → HIGH

    # DATA_EXFIL: bytes_sent in a single TRANSFER
    DATA_EXFIL_HIGH_BYTES: int = 10_000_000   # > 10MB → HIGH
    DATA_EXFIL_MEDIUM_BYTES: int = 1_000_000  # > 1MB → MEDIUM


# ---------------------------------------------------------------------------
# Log Event Schema (Generator → Backend)
# ---------------------------------------------------------------------------

class LogEvent(BaseModel):
    timestamp: datetime
    source_ip: str = Field(..., pattern=r"^\d{1,3}(\.\d{1,3}){3}$")
    dest_ip: str = Field(..., pattern=r"^\d{1,3}(\.\d{1,3}){3}$")
    action: Action
    status_code: int = Field(..., ge=100, le=599)
    username: str | None = None
    bytes_sent: int = Field(..., ge=0)
    tenant_id: str = Field(default="default_tenant", max_length=64)


class BatchLogEventRequest(BaseModel):
    events: list[LogEvent] = Field(..., min_length=1, max_length=500)
    tenant_id: str = Field(default="default_tenant", max_length=64)


class BatchIngestResponse(BaseModel):
    status: str = "ok"
    events_processed: int
    alerts_generated: int


# ---------------------------------------------------------------------------
# Alert Payload Schema (Backend → WebSocket → Frontend)
# IMPORTANT: never include raw log lines or full event history.
# ---------------------------------------------------------------------------

class AlertPayload(BaseModel):
    alert_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source_ip: str
    threat_type: ThreatType
    confidence: Confidence
    detail: str = Field(..., max_length=120)
    tenant_id: str = Field(default="default_tenant", max_length=64)
    seq: int = Field(default=0, ge=0)

    def to_ws_dict(self) -> dict:
        """Minimal serialisation for WebSocket push."""
        return {
            "alert_id": self.alert_id,
            "timestamp": self.timestamp.isoformat(),
            "source_ip": self.source_ip,
            "threat_type": self.threat_type.value,
            "confidence": self.confidence.value,
            "detail": self.detail,
            "tenant_id": self.tenant_id,
            "seq": self.seq,
        }


class BackfillResponse(BaseModel):
    type: Literal["BACKFILL"] = "BACKFILL"
    tenant_id: str
    since_seq: int
    latest_seq: int
    alerts: list[dict]


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(..., min_length=6, max_length=128)
    tenant_name: str | None = Field(default=None, max_length=64)


class TokenRequest(BaseModel):
    username: str
    password: str
    tenant_id: str = Field(default="default_tenant", max_length=64)


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    refresh_token: str | None = None
    expires_in: int = 3600
    tenant_id: str = "default_tenant"
    api_key: str | None = None
    is_demo: bool = False


class UserProfileResponse(BaseModel):
    username: str
    tenant_id: str
    api_key: str
    role: str
    is_demo: bool = False
    created_at: str


class WSTicketResponse(BaseModel):
    ticket: str
    tenant_id: str = "default_tenant"


