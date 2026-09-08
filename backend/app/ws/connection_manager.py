"""
app/ws/connection_manager.py — Multi-Tenant WebSocket Connection Manager.

Features:
- Tenant-isolated connection pools: _active[tenant_id]
- Monotonic sequence numbers per tenant: _seq_counters[tenant_id]
- In-memory ring buffer (last 500 alerts per tenant) for zero-gap reconnect backfill
- Fast, non-blocking broadcast with dead-connection eviction
"""

import json
from collections import defaultdict, deque
from typing import Any

from fastapi import WebSocket

from app.core.logging import get_logger

logger = get_logger(__name__)

RING_BUFFER_SIZE = 500


class ConnectionManager:
    def __init__(self) -> None:
        # tenant_id -> set of active WebSockets
        self._active: defaultdict[str, set[WebSocket]] = defaultdict(set)
        # tenant_id -> monotonic sequence counter
        self._seq_counters: defaultdict[str, int] = defaultdict(int)
        # tenant_id -> rolling ring buffer of recent alerts
        self._ring_buffers: defaultdict[str, deque[dict[str, Any]]] = defaultdict(
            lambda: deque(maxlen=RING_BUFFER_SIZE)
        )

    def next_seq(self, tenant_id: str = "default_tenant") -> int:
        """Increment and return the next monotonic sequence number for a tenant."""
        self._seq_counters[tenant_id] += 1
        return self._seq_counters[tenant_id]

    async def connect(self, ws: WebSocket, tenant_id: str = "default_tenant") -> None:
        """Accept WebSocket and register under the tenant pool."""
        await ws.accept()
        self._active[tenant_id].add(ws)
        logger.info(
            "ws.client_connected",
            tenant_id=tenant_id,
            tenant_clients=len(self._active[tenant_id]),
            total_clients=self.client_count(),
        )

    def disconnect(self, ws: WebSocket, tenant_id: str = "default_tenant") -> None:
        """Remove WebSocket from tenant pool."""
        self._active[tenant_id].discard(ws)
        if not self._active[tenant_id]:
            self._active.pop(tenant_id, None)
        logger.info("ws.client_disconnected", tenant_id=tenant_id)

    async def broadcast(self, payload: dict[str, Any], tenant_id: str = "default_tenant") -> None:
        """
        Broadcast alert payload to all connected clients within the tenant.
        Appends to tenant ring buffer for backfill support.
        Dead connections are evicted cleanly.
        """
        # Store in tenant ring buffer
        self._ring_buffers[tenant_id].append(payload)

        clients = self._active.get(tenant_id, set())
        if not clients:
            return

        message = json.dumps(payload)
        dead: set[WebSocket] = set()

        for ws in list(clients):
            try:
                await ws.send_text(message)
            except Exception as exc:
                logger.warning("ws.send_failed", tenant_id=tenant_id, exc=str(exc))
                dead.add(ws)

        for ws in dead:
            self.disconnect(ws, tenant_id=tenant_id)

    def get_backfill(self, tenant_id: str, since_seq: int) -> list[dict[str, Any]]:
        """
        Retrieve all missed alerts for a tenant with seq > since_seq.
        Used when a client reconnects after network drop.
        """
        buffer = self._ring_buffers.get(tenant_id)
        if not buffer:
            return []

        return [alert for alert in buffer if alert.get("seq", 0) > since_seq]

    def get_latest_seq(self, tenant_id: str = "default_tenant") -> int:
        return self._seq_counters.get(tenant_id, 0)

    def client_count(self, tenant_id: str | None = None) -> int:
        if tenant_id:
            return len(self._active.get(tenant_id, set()))
        return sum(len(s) for s in self._active.values())


# Singleton instance
manager = ConnectionManager()
