"""
app/routers/websocket_router.py — WebSocket /ws endpoint.

Security:
- JWT is NEVER accepted as a URL query parameter.
- Auth uses the one-time ticket system (POST /auth/ws-ticket → /ws?ticket=<uuid>).
- Expired or already-used tickets return HTTP 403 before upgrade.
- After upgrade, the connection receives live alert payloads only.
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
) -> None:
    """
    WebSocket alert stream.

    Auth: ticket issued by POST /auth/ws-ticket, passed as ?ticket=<uuid>.
    The ticket is validated and burned immediately on connect.
    The JWT itself is never placed in the URL.
    """
    # Validate and burn the ticket BEFORE accepting the WebSocket upgrade.
    if not validate_and_burn_ticket(ticket):
        logger.warning(
            "ws.rejected_invalid_ticket",
            ticket_prefix=redact_ticket(ticket),
        )
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(ws)
    try:
        # Keep the connection alive; the server only pushes (no client messages expected).
        while True:
            # Await any client message — used purely to detect disconnection.
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(ws)
