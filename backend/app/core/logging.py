"""
Structured logging — single configuration point so request handlers,
services, and webhook dispatchers all log in the same shape.

Why structured (not f-string): logs travel to ops dashboards (Datadog,
Grafana Loki, plain CloudWatch). Key=value or JSON formats let those
tools index by `order_id`, `status`, `latency_ms` without regex.
"""

from __future__ import annotations

import logging
import sys
from typing import Any


class _KeyValueFormatter(logging.Formatter):
    """Compact `level=INFO msg="..." key=value` output for the console."""

    BASE_FIELDS = {
        "name",
        "msg",
        "args",
        "levelname",
        "levelno",
        "pathname",
        "filename",
        "module",
        "exc_info",
        "exc_text",
        "stack_info",
        "lineno",
        "funcName",
        "created",
        "msecs",
        "relativeCreated",
        "thread",
        "threadName",
        "processName",
        "process",
        "message",
        "asctime",
        "taskName",
    }

    def format(self, record: logging.LogRecord) -> str:
        ts = self.formatTime(record, "%Y-%m-%dT%H:%M:%S")
        base = f'time={ts} level={record.levelname} logger={record.name} msg="{record.getMessage()}"'
        extras = {
            k: v for k, v in record.__dict__.items() if k not in self.BASE_FIELDS
        }
        if not extras:
            return base
        kv = " ".join(f"{k}={_fmt(v)}" for k, v in extras.items())
        return f"{base} {kv}"


def _fmt(v: Any) -> str:
    if isinstance(v, (int, float, bool)):
        return str(v)
    if v is None:
        return "null"
    s = str(v).replace('"', "'")
    if any(c.isspace() for c in s):
        return f'"{s}"'
    return s


def configure_logging(level: str = "INFO") -> None:
    """Idempotent — safe to call from `main.py` and from tests."""
    root = logging.getLogger()
    root.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_KeyValueFormatter())
    root.addHandler(handler)
    root.setLevel(level.upper())
    # Quiet noisy 3rd-party loggers we don't own.
    for noisy in ("uvicorn.access", "uvicorn.error", "asyncio"):
        logging.getLogger(noisy).setLevel("WARNING")
