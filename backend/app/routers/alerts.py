"""
app/routers/alerts.py — GET /api/v1/alerts?limit=50 (REST fallback)

Used by the frontend to re-hydrate alert history after a WebSocket reconnect.
Returns the most recent `limit` alerts from SQLite, newest-first.

Security: requires valid JWT.
"""

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import require_jwt
from app.db.database import fetch_recent_alerts

router = APIRouter(prefix="/api/v1", tags=["alerts"])


@router.get("/alerts")
async def get_alerts(
    limit: int = Query(default=50, ge=1, le=200),
    _username: str = Depends(require_jwt),
) -> list[dict]:
    """
    Return the most recent alerts from persistent storage.

    Called by the frontend after a WebSocket reconnect to re-hydrate
    the alert feed without missing events that occurred during downtime.
    Returns Alert Payload Schema fields only — no raw log content.
    """
    return await fetch_recent_alerts(limit=limit)
