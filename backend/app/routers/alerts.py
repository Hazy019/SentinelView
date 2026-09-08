"""
app/routers/alerts.py — GET /api/v1/alerts (Multi-Tenant Historical Query & REST Fallback)

Used by the frontend to re-hydrate alert history after a WebSocket reconnect,
or for compliance audits to query threat incidents filtered by tenant, sequence,
or threat type.

Security: requires valid JWT.
"""

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import require_jwt
from app.db.database import query_alerts

router = APIRouter(prefix="/api/v1", tags=["alerts"])


@router.get("/alerts")
async def get_alerts(
    limit: int = Query(default=50, ge=1, le=200),
    tenant_id: str = Query(default="default_tenant", description="Tenant organization identifier"),
    since_seq: int | None = Query(default=None, description="Fetch alerts strictly after this sequence number"),
    threat_type: str | None = Query(default=None, description="Filter by BRUTE_FORCE, PORT_SCAN, or DATA_EXFIL"),
    confidence: str | None = Query(default=None, description="Filter by LOW, MEDIUM, or HIGH"),
    _username: str = Depends(require_jwt),
) -> list[dict]:
    """
    Return filtered threat alerts from persistent storage.

    Supports SOC compliance audit queries and zero-gap client backfill.
    Returns Alert Payload Schema fields only — no raw log content.
    """
    return await query_alerts(
        tenant_id=tenant_id,
        since_seq=since_seq,
        threat_type=threat_type,
        confidence=confidence,
        limit=limit,
    )
