"""Tests for MetricsService - ring buffers, recording, aggregation, persistence."""

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.infrastructure.observability.metrics_service import (
    MetricsService,
    RequestRecord,
    AICallRecord,
    DBQueryRecord,
    TimeSeriesPoint,
)


@pytest.fixture
def service():
    """Create a fresh MetricsService with small buffers for testing."""
    return MetricsService(
        request_buffer_size=100,
        ai_call_buffer_size=50,
        db_query_buffer_size=100,
        history_minutes=5,
    )


# =============================================================================
# Initialization
# =============================================================================


class TestInit:
    """Test service initialization and defaults."""

    def test_default_buffer_sizes(self):
        svc = MetricsService()
        assert svc._request_buffer_size == 10_000
        assert svc._ai_call_buffer_size == 5_000
        assert svc._db_query_buffer_size == 10_000
        assert svc._history_minutes == 5

    def test_custom_buffer_sizes(self, service):
        assert service._request_buffer_size == 100
        assert service._ai_call_buffer_size == 50
        assert service._db_query_buffer_size == 100

    def test_initial_state_empty(self, service):
        assert len(service._requests) == 0
        assert len(service._ai_calls) == 0
        assert len(service._db_queries) == 0
        assert len(service._history) == 0
        assert service._active_ws_connections == 0
        assert service._flush_task is None

    def test_lock_is_asyncio_lock(self, service):
        assert isinstance(service._lock, asyncio.Lock)


# =============================================================================
# Recording methods
# =============================================================================


class TestRecordRequest:
    """Test request recording."""

    @pytest.mark.asyncio
    async def test_record_request_appends(self, service):
        await service.record_request(
            method="GET", path="/api/test", duration_ms=42.5, status_code=200
        )
        assert len(service._requests) == 1
        assert service._requests[0].method == "GET"
        assert service._requests[0].path == "/api/test"
        assert service._requests[0].duration_ms == 42.5
        assert service._requests[0].status_code == 200

    @pytest.mark.asyncio
    async def test_record_request_tracks_current_minute(self, service):
        await service.record_request(method="POST", path="/api/chat", duration_ms=100.0)
        assert 100.0 in service._current_minute_requests

    @pytest.mark.asyncio
    async def test_record_request_with_query_counts(self, service):
        await service.record_request(
            method="GET", path="/api/chapters", duration_ms=50.0,
            query_count=3, slow_query_count=1
        )
        assert service._requests[0].query_count == 3
        assert service._requests[0].slow_query_count == 1

    @pytest.mark.asyncio
    async def test_record_request_ring_buffer_overflow(self, service):
        for i in range(150):
            await service.record_request(method="GET", path=f"/{i}", duration_ms=float(i))
        assert len(service._requests) == 100  # maxlen=100
        assert service._requests[0].path == "/50"  # oldest kept


class TestRecordAICall:
    """Test AI call recording."""

    @pytest.mark.asyncio
    async def test_record_ai_call_success(self, service):
        await service.record_ai_call(
            provider="minimax", success=True, duration_ms=500.0
        )
        assert len(service._ai_calls) == 1
        assert service._ai_calls[0].provider == "minimax"
        assert service._ai_calls[0].success is True

    @pytest.mark.asyncio
    async def test_record_ai_call_failure(self, service):
        await service.record_ai_call(
            provider="minimax", success=False, duration_ms=200.0, error_type="timeout"
        )
        assert service._ai_calls[0].success is False
        assert service._ai_calls[0].error_type == "timeout"

    @pytest.mark.asyncio
    async def test_record_ai_call_tracks_current_minute(self, service):
        await service.record_ai_call(provider="openai", success=True, duration_ms=300.0)
        assert (True, 300.0) in service._current_minute_ai_calls


class TestRecordDBQuery:
    """Test database query recording."""

    @pytest.mark.asyncio
    async def test_record_db_query(self, service):
        await service.record_db_query(query="SELECT * FROM chapters", duration_ms=5.0)
        assert len(service._db_queries) == 1
        assert service._db_queries[0].query == "SELECT * FROM chapters"

    @pytest.mark.asyncio
    async def test_record_db_query_slow(self, service):
        await service.record_db_query(
            query="SELECT * FROM chapters", duration_ms=200.0, is_slow=True
        )
        assert service._db_queries[0].is_slow is True

    @pytest.mark.asyncio
    async def test_record_db_query_tracks_current_minute(self, service):
        await service.record_db_query(query="SELECT 1", duration_ms=2.0, is_slow=False)
        assert (2.0, False) in service._current_minute_db_queries


class TestSetWebSocketConnections:
    """Test WebSocket connection count updates."""

    @pytest.mark.asyncio
    async def test_set_positive_count(self, service):
        await service.set_active_websocket_connections(5)
        assert service._active_ws_connections == 5

    @pytest.mark.asyncio
    async def test_set_negative_clamped_to_zero(self, service):
        await service.set_active_websocket_connections(-3)
        assert service._active_ws_connections == 0

    @pytest.mark.asyncio
    async def test_set_zero(self, service):
        await service.set_active_websocket_connections(10)
        await service.set_active_websocket_connections(0)
        assert service._active_ws_connections == 0


# =============================================================================
# Aggregation / Summary
# =============================================================================


class TestGetSummary:
    """Test metrics summary aggregation."""

    @pytest.mark.asyncio
    async def test_summary_empty(self, service):
        result = await service.get_summary(window_seconds=60.0)
        assert result["window_seconds"] == 60.0
        assert result["requests"]["total"] == 0
        assert result["ai_calls"]["total"] == 0
        assert result["db_queries"]["total"] == 0
        assert result["websockets"]["active_connections"] == 0

    @pytest.mark.asyncio
    async def test_summary_with_requests(self, service):
        await service.record_request(method="GET", path="/api/test", duration_ms=50.0)
        await service.record_request(method="POST", path="/api/test", duration_ms=100.0)
        result = await service.get_summary(window_seconds=60.0)
        assert result["requests"]["total"] == 2
        assert result["requests"]["min_ms"] == 50.0
        assert result["requests"]["max_ms"] == 100.0
        assert result["requests"]["avg_ms"] == 75.0

    @pytest.mark.asyncio
    async def test_summary_with_ai_calls(self, service):
        await service.record_ai_call(provider="minimax", success=True, duration_ms=400.0)
        await service.record_ai_call(provider="minimax", success=False, duration_ms=200.0, error_type="rate_limit")
        result = await service.get_summary(window_seconds=60.0)
        assert result["ai_calls"]["total"] == 2
        assert result["ai_calls"]["success"] == 1
        assert result["ai_calls"]["failed"] == 1
        assert result["ai_calls"]["success_rate"] == 0.5

    @pytest.mark.asyncio
    async def test_summary_with_db_queries(self, service):
        await service.record_db_query(query="SELECT 1", duration_ms=5.0, is_slow=False)
        await service.record_db_query(query="SELECT 2", duration_ms=200.0, is_slow=True)
        result = await service.get_summary(window_seconds=60.0)
        assert result["db_queries"]["total"] == 2
        assert result["db_queries"]["slow_queries"] == 1
        assert result["db_queries"]["slow_query_rate"] == 0.5

    @pytest.mark.asyncio
    async def test_summary_status_codes(self, service):
        await service.record_request(method="GET", path="/a", duration_ms=10.0, status_code=200)
        await service.record_request(method="GET", path="/b", duration_ms=10.0, status_code=200)
        await service.record_request(method="GET", path="/c", duration_ms=10.0, status_code=404)
        result = await service.get_summary(window_seconds=60.0)
        assert result["requests"]["status_codes"][200] == 2
        assert result["requests"]["status_codes"][404] == 1

    @pytest.mark.asyncio
    async def test_summary_window_filters_old_records(self, service):
        # Record with old timestamp
        old_record = RequestRecord(
            timestamp=time.time() - 120, method="GET", path="/old",
            duration_ms=50.0, query_count=0, slow_query_count=0, status_code=200
        )
        service._requests.append(old_record)
        await service.record_request(method="GET", path="/new", duration_ms=30.0)
        result = await service.get_summary(window_seconds=60.0)
        assert result["requests"]["total"] == 1  # only the new one

    @pytest.mark.asyncio
    async def test_summary_websocket_count(self, service):
        await service.set_active_websocket_connections(7)
        result = await service.get_summary(window_seconds=60.0)
        assert result["websockets"]["active_connections"] == 7


# =============================================================================
# History
# =============================================================================


class TestGetHistory:
    """Test time-series history retrieval."""

    @pytest.mark.asyncio
    async def test_history_empty(self, service):
        result = await service.get_history(minutes=5)
        assert result == []

    @pytest.mark.asyncio
    async def test_history_returns_points(self, service):
        service._history.append(TimeSeriesPoint(
            timestamp=time.time(), requests_per_minute=10.0, avg_latency_ms=50.0
        ))
        result = await service.get_history(minutes=5)
        assert len(result) == 1
        assert result[0]["requests_per_minute"] == 10.0
        assert "datetime" in result[0]

    @pytest.mark.asyncio
    async def test_history_filters_old_points(self, service):
        service._history.append(TimeSeriesPoint(
            timestamp=time.time() - 600, requests_per_minute=5.0
        ))
        service._history.append(TimeSeriesPoint(
            timestamp=time.time(), requests_per_minute=10.0
        ))
        result = await service.get_history(minutes=5)
        assert len(result) == 1
        assert result[0]["requests_per_minute"] == 10.0

    @pytest.mark.asyncio
    async def test_history_uses_default_minutes(self, service):
        service._history.append(TimeSeriesPoint(
            timestamp=time.time(), requests_per_minute=1.0
        ))
        result = await service.get_history()
        assert len(result) == 1


# =============================================================================
# Flush history
# =============================================================================


class TestFlushHistory:
    """Test _flush_history aggregation."""

    @pytest.mark.asyncio
    async def test_flush_creates_time_series_point(self, service):
        await service.record_request(method="GET", path="/a", duration_ms=100.0)
        await service.record_request(method="GET", path="/b", duration_ms=200.0)
        await service.record_ai_call(provider="minimax", success=True, duration_ms=500.0)
        await service.record_db_query(query="SELECT 1", duration_ms=5.0, is_slow=False)

        await service._flush_history()
        assert len(service._history) == 1
        point = service._history[0]
        assert point.requests_per_minute == 2.0
        assert point.avg_latency_ms == 150.0
        assert point.ai_calls_per_minute == 1.0
        assert point.ai_success_rate == 1.0
        assert point.db_queries_per_minute == 1.0
        assert point.slow_query_rate == 0.0

    @pytest.mark.asyncio
    async def test_flush_clears_current_minute_buffers(self, service):
        await service.record_request(method="GET", path="/a", duration_ms=50.0)
        await service.record_ai_call(provider="x", success=True, duration_ms=100.0)
        await service.record_db_query(query="SELECT 1", duration_ms=5.0)

        await service._flush_history()
        assert len(service._current_minute_requests) == 0
        assert len(service._current_minute_ai_calls) == 0
        assert len(service._current_minute_db_queries) == 0

    @pytest.mark.asyncio
    async def test_flush_empty_buffers_creates_zero_point(self, service):
        await service._flush_history()
        assert len(service._history) == 1
        point = service._history[0]
        assert point.requests_per_minute == 0.0
        assert point.avg_latency_ms == 0.0


# =============================================================================
# Start / Stop lifecycle
# =============================================================================


class TestStartStop:
    """Test background task lifecycle."""

    @pytest.mark.asyncio
    async def test_start_creates_task(self, service):
        await service.start()
        assert service._flush_task is not None
        assert not service._flush_task.done()
        await service.stop()

    @pytest.mark.asyncio
    async def test_start_idempotent(self, service):
        await service.start()
        task1 = service._flush_task
        await service.start()
        task2 = service._flush_task
        assert task1 is task2
        await service.stop()

    @pytest.mark.asyncio
    async def test_stop_cancels_task(self, service):
        await service.start()
        await service.stop()
        assert service._flush_task is None

    @pytest.mark.asyncio
    async def test_stop_flushes_history(self, service):
        await service.record_request(method="GET", path="/a", duration_ms=50.0)
        await service.start()
        await service.stop()
        assert len(service._history) >= 1


# =============================================================================
# Percentile helper
# =============================================================================


class TestPercentile:
    """Test the static _percentile helper."""

    def test_empty_list(self):
        assert MetricsService._percentile([], 0.5) == 0.0

    def test_single_element(self):
        assert MetricsService._percentile([10.0], 0.5) == 10.0

    def test_p50_even_count(self):
        values = [1.0, 2.0, 3.0, 4.0]
        result = MetricsService._percentile(values, 0.5)
        assert 2.0 <= result <= 3.0

    def test_p95(self):
        values = list(range(1, 101))
        result = MetricsService._percentile(values, 0.95)
        assert result >= 95

    def test_p99_at_max(self):
        values = [1.0, 2.0, 3.0]
        result = MetricsService._percentile(values, 0.99)
        assert result >= 2.9  # close to max


# =============================================================================
# Latency summary helper
# =============================================================================


class TestComputeLatencySummary:
    """Test the static _compute_latency_summary helper."""

    def test_empty_latencies(self):
        result = MetricsService._compute_latency_summary([])
        assert result["p50_ms"] == 0.0
        assert result["p95_ms"] == 0.0
        assert result["avg_ms"] == 0.0

    def test_single_latency(self):
        result = MetricsService._compute_latency_summary([100.0])
        assert result["min_ms"] == 100.0
        assert result["max_ms"] == 100.0
        assert result["avg_ms"] == 100.0

    def test_multiple_latencies(self):
        result = MetricsService._compute_latency_summary([10.0, 20.0, 30.0, 40.0, 50.0])
        assert result["min_ms"] == 10.0
        assert result["max_ms"] == 50.0
        assert result["avg_ms"] == 30.0
        assert result["p50_ms"] > 0
        assert result["p95_ms"] > 0


# =============================================================================
# Persistence
# =============================================================================


class TestPersistence:
    """Test SQLite persistence methods."""

    @pytest.mark.asyncio
    async def test_init_persistence_creates_tables(self, service):
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()

        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch.object(service, '_load_history', new_callable=AsyncMock):
            await service.init_persistence(mock_factory)

        assert service._db_factory is mock_factory
        assert mock_session.execute.call_count >= 2  # CREATE TABLE x2

    @pytest.mark.asyncio
    async def test_get_historical_metrics_no_factory(self, service):
        result = await service.get_historical_metrics(hours=24)
        assert result == []

    @pytest.mark.asyncio
    async def test_get_historical_metrics_with_data(self, service):
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            (1000.0, "request_latency", 10, 500.0, 10.0, 100.0),
            (1000.0, "ai_call_duration", 5, 2500.0, 200.0, 800.0),
        ]
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)
        service._db_factory = mock_factory

        result = await service.get_historical_metrics(hours=24)
        assert len(result) == 1
        assert result[0]["timestamp"] == 1000.0
        assert "request_latency_count" in result[0]
        assert "ai_call_duration_count" in result[0]

    @pytest.mark.asyncio
    async def test_flush_to_db_no_factory(self, service):
        # Should not raise
        await service._flush_to_db()

    @pytest.mark.asyncio
    async def test_flush_to_db_no_samples(self, service):
        mock_session = AsyncMock()
        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)
        service._db_factory = mock_factory

        await service._flush_to_db()
        mock_session.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_aggregate_5min_no_factory(self, service):
        # Should not raise
        await service._aggregate_5min()

    @pytest.mark.asyncio
    async def test_load_history_no_factory(self, service):
        # Should not raise
        await service._load_history()


# =============================================================================
# Dataclass construction
# =============================================================================


class TestDataclasses:
    """Test dataclass record construction."""

    def test_request_record(self):
        r = RequestRecord(
            timestamp=1.0, method="GET", path="/test", duration_ms=10.0,
            query_count=1, slow_query_count=0, status_code=200
        )
        assert r.method == "GET"
        assert r.status_code == 200

    def test_ai_call_record(self):
        c = AICallRecord(
            timestamp=1.0, provider="minimax", success=True, duration_ms=500.0
        )
        assert c.provider == "minimax"
        assert c.error_type is None

    def test_ai_call_record_with_error(self):
        c = AICallRecord(
            timestamp=1.0, provider="openai", success=False,
            duration_ms=100.0, error_type="rate_limit"
        )
        assert c.error_type == "rate_limit"

    def test_db_query_record(self):
        q = DBQueryRecord(timestamp=1.0, query="SELECT 1", duration_ms=5.0)
        assert q.is_slow is False

    def test_time_series_point_defaults(self):
        p = TimeSeriesPoint(timestamp=1.0)
        assert p.requests_per_minute == 0.0
        assert p.avg_latency_ms == 0.0
        assert p.active_websocket_connections == 0
