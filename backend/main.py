"""
SentinelView — FastAPI application entry point.

IMPORTANT: Run with exactly ONE Uvicorn worker.
  uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1

Multi-worker mode is EXPLICITLY FORBIDDEN. The in-memory sliding-window
state (defaultdict of deques) and the WebSocket connection manager do NOT
synchronise across processes. Running multiple workers will:
  - Produce silent false-negatives in threat detection.
  - Route WS connections to different workers than the ingest handler.
This is a hard architectural constraint, not a configuration preference.
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.db.database import (
    close_db,
    flush_worker,
    init_db,
    load_recent_log_events,
    prune_old_events,
)
from app.engine.rules import rebuild_from_history
from app.routers import alerts, auth, ingest, websocket_router

settings = get_settings()
configure_logging(settings.log_level)
logger = get_logger("sentinelview.main")


# ---------------------------------------------------------------------------
# Lifespan: startup and shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- STARTUP ----
    logger.info("startup.begin")

    # 1. Initialize SQLite (WAL mode, create tables)
    await init_db(db_path=settings.db_path)

    # 2. Crash recovery: rebuild sliding-window from last 60 seconds
    recent_events = await load_recent_log_events(seconds=60)
    await rebuild_from_history(recent_events)

    # 3. Start the async write-queue flush worker (batches every 500ms)
    flush_task = asyncio.create_task(flush_worker(), name="db-flush-worker")

    # 4. Start periodic pruning task (every 2 minutes)
    async def _prune_loop():
        while True:
            await asyncio.sleep(120)
            await prune_old_events()

    prune_task = asyncio.create_task(_prune_loop(), name="db-prune-worker")

    logger.info("startup.complete", db=settings.db_path)
    yield

    # ---- SHUTDOWN ----
    logger.info("shutdown.begin")
    flush_task.cancel()
    prune_task.cancel()
    try:
        await flush_task
    except asyncio.CancelledError:
        pass
    try:
        await prune_task
    except asyncio.CancelledError:
        pass
    await close_db()
    logger.info("shutdown.complete")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SentinelView",
    description=(
        "Real-time cybersecurity threat visualiser. "
        "Detects BRUTE_FORCE, PORT_SCAN, and DATA_EXFIL patterns "
        "from simulated network log events."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Phase 10 — CORS middleware
# NEVER use "*" — lock to exact Vercel origin from environment.
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


# ---------------------------------------------------------------------------
# Phase 10 — Log redaction middleware
# Redact URL query parameters containing "token" or "ticket" in access logs.
# ---------------------------------------------------------------------------

@app.middleware("http")
async def redact_sensitive_query_params(request: Request, call_next) -> Response:
    """
    Redact sensitive query params from request URL before logging.
    This prevents ticket/token values from appearing in access logs.
    """
    sensitive_keys = {"token", "ticket"}
    query_params = dict(request.query_params)
    redacted = {
        k: ("[REDACTED]" if k.lower() in sensitive_keys else v)
        for k, v in query_params.items()
    }

    # Log the sanitised access record
    safe_url = str(request.url.path)
    if redacted:
        qs = "&".join(f"{k}={v}" for k, v in redacted.items())
        safe_url = f"{safe_url}?{qs}"

    logger.info(
        "http.request",
        method=request.method,
        path=safe_url,
        client=request.client.host if request.client else "unknown",
    )

    response = await call_next(request)

    logger.info(
        "http.response",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
    )
    return response


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auth.router)
app.include_router(ingest.router)
app.include_router(alerts.router)
app.include_router(websocket_router.router)


# ---------------------------------------------------------------------------
# Health check (used by Render.com liveness probe)
# ---------------------------------------------------------------------------

@app.get("/health", tags=["meta"])
async def health() -> dict:
    """Liveness probe. Returns immediately — no DB query."""
    return {"status": "ok", "version": "1.0.0"}
