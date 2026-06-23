"""Centralized structured logging and lightweight in-process metrics.

The backend, training scripts, and CLI entrypoints all share this config so
log output is consistent and easy to correlate (request_id binding, ISO
timestamps, level-coloured stderr, optional rotating file sink).

Dependencies: loguru (already required for training).  We deliberately avoid
external metrics backends (statsd, Prometheus client, ...) here because the
project ships as a self-contained research demo: a thread-safe in-memory
registry is enough to expose counts/latencies via the existing FastAPI
``/api/v1/metrics`` endpoint.
"""

from __future__ import annotations

import os
import sys
import threading
import time
from contextlib import contextmanager
from typing import Any, Dict, Iterator, Optional

from loguru import logger

_LOG_FORMAT_HUMAN = (
    "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
    "<level>{level: <8}</level> | "
    "<cyan>{name}</cyan>:<cyan>{line}</cyan> | "
    "{extra} | <level>{message}</level>"
)
_LOG_FORMAT_JSON = "{message}"  # Loguru with serialize=True emits JSON itself.

_DEFAULT_LEVEL = os.environ.get("SAFEMOLGEN_LOG_LEVEL", "INFO").upper()
_DEFAULT_JSON = os.environ.get("SAFEMOLGEN_LOG_JSON", "0") == "1"

_LOG_INITIALIZED = False
_LOG_LOCK = threading.Lock()


def setup_logging(
    level: str = _DEFAULT_LEVEL,
    log_file: Optional[str] = None,
    json_logs: bool = _DEFAULT_JSON,
) -> None:
    """Idempotent root-logger setup.

    - ``level`` -- minimum level for stderr / file sinks.
    - ``log_file`` -- optional path; rotated at 10 MB, keeps 5 backups.
    - ``json_logs`` -- emit one JSON object per record (machine-readable).
    """
    global _LOG_INITIALIZED
    with _LOG_LOCK:
        logger.remove()
        logger.add(
            sys.stderr,
            level=level,
            format=_LOG_FORMAT_JSON if json_logs else _LOG_FORMAT_HUMAN,
            serialize=json_logs,
            enqueue=False,
            backtrace=False,
            diagnose=False,
        )
        if log_file:
            logger.add(
                log_file,
                level=level,
                rotation="10 MB",
                retention=5,
                compression="zip",
                serialize=json_logs,
                enqueue=True,
                backtrace=False,
                diagnose=False,
            )
        _LOG_INITIALIZED = True


def get_logger(component: str):
    """Bind a stable ``component`` field to every log record."""
    if not _LOG_INITIALIZED:
        setup_logging()
    return logger.bind(component=component)


# ---------------------------------------------------------------------------
# Metrics registry (counters + histograms) -- thread-safe, in-process only.
# ---------------------------------------------------------------------------

class _Histogram:
    __slots__ = ("count", "total", "min", "max")

    def __init__(self) -> None:
        self.count = 0
        self.total = 0.0
        self.min = float("inf")
        self.max = 0.0

    def observe(self, value: float) -> None:
        self.count += 1
        self.total += value
        if value < self.min:
            self.min = value
        if value > self.max:
            self.max = value

    def snapshot(self) -> Dict[str, float]:
        if self.count == 0:
            return {"count": 0, "avg_ms": 0.0, "min_ms": 0.0, "max_ms": 0.0}
        return {
            "count": self.count,
            "avg_ms": round(self.total / self.count, 3),
            "min_ms": round(self.min, 3),
            "max_ms": round(self.max, 3),
        }


class MetricsRegistry:
    """Counters + millisecond-latency histograms keyed by name."""

    def __init__(self) -> None:
        self._counters: Dict[str, int] = {}
        self._histograms: Dict[str, _Histogram] = {}
        self._lock = threading.Lock()
        self._started_at = time.time()

    def incr(self, name: str, by: int = 1) -> None:
        with self._lock:
            self._counters[name] = self._counters.get(name, 0) + by

    def observe_ms(self, name: str, value_ms: float) -> None:
        with self._lock:
            hist = self._histograms.get(name)
            if hist is None:
                hist = _Histogram()
                self._histograms[name] = hist
            hist.observe(value_ms)

    @contextmanager
    def time_block(self, name: str) -> Iterator[None]:
        start = time.perf_counter()
        try:
            yield
        finally:
            self.observe_ms(name, (time.perf_counter() - start) * 1000.0)

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            counters = dict(self._counters)
            hists = {k: v.snapshot() for k, v in self._histograms.items()}
        return {
            "uptime_seconds": round(time.time() - self._started_at, 2),
            "counters": counters,
            "latency_ms": hists,
        }


metrics = MetricsRegistry()
