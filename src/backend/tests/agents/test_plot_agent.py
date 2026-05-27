"""Tests for PlotAgent — plot design and rhythm analysis agent.

Covers:
- Happy path: foreshadowing, climax, rhythm, full analysis
- Error handling: AI failures per analysis, JSON parse errors
- Execute dispatch: task type routing
- Validation: foreshadowing result, climax result, rhythm result, intensity clamping
"""

from __future__ import annotations

import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from backend.agents.base import AgentContext, AgentResult
from backend.agents.plot_agent import PlotAgent
from backend.utils.exceptions import AIServiceError, AIServiceTimeoutError, AIServiceRateLimitError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_plot_agent() -> PlotAgent:
    provider = MagicMock()
    provider.generate = AsyncMock(return_value='{"new_hooks": [], "resolvable_hooks": [], "dangling_threads": [], "overall_assessment": "ok"}')
    provider.name = "mock_provider"
    event_bus = AsyncMock()
    event_bus.publish = AsyncMock()
    return PlotAgent(provider=provider, event_bus=event_bus)


def _make_plot_context(task="full", **extra_settings) -> AgentContext:
    settings = {
        "content": "这是一段测试内容。",
        "outline": {"title": "大纲", "chapters": []},
        "chapters": [{"title": "第一章", "summary": "开始"}],
        "active_threads": [{"title": "伏笔1", "status": "active"}],
        "progress": 0.3,
    }
    settings.update(extra_settings)
    return AgentContext(task=task, settings=settings)


def _foreshadowing_response():
    return json.dumps({
        "new_hooks": [{"description": "新伏笔", "placement": "中间", "importance": "high"}],
        "resolvable_hooks": [{"description": "可回收", "origin": "第一章", "urgency": "medium"}],
        "dangling_threads": [],
        "overall_assessment": "良好",
    })


def _climax_response():
    return json.dumps({
        "climax_points": [{"name": "大战", "estimated_position": "60%", "type": "battle", "intensity": 8}],
        "current_phase": {"name": "铺垫", "description": "积累冲突", "recommended_pacing": "渐进", "next_milestone": "对抗"},
        "pacing_recommendations": ["加快节奏"],
        "risk_warnings": [{"risk": "过早高潮", "mitigation": "延后"}],
    })


def _rhythm_response():
    return json.dumps({
        "tension_curve": [{"chapter": "第一章", "tension_score": 6, "emotional_tone": "紧张", "pacing": "中速"}],
        "analysis": {"overall_rhythm": "良好", "peak_distribution": "均匀", "valley_distribution": "合理", "transition_quality": "流畅"},
        "issues": [],
        "recommendations": ["保持节奏"],
    })


# ===========================================================================
# Execute Dispatch Tests
# ===========================================================================

class TestPlotAgentExecute:
    """Test execute dispatches based on task type."""

    @pytest.mark.asyncio
    async def test_execute_foreshadowing(self):
        agent = _make_plot_agent()
        agent._provider.generate = AsyncMock(return_value=_foreshadowing_response())
        context = _make_plot_context(task="foreshadowing")
        result = await agent.execute(context)
        assert "foreshadowing" in result.content
        assert result.metadata["analyses_run"] == 1

    @pytest.mark.asyncio
    async def test_execute_climax(self):
        agent = _make_plot_agent()
        agent._provider.generate = AsyncMock(return_value=_climax_response())
        context = _make_plot_context(task="climax")
        result = await agent.execute(context)
        assert "climax" in result.content

    @pytest.mark.asyncio
    async def test_execute_rhythm(self):
        agent = _make_plot_agent()
        agent._provider.generate = AsyncMock(return_value=_rhythm_response())
        context = _make_plot_context(task="rhythm")
        result = await agent.execute(context)
        assert "rhythm" in result.content

    @pytest.mark.asyncio
    async def test_execute_full_all_analyses(self):
        agent = _make_plot_agent()
        call_count = 0

        async def mock_generate(prompt, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return _foreshadowing_response()
            elif call_count == 2:
                return _climax_response()
            else:
                return _rhythm_response()

        agent._provider.generate = AsyncMock(side_effect=mock_generate)
        context = _make_plot_context(task="full")
        result = await agent.execute(context)
        assert "foreshadowing" in result.content
        assert "climax" in result.content
        assert "rhythm" in result.content
        assert result.metadata["analyses_run"] == 3

    @pytest.mark.asyncio
    async def test_execute_no_content_adds_warning(self):
        agent = _make_plot_agent()
        agent._provider.generate = AsyncMock(return_value=_foreshadowing_response())
        context = AgentContext(task="foreshadowing", settings={})
        result = await agent.execute(context)
        assert any("No chapter content" in w for w in result.warnings)


# ===========================================================================
# Error Handling Tests
# ===========================================================================

class TestPlotAgentErrors:
    """Test error handling per analysis."""

    @pytest.mark.asyncio
    async def test_foreshadowing_ai_failure_recorded(self):
        agent = _make_plot_agent()
        agent._provider.generate = AsyncMock(side_effect=AIServiceError(message="fail"))
        context = _make_plot_context(task="foreshadowing")
        result = await agent.execute(context)
        assert "error" in result.content["foreshadowing"]
        assert result.metadata["analyses_failed"] == 1

    @pytest.mark.asyncio
    async def test_climax_timeout_recorded(self):
        agent = _make_plot_agent()
        agent._provider.generate = AsyncMock(side_effect=AIServiceTimeoutError(timeout_seconds=30.0))
        context = _make_plot_context(task="climax")
        result = await agent.execute(context)
        assert "error" in result.content["climax"]

    @pytest.mark.asyncio
    async def test_rhythm_rate_limit_recorded(self):
        agent = _make_plot_agent()
        agent._provider.generate = AsyncMock(side_effect=AIServiceRateLimitError(retry_after=60))
        context = _make_plot_context(task="rhythm")
        result = await agent.execute(context)
        assert "error" in result.content["rhythm"]

    @pytest.mark.asyncio
    async def test_all_analyses_fail_zero_confidence(self):
        agent = _make_plot_agent()
        agent._provider.generate = AsyncMock(side_effect=AIServiceError(message="fail"))
        context = _make_plot_context(task="full")
        result = await agent.execute(context)
        assert result.confidence == 0.0
        assert any("All analyses failed" in w for w in result.warnings)

    @pytest.mark.asyncio
    async def test_json_parse_error_returns_parse_error(self):
        agent = _make_plot_agent()
        agent._provider.generate = AsyncMock(return_value="not json at all")
        context = _make_plot_context(task="foreshadowing")
        result = await agent.execute(context)
        # Should still return a result with parse_error
        assert "foreshadowing" in result.content


# ===========================================================================
# Confidence Calculation Tests
# ===========================================================================

class TestPlotAgentConfidence:
    """Test confidence calculation logic."""

    @pytest.mark.asyncio
    async def test_confidence_with_rich_context(self):
        agent = _make_plot_agent()
        agent._provider.generate = AsyncMock(return_value=_foreshadowing_response())
        context = _make_plot_context(task="foreshadowing")
        result = await agent.execute(context)
        assert result.confidence > 0.5

    @pytest.mark.asyncio
    async def test_confidence_without_outline(self):
        agent = _make_plot_agent()
        agent._provider.generate = AsyncMock(return_value=_foreshadowing_response())
        context = _make_plot_context(task="foreshadowing", outline={}, chapters=[])
        result = await agent.execute(context)
        assert result.confidence > 0


# ===========================================================================
# Validation Helper Tests
# ===========================================================================

class TestPlotAgentValidation:
    """Test validation helper methods."""

    def test_validate_foreshadowing_result_valid(self):
        agent = _make_plot_agent()
        data = {
            "new_hooks": [{"description": "hook1", "placement": "start"}],
            "resolvable_hooks": [{"description": "resolve1", "origin": "ch1"}],
            "dangling_threads": [],
            "overall_assessment": "good",
        }
        result = agent._validate_foreshadowing_result(data)
        assert len(result["new_hooks"]) == 1
        assert result["overall_assessment"] == "good"

    def test_validate_foreshadowing_result_non_dict_raises(self):
        agent = _make_plot_agent()
        with pytest.raises(ValueError):
            agent._validate_foreshadowing_result("not a dict")

    def test_validate_climax_result_valid(self):
        agent = _make_plot_agent()
        data = {
            "climax_points": [{"name": "battle", "intensity": 8}],
            "current_phase": {"name": "buildup"},
            "pacing_recommendations": ["speed up"],
            "risk_warnings": [{"risk": "too early"}],
        }
        result = agent._validate_climax_result(data)
        assert len(result["climax_points"]) == 1
        assert result["climax_points"][0]["intensity"] == 8

    def test_validate_rhythm_result_valid(self):
        agent = _make_plot_agent()
        data = {
            "tension_curve": [{"chapter": "ch1", "tension_score": 7}],
            "analysis": {"overall_rhythm": "good"},
            "issues": [{"location": "ch2", "type": "pacing", "severity": "medium"}],
            "recommendations": ["slow down"],
        }
        result = agent._validate_rhythm_result(data)
        assert len(result["tension_curve"]) == 1
        assert len(result["issues"]) == 1

    def test_clamp_intensity_valid(self):
        agent = _make_plot_agent()
        assert agent._clamp_intensity(5) == 5
        assert agent._clamp_intensity(0) == 1
        assert agent._clamp_intensity(15) == 10
        assert agent._clamp_intensity(-5) == 1

    def test_clamp_intensity_non_numeric(self):
        agent = _make_plot_agent()
        assert agent._clamp_intensity("abc") == 5

    def test_validate_hook_list_filters_invalid(self):
        agent = _make_plot_agent()
        hooks = [
            {"description": "valid hook"},
            "not a dict",
            {"no_description": True},
        ]
        result = agent._validate_hook_list(hooks)
        assert len(result) == 1

    def test_extract_json_from_markdown_block(self):
        agent = _make_plot_agent()
        content = '```json\n{"key": "value"}\n```'
        result = agent._extract_json(content)
        assert result == {"key": "value"}

    def test_extract_json_raw(self):
        agent = _make_plot_agent()
        result = agent._extract_json('{"key": "value"}')
        assert result == {"key": "value"}

    def test_extract_json_invalid_raises(self):
        agent = _make_plot_agent()
        with pytest.raises(json.JSONDecodeError):
            agent._extract_json("not json")
