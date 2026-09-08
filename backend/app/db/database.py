"""
app/db/database.py — aiosqlite setup, WAL mode, async write queue, and multi-tenant audit query helpers.

Architecture rules:
- WAL mode enabled at startup: PRAGMA journal_mode=WAL;
- All SQLite writes go through a single asyncio.Queue (write_queue).
- The flush_worker coroutine batches writes every 500ms.
- Safe automatic migrations for tenant_id and monotonic sequence columns.
- Query helper query_alerts() supports SOC2-adjacent historical audits and gap backfills.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any

import aiosqlite

from app.core.logging import get_logger

logger = get_logger(__name__)

DB_PATH: str = "./sentinel.db"

# Single write queue — all DB writes are funnelled here.
write_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

# Shared aiosqlite connection (opened once at startup, closed at shutdown).
_db_connection: aiosqlite.Connection | None = None


async def get_db() -> aiosqlite.Connection:
    """Return the singleton DB connection. Must be initialised first."""
    if _db_connection is None:
        raise RuntimeError("Database not initialised. Call init_db() first.")
    return _db_connection


async def init_db(db_path: str = DB_PATH) -> None:
    """
    Open the database, enable WAL mode, and create tables if needed.
    Called once from the FastAPI lifespan startup handler.
    """
    global _db_connection, DB_PATH
    DB_PATH = db_path
    logger.info("database.init", path=db_path)

    _db_connection = await aiosqlite.connect(db_path)
    _db_connection.row_factory = aiosqlite.Row

    # Enable WAL journal mode for better concurrent read performance.
    await _db_connection.execute("PRAGMA journal_mode=WAL;")
    await _db_connection.execute("PRAGMA synchronous=NORMAL;")

    # --- Log events table (for crash-recovery window rebuild) ---
    await _db_connection.execute("""
        CREATE TABLE IF NOT EXISTS log_events (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp   TEXT    NOT NULL,
            source_ip   TEXT    NOT NULL,
            dest_ip     TEXT    NOT NULL,
            action      TEXT    NOT NULL,
            status_code INTEGER NOT NULL,
            username    TEXT,
            bytes_sent  INTEGER NOT NULL,
            tenant_id   TEXT    NOT NULL DEFAULT 'default_tenant'
        )
    """)

    # --- Alerts table (Alert Payload Schema only — no raw logs) ---
    await _db_connection.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            alert_id    TEXT PRIMARY KEY,
            timestamp   TEXT NOT NULL,
            source_ip   TEXT NOT NULL,
            threat_type TEXT NOT NULL,
            confidence  TEXT NOT NULL,
            detail      TEXT NOT NULL,
            tenant_id   TEXT NOT NULL DEFAULT 'default_tenant',
            seq         INTEGER NOT NULL DEFAULT 0
        )
    """)

    # Safe progressive migrations for pre-existing databases
    for col_sql in [
        "ALTER TABLE log_events ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default_tenant'",
        "ALTER TABLE alerts ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default_tenant'",
        "ALTER TABLE alerts ADD COLUMN seq INTEGER NOT NULL DEFAULT 0",
    ]:
        try:
            await _db_connection.execute(col_sql)
        except Exception:
            pass  # Column already exists

    # Indexes
    await _db_connection.execute("""
        CREATE INDEX IF NOT EXISTS idx_log_events_ts
        ON log_events(timestamp)
    """)
    await _db_connection.execute("""
        CREATE INDEX IF NOT EXISTS idx_alerts_tenant_seq
        ON alerts(tenant_id, seq)
    """)
    await _db_connection.execute("""
        CREATE INDEX IF NOT EXISTS idx_alerts_ts
        ON alerts(timestamp)
    """)

    await _db_connection.commit()
    logger.info("database.ready", journal_mode="WAL")


async def close_db() -> None:
    """Close the database connection. Called from lifespan shutdown."""
    global _db_connection
    if _db_connection:
        await _db_connection.close()
        _db_connection = None
        logger.info("database.closed")


# ---------------------------------------------------------------------------
# Async write queue + flush worker
# ---------------------------------------------------------------------------

async def enqueue_log_event(event: dict[str, Any]) -> None:
    """Put a log event on the write queue. Non-blocking."""
    if "tenant_id" not in event:
        event["tenant_id"] = "default_tenant"
    await write_queue.put({"type": "log_event", "data": event})


async def enqueue_alert(alert: dict[str, Any]) -> None:
    """Put an alert on the write queue. Non-blocking."""
    if "tenant_id" not in alert:
        alert["tenant_id"] = "default_tenant"
    if "seq" not in alert:
        alert["seq"] = 0
    await write_queue.put({"type": "alert", "data": alert})


async def flush_worker() -> None:
    """
    Drain the write queue in batches every 500ms.
    Runs as a background asyncio task for the lifetime of the server.
    """
    logger.info("flush_worker.started")
    while True:
        await asyncio.sleep(0.5)

        if write_queue.empty():
            continue

        batch_log: list[dict] = []
        batch_alert: list[dict] = []

        while not write_queue.empty():
            try:
                item = write_queue.get_nowait()
                if item["type"] == "log_event":
                    batch_log.append(item["data"])
                elif item["type"] == "alert":
                    batch_alert.append(item["data"])
            except asyncio.QueueEmpty:
                break

        db = await get_db()
        try:
            if batch_log:
                await db.executemany(
                    """INSERT INTO log_events
                       (timestamp, source_ip, dest_ip, action, status_code, username, bytes_sent, tenant_id)
                       VALUES (:timestamp, :source_ip, :dest_ip, :action,
                               :status_code, :username, :bytes_sent, :tenant_id)""",
                    batch_log,
                )

            if batch_alert:
                await db.executemany(
                    """INSERT OR IGNORE INTO alerts
                       (alert_id, timestamp, source_ip, threat_type, confidence, detail, tenant_id, seq)
                       VALUES (:alert_id, :timestamp, :source_ip,
                               :threat_type, :confidence, :detail, :tenant_id, :seq)""",
                    batch_alert,
                )

            if batch_log or batch_alert:
                await db.commit()
                logger.debug(
                    "flush_worker.flushed",
                    log_events=len(batch_log),
                    alerts=len(batch_alert),
                )
        except Exception as exc:
            logger.error("flush_worker.error", exc=str(exc))


# ---------------------------------------------------------------------------
# Crash-recovery & Audit Query Helpers
# ---------------------------------------------------------------------------

async def load_recent_log_events(seconds: int = 60) -> list[dict]:
    """
    Return log events from the last `seconds` seconds.
    Used on startup to rebuild the in-memory sliding-window state.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=seconds)).isoformat()
    db = await get_db()
    cursor = await db.execute(
        """SELECT timestamp, source_ip, dest_ip, action, status_code, username, bytes_sent, tenant_id
           FROM log_events
           WHERE timestamp >= ?
           ORDER BY timestamp ASC""",
        (cutoff,),
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def query_alerts(
    tenant_id: str = "default_tenant",
    since_seq: int | None = None,
    threat_type: str | None = None,
    confidence: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """
    Query historical alerts for audit trail or client backfill.
    Supports multi-tenant filtering and monotonic sequence ranges.
    """
    db = await get_db()
    conditions = ["tenant_id = ?"]
    params: list[Any] = [tenant_id]

    if since_seq is not None:
        conditions.append("seq > ?")
        params.append(since_seq)

    if threat_type:
        conditions.append("threat_type = ?")
        params.append(threat_type)

    if confidence:
        conditions.append("confidence = ?")
        params.append(confidence)

    sql = f"""
        SELECT alert_id, timestamp, source_ip, threat_type, confidence, detail, tenant_id, seq
        FROM alerts
        WHERE {" AND ".join(conditions)}
        ORDER BY timestamp DESC
        LIMIT ?
    """
    params.append(min(limit, 200))

    cursor = await db.execute(sql, tuple(params))
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def fetch_recent_alerts(limit: int = 50, tenant_id: str = "default_tenant") -> list[dict]:
    """Backward-compatible wrapper for REST re-hydration."""
    return await query_alerts(tenant_id=tenant_id, limit=limit)


async def prune_old_events(retention_hours: int = 1) -> None:
    """
    Delete log events older than retention_hours to prevent database growth.
    Runs as a periodic background task every 120s.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=retention_hours)).isoformat()
    db = await get_db()
    try:
        cursor = await db.execute(
            "DELETE FROM log_events WHERE timestamp < ?",
            (cutoff,),
        )
        deleted = cursor.rowcount
        await db.commit()
        if deleted > 0:
            logger.info("prune_worker.pruned", deleted=deleted, cutoff=cutoff)
    except Exception as exc:
        logger.error("prune_worker.error", exc=str(exc))
