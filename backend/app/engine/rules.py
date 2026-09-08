"""
app/engine/rules.py — Multi-Tenant Sliding-Window Threat Detection Rules Engine.

State lives in asyncio-safe in-memory structures keyed by (tenant_id, source_ip).
Alerts carry tenant_id and an atomic monotonic sequence number (seq).

Thresholds are imported from app.models.schemas.Thresholds (no magic numbers).

On startup, the engine's window is rebuilt from the last 60 seconds of SQLite
events via rebuild_from_history(), providing crash recovery.
"""

from __future__ import annotations

import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Optional

from app.core.logging import get_logger
from app.models.schemas import (
    Action,
    AlertPayload,
    Confidence,
    LogEvent,
    Thresholds,
    ThreatType,
)
from app.ws.connection_manager import manager

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Multi-Tenant Sliding-Window State: (tenant_id, source_ip) -> rolling deques
# ---------------------------------------------------------------------------

# BRUTE_FORCE: track failed LOGIN datetimes per (tenant_id, source_ip)
_failed_logins: defaultdict[tuple[str, str], deque[datetime]] = defaultdict(deque)

# PORT_SCAN: track (timestamp, dest_ip) tuples per (tenant_id, source_ip)
_scan_attempts: defaultdict[tuple[str, str], deque[tuple[datetime, str]]] = defaultdict(deque)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _evict_stale(dq: deque, window_seconds: int) -> None:
    """Remove entries older than window_seconds from the left of the deque."""
    cutoff = _now().timestamp() - window_seconds
    while dq and dq[0][0].timestamp() < cutoff:
        dq.popleft()


def _evict_stale_datetimes(dq: deque[datetime], window_seconds: int) -> None:
    cutoff = _now().timestamp() - window_seconds
    while dq and dq[0].timestamp() < cutoff:
        dq.popleft()


# ---------------------------------------------------------------------------
# Core analysis function — called for every ingested event
# ---------------------------------------------------------------------------

def analyze(event: LogEvent) -> Optional[AlertPayload]:
    """
    Apply all rules to a single log event within its tenant boundary.
    Returns an AlertPayload with monotonic sequence ID if a threat is detected.
    """
    alert = (
        _check_brute_force(event)
        or _check_port_scan(event)
        or _check_data_exfil(event)
    )

    if alert:
        logger.info(
            "alert.generated",
            tenant_id=alert.tenant_id,
            seq=alert.seq,
            threat_type=alert.threat_type.value,
            confidence=alert.confidence.value,
            source_ip=alert.source_ip,
            alert_id=alert.alert_id,
        )

    return alert


# ---------------------------------------------------------------------------
# Rule: BRUTE_FORCE
# ---------------------------------------------------------------------------

def _check_brute_force(event: LogEvent) -> Optional[AlertPayload]:
    if event.action != Action.LOGIN:
        return None

    if event.status_code not in (401, 403):
        return None

    key = (event.tenant_id, event.source_ip)
    ts = event.timestamp if event.timestamp.tzinfo else event.timestamp.replace(tzinfo=timezone.utc)

    # Evict stale entries outside the 10-second window
    _evict_stale_datetimes(_failed_logins[key], Thresholds.BRUTE_FORCE_WINDOW_SECONDS)

    # Record this failure
    _failed_logins[key].append(ts)
    count = len(_failed_logins[key])

    if count > Thresholds.BRUTE_FORCE_HIGH_COUNT:
        seq = manager.next_seq(event.tenant_id)
        return AlertPayload(
            alert_id=str(uuid.uuid4()),
            timestamp=_now(),
            source_ip=event.source_ip,
            threat_type=ThreatType.BRUTE_FORCE,
            confidence=Confidence.HIGH,
            detail=(
                f"{count} failed login attempts from {event.source_ip} "
                f"in {Thresholds.BRUTE_FORCE_WINDOW_SECONDS}s window"
            )[:120],
            tenant_id=event.tenant_id,
            seq=seq,
        )

    if count >= Thresholds.BRUTE_FORCE_MEDIUM_COUNT:
        seq = manager.next_seq(event.tenant_id)
        return AlertPayload(
            alert_id=str(uuid.uuid4()),
            timestamp=_now(),
            source_ip=event.source_ip,
            threat_type=ThreatType.BRUTE_FORCE,
            confidence=Confidence.MEDIUM,
            detail=(
                f"{count} failed login attempts from {event.source_ip} "
                f"in {Thresholds.BRUTE_FORCE_WINDOW_SECONDS}s window"
            )[:120],
            tenant_id=event.tenant_id,
            seq=seq,
        )

    return None


# ---------------------------------------------------------------------------
# Rule: PORT_SCAN
# ---------------------------------------------------------------------------

def _check_port_scan(event: LogEvent) -> Optional[AlertPayload]:
    if event.action != Action.REQUEST:
        return None

    key = (event.tenant_id, event.source_ip)
    ts = event.timestamp if event.timestamp.tzinfo else event.timestamp.replace(tzinfo=timezone.utc)
    dest = event.dest_ip

    # Evict stale entries outside 5-second window
    _evict_stale(_scan_attempts[key], Thresholds.PORT_SCAN_WINDOW_SECONDS)
    _scan_attempts[key].append((ts, dest))

    distinct_dests = {entry[1] for entry in _scan_attempts[key]}
    count = len(distinct_dests)

    if count > Thresholds.PORT_SCAN_HIGH_DEST_COUNT:
        seq = manager.next_seq(event.tenant_id)
        return AlertPayload(
            alert_id=str(uuid.uuid4()),
            timestamp=_now(),
            source_ip=event.source_ip,
            threat_type=ThreatType.PORT_SCAN,
            confidence=Confidence.HIGH,
            detail=(
                f"Port scan: {count} distinct destinations from {event.source_ip} "
                f"in {Thresholds.PORT_SCAN_WINDOW_SECONDS}s"
            )[:120],
            tenant_id=event.tenant_id,
            seq=seq,
        )

    return None


# ---------------------------------------------------------------------------
# Rule: DATA_EXFIL
# ---------------------------------------------------------------------------

def _check_data_exfil(event: LogEvent) -> Optional[AlertPayload]:
    if event.action != Action.TRANSFER:
        return None

    mb = event.bytes_sent / 1_000_000

    if event.bytes_sent > Thresholds.DATA_EXFIL_HIGH_BYTES:
        seq = manager.next_seq(event.tenant_id)
        return AlertPayload(
            alert_id=str(uuid.uuid4()),
            timestamp=_now(),
            source_ip=event.source_ip,
            threat_type=ThreatType.DATA_EXFIL,
            confidence=Confidence.HIGH,
            detail=f"Large data transfer: {mb:.1f}MB from {event.source_ip}"[:120],
            tenant_id=event.tenant_id,
            seq=seq,
        )

    if event.bytes_sent > Thresholds.DATA_EXFIL_MEDIUM_BYTES:
        seq = manager.next_seq(event.tenant_id)
        return AlertPayload(
            alert_id=str(uuid.uuid4()),
            timestamp=_now(),
            source_ip=event.source_ip,
            threat_type=ThreatType.DATA_EXFIL,
            confidence=Confidence.MEDIUM,
            detail=f"Suspicious transfer: {mb:.1f}MB from {event.source_ip}"[:120],
            tenant_id=event.tenant_id,
            seq=seq,
        )

    return None


# ---------------------------------------------------------------------------
# Crash recovery: rebuild window from historical events
# ---------------------------------------------------------------------------

async def rebuild_from_history(events: list[dict]) -> None:
    """
    Replay recent events into the sliding-window state without re-alerting.
    Called once at startup after loading the last 60s from SQLite.
    """
    count = 0
    for raw in events:
        try:
            evt = LogEvent(**raw)
            _update_window_only(evt)
            count += 1
        except Exception as exc:
            logger.warning("rebuild.skip_event", exc=str(exc))

    logger.info("rebuild.complete", events_replayed=count)


def _update_window_only(event: LogEvent) -> None:
    """Update sliding-window state without generating or returning alerts."""
    key = (event.tenant_id, event.source_ip)
    ts = event.timestamp if event.timestamp.tzinfo else event.timestamp.replace(tzinfo=timezone.utc)

    if event.action == Action.LOGIN and event.status_code in (401, 403):
        _evict_stale_datetimes(_failed_logins[key], Thresholds.BRUTE_FORCE_WINDOW_SECONDS)
        _failed_logins[key].append(ts)

    elif event.action == Action.REQUEST:
        _evict_stale(_scan_attempts[key], Thresholds.PORT_SCAN_WINDOW_SECONDS)
        _scan_attempts[key].append((ts, event.dest_ip))
