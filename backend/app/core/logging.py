"""
app/core/logging.py — Structured JSON logging via structlog.

Rules enforced here:
- JSON-only output.
- NEVER log JWT tokens, passwords, Authorization headers, or full ticket values.
- Redact URL query parameters containing "token" or "ticket" in middleware (see main.py).
- Log only first 8 chars of a ticket for tracing.
"""

import logging
import sys

import structlog


def configure_logging(log_level: str = "INFO") -> None:
    """
    Configure structlog for JSON output.
    Call once at application startup before any log messages are emitted.
    """
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    structlog.configure(
        processors=shared_processors
        + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=structlog.processors.JSONRenderer(),
        foreign_pre_chain=shared_processors,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.addHandler(handler)
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Silence noisy uvicorn access logs — we use our own middleware
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: str = "sentinelview") -> structlog.stdlib.BoundLogger:
    """Return a named structlog logger."""
    return structlog.get_logger(name)


def redact_ticket(ticket: str) -> str:
    """Return only the first 8 chars of a ticket for safe log tracing."""
    if not ticket:
        return "<empty>"
    return f"{ticket[:8]}..."
