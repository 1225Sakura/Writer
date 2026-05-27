"""Tests for ContextAgent — writing execution package generation.

Covers:
- Happy path: generate_chapter_context, strand-aware, fact-check, hierarchical
- Error handling: chapter not found, AI parse failure, validation errors
- Lifecycle hooks: pre_execute injects chapter metadata, post_execute validates completeness
- Strand context building and fact-check list construction
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.agents.base import AgentContext, AgentResult
from backend.agents.context_agent import (
    ContextAgent,
    StrandType,
    StrandContext,
    FactCheckItem,
    HierarchicalContext,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_context_agent() -> ContextAgent:
    """Create a ContextAgent with mocked dependencies."""
    original = ContextAgent.__abstractmethods__
    ContextAgent.__abstractmethods__ = frozenset()
    try:
        provider = MagicMock()
        provider.name = "test_provider"
        event_bus = AsyncMock()
        ai_service = MagicMock()
        agent = ContextAgent(provider=provider, event_bus=event_bus, ai_service=ai_service)
    finally:
        ContextAgent.__abstractmethods__ = original
    agent._api_client = AsyncMock()
    return agent


def _make_mock_db():
    """Create a mock AsyncSession."""
    db = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    result_mock.scalars.return_value.all.return_value = []
    result_mock.first.return_value = None
    result_mock.all.return_value = []
    db.execute.return_value = result_mock
    return db


def _valid_context_response():
    return {
        "core_task": {"goal": "揭露真相", "obstacle": "反派阻挠", "cost": "牺牲同伴"},
        "承接上文": {"hooks": ["悬念"], "reader_expectations": "期待反转"},
        "active_characters": [{"name": "主角", "current_state": "愤怒"}],
        "scene_constraints": {"locations": ["城堡"], "power_limits": "封印"},
        "time_constraints": "三天内",
        "style_guidance": "紧张节奏",
        "continuity": {"foreshadowing": ["伏笔1"], "ongoing_threads": ["线索1"]},
        "engagement_strategy": "章末悬念",
    }


# ===========================================================================
# Lifecycle Hook Tests
# ===========================================================================

class TestContextAgentHooks:
    """Test pre_execute and post_execute hooks."""

    @pytest.mark.asyncio
    async def test_pre_execute_injects_chapter_id(self):
        agent = _make_context_agent()
        context = AgentContext(task="generate context", chapter_id=42)
        result = await agent.pre_execute(context)
        assert result.settings["target_chapter_id"] == 42

    @pytest.mark.asyncio
    async def test_pre_execute_injects_world_context_flag(self):
        agent = _make_context_agent()
        context = AgentContext(task="test", world_context="world text")
        result = await agent.pre_execute(context)
        assert result.settings["world_context_available"] is True

    @pytest.mark.asyncio
    async def test_pre_execute_no_chapter_id(self):
        agent = _make_context_agent()
        context = AgentContext(task="test")
        result = await agent.pre_execute(context)
        assert "target_chapter_id" not in result.settings

    @pytest.mark.asyncio
    async def test_post_execute_warns_on_unresolved_core_task(self):
        agent = _make_context_agent()
        context = AgentContext(task="test")
        result = AgentResult(content={
            "core_task": {"goal": "待确定", "obstacle": "待确定", "cost": "待确定"},
            "active_characters": [],
        })
        annotated = await agent.post_execute(context, result)
        assert len(annotated.warnings) > 0
        assert any("unresolved" in w.lower() for w in annotated.warnings)

    @pytest.mark.asyncio
    async def test_post_execute_warns_on_empty_characters(self):
        agent = _make_context_agent()
        context = AgentContext(task="test")
        result = AgentResult(content={
            "core_task": {"goal": "goal", "obstacle": "obs", "cost": "cost"},
            "active_characters": [],
        })
        annotated = await agent.post_execute(context, result)
        assert any("No active characters" in w for w in annotated.warnings)

    @pytest.mark.asyncio
    async def test_post_execute_no_warnings_on_valid_result(self):
        agent = _make_context_agent()
        context = AgentContext(task="test")
        result = AgentResult(content=_valid_context_response())
        annotated = await agent.post_execute(context, result)
        assert len(annotated.warnings) == 0

    @pytest.mark.asyncio
    async def test_post_execute_non_dict_content_passthrough(self):
        agent = _make_context_agent()
        context = AgentContext(task="test")
        result = AgentResult(content="plain text")
        annotated = await agent.post_execute(context, result)
        assert annotated.content == "plain text"


# ===========================================================================
# HierarchicalContext Tests
# ===========================================================================

class TestHierarchicalContext:
    """Test HierarchicalContext dataclass."""

    def test_defaults(self):
        hc = HierarchicalContext()
        assert hc.world_layer == {}
        assert hc.scene_layer == {}
        assert hc.character_layer == {}

    def test_to_flat_dict(self):
        hc = HierarchicalContext(
            world_layer={"name": "world"},
            scene_layer={"chapter": 1},
            character_layer={"chars": []},
        )
        flat = hc.to_flat_dict()
        assert flat["world_context"] == {"name": "world"}
        assert flat["scene_context"] == {"chapter": 1}
        assert flat["character_context"] == {"chars": []}


# ===========================================================================
# StrandContext Tests
# ===========================================================================

class TestStrandContext:
    """Test StrandContext and StrandType."""

    def test_strand_type_values(self):
        assert StrandType.MAIN.value == "main"
        assert StrandType.SUB.value == "sub"
        assert StrandType.IF.value == "if"

    def test_strand_context_creation(self):
        sc = StrandContext(
            strand_type=StrandType.MAIN,
            title="主线",
            description="主线剧情",
            priority=10,
        )
        assert sc.strand_type == StrandType.MAIN
        assert sc.priority == 10


# ===========================================================================
# FactCheckItem Tests
# ===========================================================================

class TestFactCheckItem:
    """Test FactCheckItem dataclass."""

    def test_creation(self):
        item = FactCheckItem(
            category="character",
            entity_name="Alice",
            attribute="gender",
            value="F",
            source="characters:1",
        )
        assert item.category == "character"
        assert item.entity_name == "Alice"


# ===========================================================================
# Error Handling Tests
# ===========================================================================

class TestContextAgentErrors:
    """Test error handling scenarios."""

    @pytest.mark.asyncio
    async def test_generate_context_chapter_not_found(self):
        agent = _make_context_agent()
        db = _make_mock_db()
        db.execute.return_value.scalar_one_or_none.return_value = None

        with pytest.raises(ValueError, match="not found"):
            await agent.generate_chapter_context(999, db)

    @pytest.mark.asyncio
    async def test_build_context_prompt_parse_failure_uses_fallback(self):
        """When AI response can't be parsed, should return fallback context."""
        agent = _make_context_agent()
        agent._api_client.call = AsyncMock(return_value="not valid json at all")

        # Create a mock chapter
        chapter = MagicMock()
        chapter.id = 1
        chapter.title = "第一章"
        chapter.summary = "summary"
        chapter.outline_id = None
        chapter.chapter_order = 0

        result = await agent._build_context_prompt(
            chapter=chapter,
            outline=None,
            previous_chapter=None,
            active_plot_threads=[],
            character_storylines=[],
            if_lines=[],
        )
        assert "core_task" in result
        assert result["core_task"]["goal"] == "待确定"
        assert "parse_error" in result


# ===========================================================================
# Strand-Aware Context Tests
# ===========================================================================

class TestStrandAwareContext:
    """Test generate_strand_aware_context method."""

    @pytest.mark.asyncio
    async def test_strand_aware_adds_strand_contexts_key(self):
        agent = _make_context_agent()
        db = _make_mock_db()

        # Mock chapter
        chapter = MagicMock()
        chapter.id = 1
        chapter.title = "第一章"
        chapter.summary = "summary"
        chapter.outline_id = None
        chapter.chapter_order = 0
        db.execute.return_value.scalar_one_or_none.return_value = chapter

        # Mock valid context response
        agent._api_client.call = AsyncMock(
            return_value='{"core_task": {"goal": "g", "obstacle": "o", "cost": "c"}, '
            '"承接上文": {"hooks": [], "reader_expectations": ""}, '
            '"active_characters": [], "scene_constraints": {"locations": [], "power_limits": ""}, '
            '"time_constraints": "", "style_guidance": "", '
            '"continuity": {"foreshadowing": [], "ongoing_threads": []}, '
            '"engagement_strategy": ""}'
        )

        result = await agent.generate_strand_aware_context(1, db)
        assert "strand_contexts" in result
        assert result["strand_aware"] is True


# ===========================================================================
# Fact-Check List Tests
# ===========================================================================

class TestFactCheckList:
    """Test build_fact_check_list method."""

    @pytest.mark.asyncio
    async def test_empty_db_returns_empty_list(self):
        agent = _make_context_agent()
        db = _make_mock_db()
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        db.execute.return_value = result_mock

        facts = await agent.build_fact_check_list(1, db)
        assert isinstance(facts, list)

    @pytest.mark.asyncio
    async def test_fact_check_with_characters(self):
        agent = _make_context_agent()
        db = _make_mock_db()

        char = MagicMock()
        char.name = "Alice"
        char.gender = "F"
        char.cultivation_realm = "golden_core"
        char.id = 1

        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = [char]
        db.execute.return_value = result_mock

        facts = await agent.build_fact_check_list(1, db)
        assert len(facts) >= 2  # gender + cultivation_realm


# ===========================================================================
# Required Fields Tests
# ===========================================================================

class TestRequiredContextFields:
    """Test REQUIRED_CONTEXT_FIELDS validation."""

    def test_required_fields_defined(self):
        assert "core_task" in ContextAgent.REQUIRED_CONTEXT_FIELDS
        assert "active_characters" in ContextAgent.REQUIRED_CONTEXT_FIELDS
        assert "scene_constraints" in ContextAgent.REQUIRED_CONTEXT_FIELDS
