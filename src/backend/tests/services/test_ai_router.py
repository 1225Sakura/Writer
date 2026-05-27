"""Tests for services.ai.router — ProviderRouter, _ProviderHealth, _ProviderMetrics."""

from __future__ import annotations

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.ai.router import (
    ProviderRouter,
    _ProviderHealth,
    _ProviderMetrics,
    _DEGRADED_COOLDOWN_SECONDS,
    _ERROR_RATE_THRESHOLD,
    _ERROR_WINDOW_SECONDS,
    _MIN_REQUESTS_FOR_THRESHOLD,
)
from backend.utils.exceptions import AIServiceError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_provider(name: str) -> MagicMock:
    """Create a mock AIProvider with the given name."""
    p = MagicMock()
    p.name = name
    p.generate = AsyncMock()
    # generate_stream must return an async iterator directly (not a coroutine),
    # so use MagicMock — the return_value will be set to an async generator.
    p.generate_stream = MagicMock()
    p.review = AsyncMock()
    p.extract_entities = AsyncMock()
    return p


# ===========================================================================
# _ProviderMetrics tests
# ===========================================================================

class TestProviderMetrics:
    def test_initial_state(self):
        m = _ProviderMetrics()
        assert m.total_calls == 0
        assert m.success_calls == 0
        assert m.failure_calls == 0
        assert m.total_latency_ms == 0.0
        assert m.avg_latency_ms == 0.0
        assert m.success_rate == 1.0

    def test_record_success(self):
        m = _ProviderMetrics()
        m.record_call(success=True, latency_ms=100.0)
        assert m.total_calls == 1
        assert m.success_calls == 1
        assert m.failure_calls == 0
        assert m.total_latency_ms == 100.0

    def test_record_failure(self):
        m = _ProviderMetrics()
        m.record_call(success=False, latency_ms=200.0)
        assert m.total_calls == 1
        assert m.success_calls == 0
        assert m.failure_calls == 1

    def test_success_rate_calculation(self):
        m = _ProviderMetrics()
        m.record_call(success=True, latency_ms=50.0)
        m.record_call(success=True, latency_ms=50.0)
        m.record_call(success=False, latency_ms=50.0)
        assert m.success_rate == pytest.approx(2 / 3)

    def test_avg_latency(self):
        m = _ProviderMetrics()
        m.record_call(success=True, latency_ms=100.0)
        m.record_call(success=True, latency_ms=200.0)
        assert m.avg_latency_ms == pytest.approx(150.0)

    def test_to_dict(self):
        m = _ProviderMetrics()
        m.record_call(success=True, latency_ms=100.0)
        d = m.to_dict()
        assert d["total_calls"] == 1
        assert d["success_calls"] == 1
        assert d["failure_calls"] == 0
        assert "success_rate" in d
        assert "avg_latency_ms" in d
        assert "recent_latency_ms" in d

    def test_prune_removes_old_entries(self):
        m = _ProviderMetrics()
        # Insert an entry with a timestamp far in the past
        m.latencies.append((time.time() - _ERROR_WINDOW_SECONDS - 10, 50.0))
        m.total_calls = 1
        m.record_call(success=True, latency_ms=100.0)
        # The old entry should have been pruned
        assert len(m.latencies) == 1


# ===========================================================================
# _ProviderHealth tests
# ===========================================================================

class TestProviderHealth:
    def test_initial_state(self):
        h = _ProviderHealth()
        assert h.error_rate == 0.0
        assert h.is_degraded is False
        assert h.degraded_until is None

    def test_record_success(self):
        h = _ProviderHealth()
        h.record(True)
        assert h.error_rate == 0.0

    def test_record_failure(self):
        h = _ProviderHealth()
        h.record(False)
        assert h.error_rate == 1.0

    def test_is_degraded_below_threshold(self):
        h = _ProviderHealth()
        # Not enough requests to trigger degradation
        for _ in range(_MIN_REQUESTS_FOR_THRESHOLD - 1):
            h.record(False)
        assert h.is_degraded is False

    def test_is_degraded_above_threshold(self):
        h = _ProviderHealth()
        for _ in range(_MIN_REQUESTS_FOR_THRESHOLD):
            h.record(False)
        assert h.is_degraded is True

    def test_is_degraded_mixed_results(self):
        h = _ProviderHealth()
        # 3 success, 2 failure -> 40% error rate < 50% threshold
        h.record(True)
        h.record(True)
        h.record(True)
        h.record(False)
        h.record(False)
        assert h.is_degraded is False

    def test_mark_degraded_sets_cooldown(self):
        h = _ProviderHealth()
        h.mark_degraded()
        assert h.degraded_until is not None
        assert h.degraded_until > time.time()
        assert h.is_degraded is True

    def test_degraded_cooldown_expires(self):
        h = _ProviderHealth()
        # Set degraded_until to the past
        h.degraded_until = time.time() - 1
        assert h.is_degraded is False
        assert h.degraded_until is None

    def test_prune_removes_old_results(self):
        h = _ProviderHealth()
        h._results.append((time.time() - _ERROR_WINDOW_SECONDS - 10, False))
        h.record(True)
        # Only the new record should remain
        assert len(h._results) == 1


# ===========================================================================
# ProviderRouter — construction
# ===========================================================================

class TestProviderRouterInit:
    def test_empty_providers_raises(self):
        with pytest.raises(ValueError, match="At least one provider"):
            ProviderRouter([])

    def test_single_provider(self):
        p = _make_provider("only")
        router = ProviderRouter([p])
        assert router._providers == [p]
        assert router._primary_index == 0

    def test_custom_primary_index(self):
        providers = [_make_provider("a"), _make_provider("b"), _make_provider("c")]
        router = ProviderRouter(providers, primary_index=2)
        assert router._primary_index == 2

    def test_health_and_metrics_initialized(self):
        providers = [_make_provider("x"), _make_provider("y")]
        router = ProviderRouter(providers)
        assert "x" in router._health
        assert "y" in router._health
        assert "x" in router._metrics
        assert "y" in router._metrics


# ===========================================================================
# ProviderRouter — generate
# ===========================================================================

class TestProviderRouterGenerate:
    @pytest.mark.asyncio
    async def test_generate_success_primary(self):
        p = _make_provider("primary")
        p.generate.return_value = "hello world"
        router = ProviderRouter([p])

        result = await router.generate("prompt", style="default", operation="continue")
        assert result == "hello world"
        p.generate.assert_awaited_once_with("prompt", "default", "continue")

    @pytest.mark.asyncio
    async def test_generate_failover_to_second(self):
        p1 = _make_provider("fail")
        p1.generate.side_effect = AIServiceError("boom")
        p2 = _make_provider("good")
        p2.generate.return_value = "recovered"
        router = ProviderRouter([p1, p2])

        result = await router.generate("prompt")
        assert result == "recovered"
        p2.generate.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_generate_all_fail_raises(self):
        p1 = _make_provider("a")
        p1.generate.side_effect = AIServiceError("err1")
        p2 = _make_provider("b")
        p2.generate.side_effect = AIServiceError("err2")
        router = ProviderRouter([p1, p2])

        with pytest.raises(AIServiceError):
            await router.generate("prompt")

    @pytest.mark.asyncio
    async def test_generate_records_health_on_success(self):
        p = _make_provider("ok")
        p.generate.return_value = "done"
        router = ProviderRouter([p])
        await router.generate("prompt")
        assert router._health["ok"].error_rate == 0.0
        assert router._metrics["ok"].success_calls == 1

    @pytest.mark.asyncio
    async def test_generate_records_health_on_failure(self):
        p1 = _make_provider("bad")
        p1.generate.side_effect = AIServiceError("fail")
        p2 = _make_provider("good")
        p2.generate.return_value = "ok"
        router = ProviderRouter([p1, p2])
        await router.generate("prompt")
        assert router._metrics["bad"].failure_calls == 1
        assert router._metrics["good"].success_calls == 1

    @pytest.mark.asyncio
    async def test_generate_passes_style_and_operation(self):
        p = _make_provider("p")
        p.generate.return_value = "result"
        router = ProviderRouter([p])
        await router.generate("prompt", style="kafka", operation="expand")
        p.generate.assert_awaited_once_with("prompt", "kafka", "expand")


# ===========================================================================
# ProviderRouter — generate_stream
# ===========================================================================

class TestProviderRouterGenerateStream:
    @staticmethod
    async def _async_iter(items):
        for item in items:
            yield item

    @pytest.mark.asyncio
    async def test_stream_success(self):
        p = _make_provider("s")
        p.generate_stream.return_value = self._async_iter(["chunk1", "chunk2"])
        router = ProviderRouter([p])

        chunks = []
        async for chunk in await router.generate_stream("prompt"):
            chunks.append(chunk)
        assert chunks == ["chunk1", "chunk2"]

    @pytest.mark.asyncio
    async def test_stream_failover(self):
        p1 = _make_provider("fail")
        p1.generate_stream.side_effect = AIServiceError("setup fail")
        p2 = _make_provider("ok")
        p2.generate_stream.return_value = self._async_iter(["recovered"])
        router = ProviderRouter([p1, p2])

        chunks = []
        async for chunk in await router.generate_stream("prompt"):
            chunks.append(chunk)
        assert chunks == ["recovered"]

    @pytest.mark.asyncio
    async def test_stream_all_fail_raises(self):
        p1 = _make_provider("a")
        p1.generate_stream.side_effect = AIServiceError("err1")
        p2 = _make_provider("b")
        p2.generate_stream.side_effect = AIServiceError("err2")
        router = ProviderRouter([p1, p2])

        with pytest.raises(AIServiceError):
            async for _ in await router.generate_stream("prompt"):
                pass

    @pytest.mark.asyncio
    async def test_stream_empty_iterator(self):
        p = _make_provider("empty")
        p.generate_stream.return_value = self._async_iter([])
        router = ProviderRouter([p])

        # Empty stream returns None (StopAsyncIteration path) — should not raise
        result = await router.generate_stream("prompt")
        # When StopAsyncIteration is caught, the method returns None (bare return)
        # so we just verify no exception was raised
        assert result is None
        assert router._metrics["empty"].success_calls == 1


# ===========================================================================
# ProviderRouter — review
# ===========================================================================

class TestProviderRouterReview:
    @pytest.mark.asyncio
    async def test_review_success(self):
        p = _make_provider("r")
        p.review.return_value = {"score": 9}
        router = ProviderRouter([p])

        result = await router.review({"content": "test"})
        assert result == {"score": 9}

    @pytest.mark.asyncio
    async def test_review_failover(self):
        p1 = _make_provider("bad")
        p1.review.side_effect = AIServiceError("review fail")
        p2 = _make_provider("good")
        p2.review.return_value = {"ok": True}
        router = ProviderRouter([p1, p2])

        result = await router.review({"content": "test"}, settings={"strict": True})
        assert result == {"ok": True}

    @pytest.mark.asyncio
    async def test_review_all_fail_raises(self):
        p = _make_provider("f")
        p.review.side_effect = AIServiceError("boom")
        router = ProviderRouter([p])

        with pytest.raises(AIServiceError):
            await router.review({})


# ===========================================================================
# ProviderRouter — extract_entities
# ===========================================================================

class TestProviderRouterExtractEntities:
    @pytest.mark.asyncio
    async def test_extract_entities_success(self):
        p = _make_provider("e")
        p.extract_entities.return_value = [{"name": "Alice", "type": "character"}]
        router = ProviderRouter([p])

        result = await router.extract_entities("some text")
        assert result == [{"name": "Alice", "type": "character"}]

    @pytest.mark.asyncio
    async def test_extract_entities_failover(self):
        p1 = _make_provider("bad")
        p1.extract_entities.side_effect = AIServiceError("fail")
        p2 = _make_provider("good")
        p2.extract_entities.return_value = [{"name": "Bob"}]
        router = ProviderRouter([p1, p2])

        result = await router.extract_entities("text")
        assert result == [{"name": "Bob"}]

    @pytest.mark.asyncio
    async def test_extract_entities_list_input(self):
        p = _make_provider("e")
        p.extract_entities.return_value = []
        router = ProviderRouter([p])

        result = await router.extract_entities(["msg1", "msg2"])
        p.extract_entities.assert_awaited_once_with(["msg1", "msg2"])


# ===========================================================================
# ProviderRouter — get_recommended_provider
# ===========================================================================

class TestProviderRouterRecommended:
    def test_returns_primary_by_default(self):
        p1 = _make_provider("primary")
        p2 = _make_provider("secondary")
        router = ProviderRouter([p1, p2], primary_index=0)

        assert router.get_recommended_provider().name == "primary"

    def test_skips_degraded_primary(self):
        p1 = _make_provider("degraded")
        p2 = _make_provider("healthy")
        router = ProviderRouter([p1, p2], primary_index=0)
        # Mark primary as degraded
        router._health["degraded"].mark_degraded()

        rec = router.get_recommended_provider()
        assert rec.name == "healthy"


# ===========================================================================
# ProviderRouter — force_failover
# ===========================================================================

class TestProviderRouterForceFailover:
    def test_failover_to_named_provider(self):
        providers = [_make_provider("a"), _make_provider("b"), _make_provider("c")]
        router = ProviderRouter(providers, primary_index=0)

        result = router.force_failover("c")
        assert result == "c"
        assert router._primary_index == 2

    def test_failover_to_unknown_name_raises(self):
        router = ProviderRouter([_make_provider("a")])
        with pytest.raises(ValueError, match="not found"):
            router.force_failover("nonexistent")

    def test_failover_cycle_to_next_healthy(self):
        p1 = _make_provider("a")
        p2 = _make_provider("b")
        p3 = _make_provider("c")
        router = ProviderRouter([p1, p2, p3], primary_index=0)
        router._health["b"].mark_degraded()

        result = router.force_failover()
        # Should skip degraded "b" and go to "c"
        assert result == "c"
        assert router._primary_index == 2

    def test_failover_all_degraded_cycles_anyway(self):
        p1 = _make_provider("a")
        p2 = _make_provider("b")
        router = ProviderRouter([p1, p2], primary_index=0)
        router._health["a"].mark_degraded()
        router._health["b"].mark_degraded()

        result = router.force_failover()
        assert result == "b"
        assert router._primary_index == 1


# ===========================================================================
# ProviderRouter — get_metrics / health_status
# ===========================================================================

class TestProviderRouterMetrics:
    def test_get_metrics_empty(self):
        router = ProviderRouter([_make_provider("p")])
        m = router.get_metrics()
        assert "p" in m
        assert m["p"]["total_calls"] == 0

    @pytest.mark.asyncio
    async def test_get_metrics_after_calls(self):
        p = _make_provider("p")
        p.generate.return_value = "ok"
        router = ProviderRouter([p])

        await router.generate("hi")
        m = router.get_metrics()
        assert m["p"]["total_calls"] == 1

    def test_health_status(self):
        router = ProviderRouter([_make_provider("p")])
        hs = router.health_status()
        assert "p" in hs
        assert hs["p"]["error_rate"] == 0.0
        assert hs["p"]["is_degraded"] is False
        assert hs["p"]["recent_requests"] == 0


# ===========================================================================
# ProviderRouter — replace_providers / reset_health
# ===========================================================================

class TestProviderRouterMutation:
    def test_replace_providers(self):
        router = ProviderRouter([_make_provider("old")])
        new_p = _make_provider("new")
        router.replace_providers([new_p], primary_index=0)
        assert len(router._providers) == 1
        assert router._providers[0].name == "new"
        assert "new" in router._health
        assert "new" in router._metrics

    def test_replace_providers_empty_raises(self):
        router = ProviderRouter([_make_provider("p")])
        with pytest.raises(ValueError, match="At least one provider"):
            router.replace_providers([])

    def test_reset_health_all(self):
        p = _make_provider("p")
        router = ProviderRouter([p])
        router._health["p"].record(False)
        router._metrics["p"].record_call(False, 100.0)

        router.reset_health()
        assert router._health["p"].error_rate == 0.0
        assert router._metrics["p"].total_calls == 0

    def test_reset_health_single(self):
        p1 = _make_provider("a")
        p2 = _make_provider("b")
        router = ProviderRouter([p1, p2])
        router._health["a"].record(False)
        router._health["b"].record(False)

        router.reset_health("a")
        assert router._health["a"].error_rate == 0.0
        assert router._health["b"].error_rate == 1.0

    def test_reset_health_unknown_name_noop(self):
        router = ProviderRouter([_make_provider("p")])
        # Should not raise
        router.reset_health("nonexistent")


# ===========================================================================
# ProviderRouter — _ordered_providers
# ===========================================================================

class TestProviderRouterOrdering:
    def test_healthy_before_degraded(self):
        p1 = _make_provider("a")
        p2 = _make_provider("b")
        router = ProviderRouter([p1, p2], primary_index=0)
        router._health["a"].mark_degraded()

        ordered = router._ordered_providers()
        names = [p.name for p in ordered]
        # "b" should come before "a" since "a" is degraded
        assert names.index("b") < names.index("a")

    def test_primary_first_among_healthy(self):
        p1 = _make_provider("a")
        p2 = _make_provider("b")
        p3 = _make_provider("c")
        router = ProviderRouter([p1, p2, p3], primary_index=1)

        ordered = router._ordered_providers()
        # Primary "b" should be first among healthy
        assert ordered[0].name == "b"
