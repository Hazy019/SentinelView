"""
app/routers/ingest.py — POST /api/v1/ingest

Receives, validates, and analyses log events from the generator.
Pushes alerts to connected WebSocket clients via the connection manager.
Enqueues events and alerts for async SQLite persistence.

Security: requires valid JWT.
"""

from fastapi import APIRouter, Depends, status

from app.core.dependencies import require_jwt
from app.core.logging import get_logger
from app.db.database import enqueue_alert, enqueue_log_event
from app.engine import rules
from app.models.schemas import LogEvent
from app.ws.connection_manager import manager

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1", tags=["ingest"])


@router.post("/ingest", status_code=status.HTTP_200_OK)
async def ingest(
    event: LogEvent,
    _username: str = Depends(require_jwt),
) -> dict:
    """
    Ingest a single log event.

    1. Validate against LogEvent schema (Pydantic handles this).
    2. Persist to SQLite via write queue (non-blocking).
    3. Run through the rules engine.
    4. If an alert is generated, persist it and broadcast to all WS clients.
    """
    # Persist the raw event (for crash-recovery window rebuild)
    await enqueue_log_event({
        "timestamp": event.timestamp.isoformat(),
        "source_ip": event.source_ip,
        "dest_ip": event.dest_ip,
        "action": event.action.value,
        "status_code": event.status_code,
        "username": event.username,
        "bytes_sent": event.bytes_sent,
    })

    # Run threat detection
    alert = rules.analyze(event)

    if alert:
        # Persist the alert
        await enqueue_alert({
            "alert_id": alert.alert_id,
            "timestamp": alert.timestamp.isoformat(),
            "source_ip": alert.source_ip,
            "threat_type": alert.threat_type.value,
            "confidence": alert.confidence.value,
            "detail": alert.detail,
        })

        # Broadcast to all connected WebSocket clients (minimal payload only)
        await manager.broadcast(alert.to_ws_dict())

    return {"status": "ok", "alert_generated": alert is not None}
