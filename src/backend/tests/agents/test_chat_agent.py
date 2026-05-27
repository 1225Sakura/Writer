"""Tests for ChatAgent — chat-based setting collection agent.

Covers:
- Happy path: execute, extract settings, fallback questions
- Error handling: AI failures, JSON parse errors
- Lifecycle hooks: pre_execute injects progress, post_execute annotates metadata
- Category determination and prompt building
"""

from __future__ import annotations

import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from backend.agents.base import AgentContext, AgentResult
from backend.agents.chat_agent import ChatAgent, SETTING_CATEGORIES, QUESTION_TEMPLATES
from backend.utils.exceptions import AIServiceError, AIServiceTimeoutError, AIServiceRateLimitError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_chat_agent() -> ChatAgent:
    """Create a ChatAgent with mocked provider and event_bus."""
    provider = MagicMock()
    provider.generate = AsyncMock(
        return_value='{"next_question": "test?", "extracted_settings": {}, "completed_categories": []}'
    )
    provider.name = "mock_provider"
    event_bus = AsyncMock()
    event_bus.publish = AsyncMock()
    return ChatAgent(provider=provider, event_bus=event_bus)


def _make_context(**overrides) -> AgentContext:
    defaults = {
        "task": "collect settings",
        "settings": {"collected_settings": {}, "current_category": "genre"},
        "history": [{"role": "user", "content": "我想写一本小说"}],
    }
    defaults.update(overrides)
    return AgentContext(**defaults)


# ===========================================================================
# Initialization Tests
# ===========================================================================

class TestChatAgentInit:
    """Test ChatAgent initialization."""

    def test_stores_categories(self):
        agent = _make_chat_agent()
        assert len(agent._categories) == 12
        assert "genre" in agent._categories
        assert "worldview" in agent._categories

    def test_stores_templates(self):
        agent = _make_chat_agent()
        assert "genre" in agent._templates
        assert "worldview" in agent._templates


# ===========================================================================
# Lifecycle Hook Tests
# ===========================================================================

class TestChatAgentHooks:
    """Test pre_execute and post_execute hooks."""

    @pytest.mark.asyncio
    async def test_pre_execute_injects_progress(self):
        agent = _make_chat_agent()
        context = _make_context()
        result = await agent.pre_execute(context)
        assert "collection_progress" in result.settings
        progress = result.settings["collection_progress"]
        assert progress["completed"] == 0
        assert progress["total"] == 12
        assert progress["remaining"] == 12

    @pytest.mark.asyncio
    async def test_pre_execute_with_partial_collection(self):
        agent = _make_chat_agent()
        context = _make_context(settings={
            "collected_settings": {"genre": {"type": "玄幻"}, "worldview": {"world": "异世界"}},
            "current_category": "power_system",
        })
        result = await agent.pre_execute(context)
        progress = result.settings["collection_progress"]
        assert progress["completed"] == 2
        assert progress["remaining"] == 10

    @pytest.mark.asyncio
    async def test_post_execute_annotates_metadata(self):
        agent = _make_chat_agent()
        context = _make_context()
        result = AgentResult(content={"next_question": "test"}, confidence=0.5)
        annotated = await agent.post_execute(context, result)
        assert "collection_progress" in annotated.metadata
        assert "percent" in annotated.metadata["collection_progress"]

    @pytest.mark.asyncio
    async def test_full_lifecycle_with_hooks(self):
        agent = _make_chat_agent()
        context = _make_context()
        result = await agent.execute_with_hooks(context)
        assert result.content is not None
        assert "collection_progress" in context.settings


# ===========================================================================
# Execute Tests
# ===========================================================================

class TestChatAgentExecute:
    """Test execute method."""

    @pytest.mark.asyncio
    async def test_execute_happy_path(self):
        agent = _make_chat_agent()
        agent._provider.generate = AsyncMock(
            return_value=json.dumps({
                "next_question": "您想写什么类型的小说？",
                "extracted_settings": {},
                "completed_categories": [],
            })
        )
        context = _make_context()
        result = await agent.execute(context)
        assert "next_question" in result.content
        assert result.confidence >= 0

    @pytest.mark.asyncio
    async def test_execute_with_completed_categories(self):
        agent = _make_chat_agent()
        agent._provider.generate = AsyncMock(
            return_value=json.dumps({
                "next_question": "下一个问题",
                "extracted_settings": {"genre": {"type": "玄幻"}},
                "completed_categories": ["genre"],
            })
        )
        context = _make_context()
        result = await agent.execute(context)
        assert result.confidence > 0

    @pytest.mark.asyncio
    async def test_execute_ai_failure_returns_fallback(self):
        agent = _make_chat_agent()
        agent._provider.generate = AsyncMock(side_effect=AIServiceError(message="API down"))
        context = _make_context()
        result = await agent.execute(context)
        assert result.confidence == 0.3
        assert result.metadata.get("fallback") is True
        assert any("fallback" in w.lower() for w in result.warnings)

    @pytest.mark.asyncio
    async def test_execute_timeout_returns_fallback(self):
        agent = _make_chat_agent()
        agent._provider.generate = AsyncMock(side_effect=AIServiceTimeoutError(timeout_seconds=30.0))
        context = _make_context()
        result = await agent.execute(context)
        assert result.confidence == 0.3
        assert result.metadata.get("fallback") is True

    @pytest.mark.asyncio
    async def test_execute_rate_limit_returns_fallback(self):
        agent = _make_chat_agent()
        agent._provider.generate = AsyncMock(side_effect=AIServiceRateLimitError(retry_after=60))
        context = _make_context()
        result = await agent.execute(context)
        assert result.confidence == 0.3


# ===========================================================================
# Extract Settings Tests
# ===========================================================================

class TestExtractSettings:
    """Test extract_settings_from_message method."""

    @pytest.mark.asyncio
    async def test_extract_json_response(self):
        agent = _make_chat_agent()
        agent._provider.generate = AsyncMock(
            return_value='```json\n{"genre": {"type": "玄幻", "tone": "热血"}}\n```'
        )
        result = await agent.extract_settings_from_message("我想写玄幻小说", "genre")
        assert "genre" in result

    @pytest.mark.asyncio
    async def test_extract_raw_json(self):
        agent = _make_chat_agent()
        agent._provider.generate = AsyncMock(
            return_value='{"worldview": {"world": "修仙世界"}}'
        )
        result = await agent.extract_settings_from_message("修仙世界", "worldview")
        assert "worldview" in result

    @pytest.mark.asyncio
    async def test_extract_ai_failure_returns_empty(self):
        agent = _make_chat_agent()
        agent._provider.generate = AsyncMock(side_effect=AIServiceError(message="fail"))
        result = await agent.extract_settings_from_message("test", "genre")
        assert result == {}


# ===========================================================================
# Helper Method Tests
# ===========================================================================

class TestChatAgentHelpers:
    """Test internal helper methods."""

    def test_build_prompt_basic(self):
        agent = _make_chat_agent()
        prompt = agent._build_prompt(
            history=[{"role": "user", "content": "hello"}],
            settings_so_far={},
            current_category="genre",
        )
        assert isinstance(prompt, str)
        assert len(prompt) > 0

    def test_build_prompt_with_collected_settings(self):
        agent = _make_chat_agent()
        prompt = agent._build_prompt(
            history=[],
            settings_so_far={"genre": {"type": "玄幻"}},
            current_category="worldview",
        )
        assert "genre" in prompt

    def test_parse_response_valid_json(self):
        agent = _make_chat_agent()
        result = agent._parse_response('{"next_question": "test?"}')
        assert result["next_question"] == "test?"

    def test_parse_response_fallback_plain_text(self):
        agent = _make_chat_agent()
        result = agent._parse_response("just plain text")
        assert "next_question" in result

    def test_determine_next_category_current_not_completed(self):
        agent = _make_chat_agent()
        result = agent._determine_next_category([], "genre")
        assert result == "genre"

    def test_determine_next_category_current_completed(self):
        agent = _make_chat_agent()
        result = agent._determine_next_category(["genre"], "genre")
        assert result == "worldview"

    def test_determine_next_category_all_completed(self):
        agent = _make_chat_agent()
        result = agent._determine_next_category(list(SETTING_CATEGORIES), "plot_direction")
        assert result == "complete"

    def test_fallback_question_returns_string(self):
        agent = _make_chat_agent()
        q = agent._fallback_question("genre", {})
        assert isinstance(q, str)
        assert len(q) > 0

    def test_get_setting_summary(self):
        agent = _make_chat_agent()
        summary = agent.get_setting_summary({"genre": {"type": "玄幻"}})
        assert "genre" in summary
        assert "玄幻" in summary

    def test_get_setting_summary_empty(self):
        agent = _make_chat_agent()
        summary = agent.get_setting_summary({})
        assert "已收集设定汇总" in summary
