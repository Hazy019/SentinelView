"""
app/routers/websocket_router.py — Multi-Tenant WebSocket /ws endpoint with Backfill Support.

Security:
- JWT is NEVER accepted as a URL query parameter.
- Auth uses the one-time ticket system (POST /auth/ws-ticket → /ws?ticket=<uuid>).
- Expired or already-used tickets return HTTP 403 / WS 1008 before upgrade.
- Zero-gap backfill: Accepts optional `last_seq` and streams missed alerts from tenant ring buffer.
"""

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.core.logging import get_logger, redact_ticket
from app.core.security import validate_and_burn_ticket
from app.ws.connection_manager import manager

logger = get_logger(__name__)
router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    ws: WebSocket,
    ticket: str = Query(..., description="One-time WebSocket auth ticket"),
    tenant_id: str = Query("default_tenant", description="Tenant organization identifier"),
    last_seq: int | None = Query(None, description="Last monotonic sequence ID seen by client for backfill"),
) -> None:
    """
    WebSocket real-time threat alert stream with zero-gap backfill.

    Auth: ticket issued by POST /auth/ws-ticket, passed as ?ticket=<uuid>.
    The ticket is validated and burned immediately on connect.
    If last_seq is supplied, backfills missed alerts before streaming live alerts.
    """
    # Validate and burn the ticket BEFORE accepting the WebSocket upgrade.
    if not validate_and_burn_ticket(ticket):
        logger.warning(
            "ws.rejected_invalid_ticket",
            ticket_prefix=redact_ticket(ticket),
            tenant_id=tenant_id,
        )
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(ws, tenant_id=tenant_id)

    try:
        # Zero-gap backfill handling: If client reconnects with last_seq, push missed alerts
        if last_seq is not None:
            missed = manager.get_backfill(tenant_id=tenant_id, since_seq=last_seq)
            if missed:
                await ws.send_json({
                    "type": "BACKFILL",
                    "tenant_id": tenant_id,
                    "since_seq": last_seq,
                    "latest_seq": manager.get_latest_seq(tenant_id),
                    "alerts": missed,
                })
                logger.info(
                    "ws.backfill_sent",
                    tenant_id=tenant_id,
                    since_seq=last_seq,
                    count=len(missed),
                )

        # Keep connection alive; server pushes alerts via manager.broadcast()
        while True:
            # Await any client ping / message purely to monitor connection liveness
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(ws, tenant_id=tenant_id)
