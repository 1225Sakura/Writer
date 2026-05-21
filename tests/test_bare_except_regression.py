"""Regression tests: bare-except-pass patterns replaced with logging.

Verifies that exception handlers across the codebase either log the error
or intentionally use a non-pass body (re-raise, return sentinel, etc.).
"""

import ast
import importlib
import logging
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))
sys.path.insert(0, str(PROJECT_ROOT / "src" / "backend"))

# ---------------------------------------------------------------------------
# Modules to audit — every file listed here had bare-except-pass fixed.
# ---------------------------------------------------------------------------
_FIXED_MODULES_REL = [
    "src/backend/services/backup_manager.py",
    "src/backend/services/strand_classifier.py",
    "src/backend/services/task_queue.py",
    "src/backend/services/preload_service.py",
    "src/backend/infrastructure/database/engine.py",
    "src/backend/interface/web/main.py",
    "src/backend/services/rag_service.py",
    "src/backend/infrastructure/observability/metrics_service.py",
    "src/backend/infrastructure/cache/cache_service.py",
]


# ===========================================================================
# Part 1 — AST-based: no bare ``except: pass`` / ``except Exception: pass``
# ===========================================================================


def _find_bare_except_pass(filepath: str) -> list[tuple[int, str]]:
    """Return (line_no, description) for except-handler whose body is only Pass.

    Flags:
    - ``except: pass`` (truly bare — no exception type)
    - ``except Exception: pass`` (broad catch with no logging)

    Intentionally excluded:
    - ``except ImportError: pass`` (optional dependency guard)
    - ``except (ImportError, ...): pass`` (optional dependency guard)
    - ``except WebSocketDisconnect: pass`` (expected WebSocket disconnect)
    - ``except asyncio.CancelledError: ...`` (expected cancellation)
    """
    _ALLOWED_EXCEPTION_NAMES = {
        "ImportError",
        "ModuleNotFoundError",
        "WebSocketDisconnect",
        "CancelledError",
    }

    def _is_allowed_exc_type(exc_node) -> bool:
        """Return True if the except clause catches only allowed specific types."""
        if exc_node is None:
            return False  # bare `except:` is never allowed
        if isinstance(exc_node, ast.Name):
            return exc_node.id in _ALLOWED_EXCEPTION_NAMES
        if isinstance(exc_node, ast.Tuple):
            return all(
                isinstance(elt, ast.Name) and elt.id in _ALLOWED_EXCEPTION_NAMES
                for elt in exc_node.elts
            )
        return False

    with open(filepath, encoding="utf-8") as fh:
        tree = ast.parse(fh.read(), filename=filepath)

    hits: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.ExceptHandler):
            continue
        # Body is a single Pass statement
        if len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
            if _is_allowed_exc_type(node.type):
                continue  # allowed intentional pattern
            exc_name = (
                ast.dump(node.type) if node.type else "bare except"
            )
            hits.append((node.lineno, exc_name))
    return hits


@pytest.mark.parametrize(
    "rel_path",
    _FIXED_MODULES_REL,
    ids=[p.split("/")[-1] for p in _FIXED_MODULES_REL],
)
def test_no_bare_except_pass(rel_path: str):
    """Each fixed module must have zero bare-except-pass patterns."""
    filepath = str(PROJECT_ROOT / rel_path)
    hits = _find_bare_except_pass(filepath)
    if hits:
        details = "; ".join(f"line {ln}: {desc}" for ln, desc in hits)
        pytest.fail(f"{rel_path} still has bare except:pass — {details}")


# ===========================================================================
# Part 2 — Import smoke tests (each fixed module loads without error)
# ===========================================================================


class TestModuleImports:
    """Verify every fixed module can be imported successfully."""

    def test_import_backup_manager(self):
        from backend.services import backup_manager  # noqa: F401

    def test_import_strand_classifier(self):
        from backend.services import strand_classifier  # noqa: F401

    def test_import_task_queue(self):
        from backend.services import task_queue  # noqa: F401

    def test_import_preload_service(self):
        from backend.services import preload_service  # noqa: F401

    def test_import_engine(self):
        from backend.infrastructure.database import engine  # noqa: F401

    def test_import_main(self):
        from backend.interface.web import main  # noqa: F401

    def test_import_rag_service(self):
        from backend.services import rag_service  # noqa: F401

    def test_import_metrics_service(self):
        from backend.infrastructure.observability import metrics_service  # noqa: F401

    def test_import_cache_service(self):
        from backend.infrastructure.cache import cache_service  # noqa: F401


# ===========================================================================
# Part 3 — Behavioral: verify exceptions are LOGGED, not silently swallowed
# ===========================================================================


class TestBackupManagerLogging:
    """backup_manager: _notify_event and _scheduler_loop must log errors."""

    @pytest.mark.asyncio
    async def test_notify_event_logs_handler_error(self, caplog):
        """When an event handler raises, backup_manager must log it."""
        from backend.services.backup_manager import BackupManager

        mgr = BackupManager.__new__(BackupManager)
        mgr._event_handlers = []

        # Register a handler that always raises
        async def _bad_handler(event_type, data):
            raise RuntimeError("handler exploded")

        mgr.on_event(_bad_handler)

        with caplog.at_level(logging.DEBUG, logger="backend.services.backup_manager"):
            await mgr._notify_event("test_event", {"key": "value"})

        assert any("handler exploded" in record.message for record in caplog.records), (
            "Expected logger.debug for event handler error, got none"
        )

    @pytest.mark.asyncio
    async def test_scheduler_loop_logs_and_continues(self, caplog):
        """_scheduler_loop must log errors from backup() and keep running.

        The loop structure is:
            try:
                ... await self.backup(...) ...
                await asyncio.sleep(60)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(...)
                await asyncio.sleep(60)

        So: backup error -> caught by Exception handler, logged, sleep, retry.
        On second call, raise CancelledError -> caught by CancelledError handler, break.
        """
        import asyncio

        from backend.services.backup_manager import BackupManager, BackupSchedule

        mgr = BackupManager.__new__(BackupManager)
        mgr._status = MagicMock()
        mgr._status.schedule = BackupSchedule(enabled=True)
        mgr._status.last_backup_at = None

        call_count = 0

        async def _flaky_backup(**kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("snapshot creation failed")
            raise asyncio.CancelledError("stop the loop")

        mgr.backup = _flaky_backup  # type: ignore[assignment]

        # Patch asyncio.sleep so we don't actually wait 60s
        with patch("asyncio.sleep", new_callable=AsyncMock):
            with caplog.at_level(logging.WARNING, logger="backend.services.backup_manager"):
                await mgr._scheduler_loop()

        # CancelledError is caught by the loop (break), so no exception propagates.
        # The RuntimeError from the first call must have been logged.
        assert any("snapshot creation failed" in r.message for r in caplog.records), (
            "Expected scheduler to log the backup error"
        )


class TestStrandClassifierLogging:
    """strand_classifier: AI classification failure must be logged."""

    @pytest.mark.asyncio
    async def test_ai_fallback_logs_warning(self, caplog):
        """When AI classify raises, classifier logs warning and falls back to heuristic."""
        from backend.services.strand_classifier import StrandClassifier

        ai_mock = AsyncMock()
        ai_mock.generate = AsyncMock(side_effect=RuntimeError("API timeout"))

        classifier = StrandClassifier(ai_service=ai_mock)

        with caplog.at_level(logging.WARNING, logger="backend.services.strand_classifier"):
            result = await classifier._classify_with_ai(
                chapter_id=42,
                content="这是一段测试内容，包含任务和目标等关键词。",
            )

        # Must have fallen back to heuristic
        assert result.method == "heuristic"
        assert result.chapter_id == 42

        # Must have logged the warning
        assert any("API timeout" in r.message for r in caplog.records), (
            "Expected logger.warning for AI classification failure"
        )


class TestTaskQueueLogging:
    """task_queue: worker fatal error must be logged."""

    @pytest.mark.asyncio
    async def test_worker_fatal_error_is_logged(self, caplog):
        """_worker_loop logs fatal error and breaks."""
        from backend.services.task_queue import TaskQueue

        import asyncio

        tq = TaskQueue.__new__(TaskQueue)
        tq._running = True
        tq._queue = asyncio.Queue()
        tq._tasks = {}
        tq._workers = []
        tq._lock = asyncio.Lock()
        tq.max_retries = 3

        # Patch _queue.get to raise a non-TimeoutError exception
        original_get = tq._queue.get

        async def _raising_get(timeout=None):
            raise RuntimeError("queue corruption")

        tq._queue.get = _raising_get  # type: ignore[assignment]

        with caplog.at_level(logging.ERROR, logger="backend.services.task_queue"):
            await tq._worker_loop("test-worker")

        assert any("queue corruption" in r.message for r in caplog.records), (
            "Expected logger.error for worker fatal error"
        )


class TestMainLifespanLogging:
    """main.py lifespan: startup handler failures must be logged."""

    @pytest.mark.asyncio
    async def test_lifespan_logs_startup_errors(self, caplog):
        """When a startup step fails, lifespan logs the error and continues."""
        from backend.interface.web.main import app

        # Force several startup steps to fail
        with (
            patch("backend.events.handlers.register_handlers", side_effect=RuntimeError("event bus broken")),
            patch("backend.services.ws_message_queue.WSMessageQueue") as ws_cls,
            patch("backend.utils.migrations.check_migrations_current", side_effect=ImportError("no migrations")),
            patch("backend.services.task_queue.task_queue") as tq_mock,
            patch("backend.services.preload_service.preload_service") as preload_mock,
            patch("backend.infrastructure.security.encryption.migrate_plaintext_keys", side_effect=RuntimeError("enc fail")),
            patch("backend.services.ai.ProviderRouter", side_effect=ImportError("no router")),
            patch("backend.agents.orchestrator.AgentOrchestrator", side_effect=ImportError("no orchestrator")),
            patch("backend.infrastructure.observability.metrics_service.metrics_service") as metrics_mock,
        ):
            # Make async mocks return normally
            ws_instance = AsyncMock()
            ws_cls.return_value = ws_instance
            tq_mock.start = AsyncMock()
            tq_mock.stop = AsyncMock()
            preload_mock.preload_all = AsyncMock(return_value={"total_items": 0, "categories": {}, "errors": []})
            metrics_mock.start = AsyncMock()
            metrics_mock.stop = AsyncMock()

            with caplog.at_level(logging.DEBUG, logger="writer-api"):
                async with app.router.lifespan_context(app):
                    pass

        # At least "event bus broken" must appear in logs
        assert any("event bus broken" in r.message for r in caplog.records), (
            "Expected lifespan to log event handler failure"
        )
        # "enc fail" must appear
        assert any("enc fail" in r.message for r in caplog.records), (
            "Expected lifespan to log encryption migration failure"
        )


class TestPreloadServiceLogging:
    """preload_service: _safe_preload must log errors."""

    @pytest.mark.asyncio
    async def test_safe_preload_logs_error(self, caplog):
        """When a preload routine raises, _safe_preload logs and records the error."""
        from backend.services.preload_service import PreloadService

        svc = PreloadService.__new__(PreloadService)
        svc._stats = {
            "started_at": None,
            "completed_at": None,
            "elapsed_ms": 0.0,
            "total_items": 0,
            "categories": {},
            "errors": [],
        }

        async def _failing_preload():
            raise RuntimeError("database locked")

        with caplog.at_level(logging.WARNING, logger="backend.services.preload_service"):
            await svc._safe_preload("test_category", _failing_preload)

        assert any("database locked" in r.message for r in caplog.records), (
            "Expected _safe_preload to log the error"
        )
        assert "database locked" in svc._stats["errors"][0]
        assert svc._stats["categories"]["test_category"]["error"] == "database locked"


class TestRAGServiceLogging:
    """rag_service: get_stats partial failure must be logged."""

    def test_get_stats_logs_partial_failure(self, caplog):
        """When a stats query fails, the error is logged."""
        from backend.services.rag_service import RAGService

        svc = RAGService.__new__(RAGService)
        svc.db_path = ":memory:"
        svc._conn = None
        svc._fts_conn = None

        # Create a mock connection whose cursor raises on execute
        mock_cursor = MagicMock()
        mock_cursor.execute.side_effect = RuntimeError("table missing")
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        svc._conn = mock_conn

        with caplog.at_level(logging.DEBUG, logger="backend.services.rag_service"):
            stats = svc.get_stats()

        # Should return default values, not crash
        assert stats.get("vectors", 0) == 0
        assert any("table missing" in r.message for r in caplog.records), (
            "Expected logger.debug for stats query failure"
        )


class TestEngineLogging:
    """engine.py: WAL mode failure must be logged (not swallowed silently)."""

    def test_wal_handler_logs_failure(self, caplog):
        """The _set_sqlite_wal handler logs a warning when WAL mode fails."""
        from backend.infrastructure.database.engine import _set_sqlite_wal

        # The handler does:
        #   raw = getattr(dbapi_connection, "driver_connection", dbapi_connection)
        #   sqlite_conn = getattr(raw, "_conn", raw)
        #   sqlite_conn.execute("PRAGMA journal_mode=WAL")
        # So we need side_effect on the final execute in the chain.
        mock_conn = MagicMock()
        mock_conn.driver_connection._conn.execute.side_effect = RuntimeError(
            "filesystem does not support WAL"
        )
        mock_record = MagicMock()

        with caplog.at_level(logging.WARNING, logger="backend.infrastructure.database.engine"):
            _set_sqlite_wal(mock_conn, mock_record)

        assert any("WAL" in r.message for r in caplog.records), (
            "Expected WAL mode failure to be logged"
        )


class TestCacheServiceInvalidation:
    """cache_service: invalidate_character_cache must work without bare except."""

    def test_invalidate_character_cache_no_crash(self, tmp_path):
        """invalidate_character_cache runs without raising."""
        from backend.infrastructure.cache.cache_service import (
            CacheService,
            invalidate_character_cache,
            _set_cache_service_instance,
        )

        # Create a fresh cache service with temp dir for isolation
        svc = CacheService(cache_dir=tmp_path)
        _set_cache_service_instance(svc)

        # Should not raise
        invalidate_character_cache(character_id=1)
        invalidate_character_cache()  # no id — clears list caches only
