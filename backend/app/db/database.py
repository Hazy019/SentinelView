"""
app/db/database.py — aiosqlite setup, WAL mode, async write queue.

Architecture rules:
- WAL mode enabled at startup: PRAGMA journal_mode=WAL;
- All SQLite writes go through a single asyncio.Queue (write_queue).
- The flush_worker coroutine batches writes every 500ms.
- NEVER call synchronous SQLite from an async route handler.
- On startup: rebuild the sliding-window state from the last 60 seconds
  of log events stored in SQLite, to recover from a crash gracefully.
"""

import asyncio
import json
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
            bytes_sent  INTEGER NOT NULL
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
            detail      TEXT NOT NULL
        )
    """)

    # Index to speed up the 60-second window rebuild query.
    await _db_connection.execute("""
        CREATE INDEX IF NOT EXISTS idx_log_events_ts
        ON log_events(timestamp)
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
    await write_queue.put({"type": "log_event", "data": event})


async def enqueue_alert(alert: dict[str, Any]) -> None:
    """Put an alert on the write queue. Non-blocking."""
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
                       (timestamp, source_ip, dest_ip, action, status_code, username, bytes_sent)
                       VALUES (:timestamp, :source_ip, :dest_ip, :action,
                               :status_code, :username, :bytes_sent)""",
                    batch_log,
                )

            if batch_alert:
                await db.executemany(
                    """INSERT OR IGNORE INTO alerts
                       (alert_id, timestamp, source_ip, threat_type, confidence, detail)
                       VALUES (:alert_id, :timestamp, :source_ip,
                               :threat_type, :confidence, :detail)""",
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
# Crash-recovery: load recent events for window rebuild
# ---------------------------------------------------------------------------

async def load_recent_log_events(seconds: int = 60) -> list[dict]:
    """
    Return log events from the last `seconds` seconds.
    Used on startup to rebuild the in-memory sliding-window state.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=seconds)).isoformat()
    db = await get_db()
    async with db.execute(
        "SELECT * FROM log_events WHERE timestamp >= ? ORDER BY timestamp ASC",
        (cutoff,),
    ) as cursor:
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Alert history for REST fallback (GET /api/v1/alerts?limit=50)
# ---------------------------------------------------------------------------

async def fetch_recent_alerts(limit: int = 50) -> list[dict]:
    """Return the most recent `limit` alerts ordered newest-first."""
    db = await get_db()
    async with db.execute(
        "SELECT * FROM alerts ORDER BY timestamp DESC LIMIT ?",
        (limit,),
    ) as cursor:
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Cleanup: prune log_events older than 5 minutes (keep DB size manageable)
# ---------------------------------------------------------------------------

async def prune_old_events() -> None:
    """Delete log events older than 5 minutes. Run periodically."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    db = await get_db()
    await db.execute("DELETE FROM log_events WHERE timestamp < ?", (cutoff,))
    await db.commit()
