"""
app/engine/rules.py — Sliding-window threat detection rules engine.

State lives in asyncio-safe in-memory structures (defaultdict of deques).
This state is NOT thread-safe across processes — single Uvicorn worker ONLY.

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

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Sliding-window state — all asyncio-safe (single-worker, coroutine-based)
# ---------------------------------------------------------------------------

# BRUTE_FORCE: track failed LOGIN events per source_ip
# deque items: datetime of each failed login
_failed_logins: defaultdict[str, deque[datetime]] = defaultdict(deque)

# PORT_SCAN: track (timestamp, dest_ip) tuples per source_ip
_scan_attempts: defaultdict[str, deque[tuple[datetime, str]]] = defaultdict(deque)


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
    Apply all rules to a single log event.
    Returns an AlertPayload if a threat is detected, otherwise None.

    All thresholds come from Thresholds constants — no inline numbers.
    """
    # Try each rule in priority order; return the first match.
    alert = (
        _check_brute_force(event)
        or _check_port_scan(event)
        or _check_data_exfil(event)
    )

    if alert:
        logger.info(
            "alert.generated",
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

    # Only count explicit authentication failures
    if event.status_code not in (401, 403):
        return None

    ip = event.source_ip
    ts = event.timestamp if event.timestamp.tzinfo else event.timestamp.replace(tzinfo=timezone.utc)

    # Evict stale entries outside the 10-second window
    _evict_stale_datetimes(_failed_logins[ip], Thresholds.BRUTE_FORCE_WINDOW_SECONDS)

    # Record this failure
    _failed_logins[ip].append(ts)
    count = len(_failed_logins[ip])

    if count > Thresholds.BRUTE_FORCE_HIGH_COUNT:
        return AlertPayload(
            alert_id=str(uuid.uuid4()),
            timestamp=_now(),
            source_ip=ip,
            threat_type=ThreatType.BRUTE_FORCE,
            confidence=Confidence.HIGH,
            detail=(
                f"{count} failed login attempts from {ip} "
                f"in {Thresholds.BRUTE_FORCE_WINDOW_SECONDS}s window"
            )[:120],
        )

    if count >= Thresholds.BRUTE_FORCE_MEDIUM_COUNT:
        return AlertPayload(
            alert_id=str(uuid.uuid4()),
            timestamp=_now(),
            source_ip=ip,
            threat_type=ThreatType.BRUTE_FORCE,
            confidence=Confidence.MEDIUM,
            detail=(
                f"{count} failed login attempts from {ip} "
                f"in {Thresholds.BRUTE_FORCE_WINDOW_SECONDS}s window"
            )[:120],
        )

    return None


# ---------------------------------------------------------------------------
# Rule: PORT_SCAN
# ---------------------------------------------------------------------------

def _check_port_scan(event: LogEvent) -> Optional[AlertPayload]:
    if event.action != Action.REQUEST:
        return None

    ip = event.source_ip
    ts = event.timestamp if event.timestamp.tzinfo else event.timestamp.replace(tzinfo=timezone.utc)
    dest = event.dest_ip

    # Evict stale entries
    _evict_stale(_scan_attempts[ip], Thresholds.PORT_SCAN_WINDOW_SECONDS)

    # Record this attempt
    _scan_attempts[ip].append((ts, dest))

    # Count distinct destination IPs in the window
    distinct_dests = {entry[1] for entry in _scan_attempts[ip]}
    count = len(distinct_dests)

    if count > Thresholds.PORT_SCAN_HIGH_DEST_COUNT:
        return AlertPayload(
            alert_id=str(uuid.uuid4()),
            timestamp=_now(),
            source_ip=ip,
            threat_type=ThreatType.PORT_SCAN,
            confidence=Confidence.HIGH,
            detail=(
                f"Port scan: {count} distinct destinations from {ip} "
                f"in {Thresholds.PORT_SCAN_WINDOW_SECONDS}s"
            )[:120],
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
        return AlertPayload(
            alert_id=str(uuid.uuid4()),
            timestamp=_now(),
            source_ip=event.source_ip,
            threat_type=ThreatType.DATA_EXFIL,
            confidence=Confidence.HIGH,
            detail=f"Large data transfer: {mb:.1f}MB from {event.source_ip}"[:120],
        )

    if event.bytes_sent > Thresholds.DATA_EXFIL_MEDIUM_BYTES:
        return AlertPayload(
            alert_id=str(uuid.uuid4()),
            timestamp=_now(),
            source_ip=event.source_ip,
            threat_type=ThreatType.DATA_EXFIL,
            confidence=Confidence.MEDIUM,
            detail=f"Suspicious transfer: {mb:.1f}MB from {event.source_ip}"[:120],
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
            # Feed into window state without triggering alert dispatch
            _update_window_only(evt)
            count += 1
        except Exception as exc:
            logger.warning("rebuild.skip_event", exc=str(exc))

    logger.info("rebuild.complete", events_replayed=count)


def _update_window_only(event: LogEvent) -> None:
    """Update sliding-window state without generating or returning alerts."""
    ip = event.source_ip
    ts = event.timestamp if event.timestamp.tzinfo else event.timestamp.replace(tzinfo=timezone.utc)

    if event.action == Action.LOGIN and event.status_code in (401, 403):
        _evict_stale_datetimes(_failed_logins[ip], Thresholds.BRUTE_FORCE_WINDOW_SECONDS)
        _failed_logins[ip].append(ts)

    elif event.action == Action.REQUEST:
        _evict_stale(_scan_attempts[ip], Thresholds.PORT_SCAN_WINDOW_SECONDS)
        _scan_attempts[ip].append((ts, event.dest_ip))
