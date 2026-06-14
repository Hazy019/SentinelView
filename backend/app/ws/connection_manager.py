"""
app/ws/connection_manager.py — WebSocket connection manager.

Manages a set of active WebSocket connections and provides a broadcast
method used by the ingest pipeline to push alerts in real time.

Single worker only — this in-memory set is NOT shared across processes.
"""

import json
from typing import Any

from fastapi import WebSocket

from app.core.logging import get_logger

logger = get_logger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._active: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._active.add(ws)
        logger.info("ws.client_connected", total=len(self._active))

    def disconnect(self, ws: WebSocket) -> None:
        self._active.discard(ws)
        logger.info("ws.client_disconnected", total=len(self._active))

    async def broadcast(self, payload: dict[str, Any]) -> None:
        """
        Send an alert payload to all connected clients.
        Disconnects clients that raise an error mid-send.
        Payload must conform to the Alert Payload Schema — no raw logs.
        """
        if not self._active:
            return

        message = json.dumps(payload)
        dead: set[WebSocket] = set()

        for ws in list(self._active):
            try:
                await ws.send_text(message)
            except Exception as exc:
                logger.warning("ws.send_failed", exc=str(exc))
                dead.add(ws)

        for ws in dead:
            self.disconnect(ws)

    @property
    def client_count(self) -> int:
        return len(self._active)


# Singleton — imported by ingest router and websocket router
manager = ConnectionManager()
