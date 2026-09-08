"""
app/routers/ingest.py — POST /api/v1/ingest & POST /api/v1/ingest/batch

Receives, validates, and analyses log events from the generator or external systems.
Pushes alerts to connected WebSocket clients via the tenant-isolated connection manager.
Enqueues events and alerts for async SQLite persistence.
Supports optional outbound Webhook notifications to external SIEMs/chatbots.

Security: requires valid JWT or static INGEST_API_KEY.
"""

import asyncio
import httpx
from fastapi import APIRouter, Depends, status

from app.core.config import get_settings
from app.core.dependencies import require_jwt_or_api_key
from app.core.logging import get_logger
from app.db.database import enqueue_alert, enqueue_log_event
from app.engine import rules
from app.models.schemas import (
    AlertPayload,
    BatchIngestResponse,
    BatchLogEventRequest,
    LogEvent,
)
from app.ws.connection_manager import manager

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1", tags=["ingest"])


async def _dispatch_webhook_alert(alert: AlertPayload) -> None:
    """Optionally fire an outbound webhook payload to external alert receivers (Discord, Slack, SOAR)."""
    settings = get_settings()
    if not settings.alert_webhook_url:
        return

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(
                settings.alert_webhook_url,
                json={
                    "event": "sentinelview.alert",
                    "data": alert.to_ws_dict(),
                },
            )
            logger.info("webhook.dispatched", alert_id=alert.alert_id, tenant_id=alert.tenant_id)
    except Exception as exc:
        logger.warning("webhook.dispatch_failed", alert_id=alert.alert_id, error=str(exc))


async def _process_single_event(event: LogEvent) -> AlertPayload | None:
    """Helper to persist event, evaluate rules, persist alert, broadcast WS, and dispatch webhook."""
    # Persist the raw event with tenant metadata
    await enqueue_log_event({
        "timestamp": event.timestamp.isoformat(),
        "source_ip": event.source_ip,
        "dest_ip": event.dest_ip,
        "action": event.action.value,
        "status_code": event.status_code,
        "username": event.username,
        "bytes_sent": event.bytes_sent,
        "tenant_id": event.tenant_id,
    })

    # Run threat detection (tenant-aware)
    alert = rules.analyze(event)

    if alert:
        # Persist the alert with tenant and monotonic sequence ID
        await enqueue_alert({
            "alert_id": alert.alert_id,
            "timestamp": alert.timestamp.isoformat(),
            "source_ip": alert.source_ip,
            "threat_type": alert.threat_type.value,
            "confidence": alert.confidence.value,
            "detail": alert.detail,
            "tenant_id": alert.tenant_id,
            "seq": alert.seq,
        })

        # Broadcast to all connected WebSocket clients within this tenant
        await manager.broadcast(alert.to_ws_dict(), tenant_id=alert.tenant_id)

        # Dispatch outbound webhook asynchronously in background
        asyncio.create_task(_dispatch_webhook_alert(alert))

    return alert


@router.post("/ingest", status_code=status.HTTP_200_OK)
async def ingest(
    event: LogEvent,
    _auth: str = Depends(require_jwt_or_api_key),
) -> dict:
    """
    Ingest a single log event.

    1. Validate against LogEvent schema.
    2. Persist to SQLite via write queue (non-blocking).
    3. Run through the rules engine.
    4. If an alert is generated, persist, broadcast to WS clients, and trigger webhooks.
    """
    alert = await _process_single_event(event)
    return {
        "status": "ok",
        "alert_generated": alert is not None,
        "tenant_id": event.tenant_id,
    }


@router.post("/ingest/batch", response_model=BatchIngestResponse, status_code=status.HTTP_200_OK)
async def ingest_batch(
    body: BatchLogEventRequest,
    _auth: str = Depends(require_jwt_or_api_key),
) -> BatchIngestResponse:
    """
    Ingest a batch of up to 500 log events in a single HTTP request.
    Ideal for external log shippers (Vector, Fluent Bit, Promtail) and high-volume pipelines.
    """
    alerts_count = 0
    for evt in body.events:
        if not evt.tenant_id or evt.tenant_id == "default_tenant":
            evt.tenant_id = body.tenant_id
        alert = await _process_single_event(evt)
        if alert:
            alerts_count += 1

    return BatchIngestResponse(
        status="ok",
        events_processed=len(body.events),
        alerts_generated=alerts_count,
    )
