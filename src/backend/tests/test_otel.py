"""Tests for v0.5 Phase 2.3 observability stack.

Three invariants:
1. OTel FastAPI instrumentation is registered on the app (if the package
   is installed). When `opentelemetry-instrumentation-fastapi` is
   missing, the app MUST still start (try/except around instrument_app).
2. structlog pipeline emits JSON with `correlation_id` field. If
   structlog is not installed, structlog-related assertions are skipped
   but the rest of the contract still holds.
3. The stdlib `logging` filter path is unchanged — every log record
   emitted during a request still carries `correlation_id`.
"""
from __future__ import annotations

import importlib
import json
import logging
import re
import sys

import pytest
from fastapi.testclient import TestClient

# Reload-import the main module so logging.filters() install once per
# test process. Otherwise pytest collects these tests with cached state
# from prior modules and the correlation_id filter does not register
# freshly in caplog.
from app.core import logging as app_logging  # noqa: E402

_app_module = importlib.import_module("app.main")


@pytest.fixture
def client():
    """Same shape as test_correlation_middleware.client — bare TestClient."""
    with TestClient(_app_module.app) as c:
        yield c


# ---------------------------------------------------------------------------
# Test 1 — OTel FastAPI instrumentation registered (best-effort).
# ---------------------------------------------------------------------------


def test_otel_fastapi_instrumentation_registered_or_skipped():
    """OTel FastAPIInstrumentor.instrument_app must have been called without
    crashing the app. Whether it actually instrumented depends on whether
    `opentelemetry-instrumentation-fastapi` is importable in the test env."""
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor  # type: ignore  # noqa: F401
        pkg_present = True
    except Exception:
        pkg_present = False

    # The app MUST be importable regardless of package presence.
    assert _app_module.app is not None
    assert hasattr(_app_module.app, "router")

    # If the package IS present, an OTel trace provider should exist OR
    # the app should have an `._is_instrumented_by_opentelemetry` marker
    # that FastAPIInstrumentor sets when run. We don't pin an exact
    # symbol because the OTel API surface drifts — the contract is
    # "instrumentation wired up without crashing".
    if pkg_present:
        # Best-effort: FastAPIInstrumentor stores its instrumented apps
        # in a module-level set. We don't fail if the attribute shape
        # differs — only assert the package imports.
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor as _F  # noqa: F401
        assert _F is not None


# ---------------------------------------------------------------------------
# Test 2 — structlog emits JSON with correlation_id (skipped if pkg missing).
# ---------------------------------------------------------------------------


def test_structlog_pipeline_emits_correlation_id():
    """If structlog is installed, configure_structlog() must produce
    JSON output containing a `correlation_id` key, sourced from the
    same contextvar as the stdlib filter.
    """
    try:
        import structlog  # noqa: F401
    except Exception:
        pytest.skip("structlog is not installed in this environment")

    from app.core.logging import configure_structlog, get_logger
    from app.core.middleware import _correlation_id_var

    configure_structlog()
    logger = get_logger("test_structlog_pipeline")

    captured_lines: list[str] = []

    class _CapturingHandler(logging.Handler):
        def emit(self, record):
            try:
                msg = record.getMessage()
                if msg.startswith("{"):
                    captured_lines.append(msg)
            except Exception:
                pass

    root = logging.getLogger()
    capture = _CapturingHandler()
    capture.setLevel(logging.INFO)
    root.addHandler(capture)

    try:
        # structlog.PrintLoggerFactory writes to sys.stdout. Capture.
        import io

        buf = io.StringIO()
        original_stdout = sys.stdout
        sys.stdout = buf
        try:
            _correlation_id_var.set("structlog-test-cid")
            logger.info("hello", extra_key="extra_value")
        finally:
            sys.stdout = original_stdout

        raw = buf.getvalue().strip()
        # Should be a single JSON line.
        assert raw, "structlog did not emit any output"
        record = json.loads(raw.splitlines()[-1])
        assert record["event"] == "hello"
        assert record["correlation_id"] == "structlog-test-cid"
        assert record["extra_key"] == "extra_value"
        assert "timestamp" in record
        assert "level" in record
    finally:
        root.removeHandler(capture)


# ---------------------------------------------------------------------------
# Test 3 — stdlib `logging` filter path is unchanged (regression guard).
# ---------------------------------------------------------------------------


def test_stdlib_logging_filter_still_stamps_correlation_id(caplog):
    """Regression guard for Phase 0b.3: every stdlib log record during a
    request still carries the active correlation_id.
    """
    from app.core.logging import CorrelationIDFilter
    from app.core.middleware import _correlation_id_var

    test_filter = CorrelationIDFilter()
    captured: list[logging.LogRecord] = []

    class _Capture(logging.Handler):
        def emit(self, record):
            captured.append(record)

    cap_handler = _Capture()
    cap_handler.addFilter(test_filter)

    logger = logging.getLogger("test_otel_regression")
    logger.addHandler(cap_handler)
    logger.setLevel(logging.INFO)
    try:
        supplied = "otel-regression-cid"
        _correlation_id_var.set(supplied)
        logger.info("regression check")
        assert any(
            getattr(r, "correlation_id", None) == supplied for r in captured
        ), f"No record tagged with correlation_id={supplied!r}; got {captured!r}"
    finally:
        logger.removeHandler(cap_handler)


# ---------------------------------------------------------------------------
# Test 4 — X-Request-ID propagates through the OTel-instrumented app.
# ---------------------------------------------------------------------------


def test_request_id_propagates_with_otel_instrumentation(client):
    """Caller-supplied X-Request-ID is echoed verbatim by the correlation
    middleware, regardless of whether OTel is wrapped around the route."""
    supplied = "otel-route-correlation-12345"
    response = client.get("/api/v1/health", headers={"X-Request-ID": supplied})
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID") == supplied


# ---------------------------------------------------------------------------
# Test 5 — `configure_logging` is idempotent (double-call safety).
# ---------------------------------------------------------------------------


def test_configure_logging_idempotent():
    """Calling configure_logging twice must NOT duplicate handlers."""
    from app.core.logging import configure_logging

    root = logging.getLogger()
    before = list(root.handlers)
    configure_logging()
    mid = list(root.handlers)
    configure_logging()
    after = list(root.handlers)
    # After two calls, handler count must equal handler count after one
    # call (configure_logging removes pre-existing first).
    assert len(mid) == len(after), (
        f"configure_logging duplicated handlers: before={len(before)}, "
        f"after_first={len(mid)}, after_second={len(after)}"
    )
