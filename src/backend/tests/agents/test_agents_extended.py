"""Extended tests for agent modules targeting uncovered code paths.

Covers code paths NOT already covered by:
- tests/agents/test_agents.py
- tests/agents/test_base_agent.py
- tests/agents/test_checkers_pipeline.py

Focus areas:
- ContextAgent: _build_context_prompt validation, strand fragments, fact-check, hierarchical
- DataAgent: _slice_scenes, _generate_summary, _persist_extracted_data, incremental, relation graph
- Orchestrator: workflow_service persistence, AgentError failure, list_executions filter, unregistered agent
- ChatAgent: extract_settings_from_message, _build_prompt with data, confidence calculation
- StyleAgent: analyze_fingerprint full flow, adjust_style, migration_suggestions
- PlotAgent: prompt builders, validate_foreshadowing/rhythm, AIServiceError per-analysis
- ReviewAgent: disagreement edge cases, confidence adjustment, CheckerError in scans
- StrandTracker: _aggregate_strand_data with outlines/IF, operators, summary, check_red_lines shortcut
- Utils: retry exhaustion, validate_list_response edge cases, _collect_results BaseException
- Checkers: pipeline error handling, aggregate severity boundaries
- Base: api_client lazy init
"""

import json
import pytest
from unittest.mock import MagicMock, AsyncMock, patch, PropertyMock
from dataclasses import dataclass

from backend.agents.base import BaseAgent, AgentContext, AgentResult, DatabaseMixin
from backend.agents.checkers.base import BaseChecker, CheckerResult


def _mock_agent_with_hooks(execute_return=None, execute_side_effect=None):
    """Create a MagicMock(spec=BaseAgent) with execute_with_hooks wired to execute."""
    agent = MagicMock(spec=BaseAgent)
    if execute_side_effect is not None:
        agent.execute = AsyncMock(side_effect=execute_side_effect)
    else:
        agent.execute = AsyncMock(return_value=execute_return or AgentResult(content="done", confidence=0.9))
    agent.pre_execute = AsyncMock(side_effect=lambda ctx: ctx)
    agent.post_execute = AsyncMock(side_effect=lambda ctx, result: result)

    async def _hooks(ctx):
        ctx = await agent.pre_execute(ctx)
        r = await agent.execute(ctx)
        r = await agent.post_execute(ctx, r)
        return r

    agent.execute_with_hooks = AsyncMock(side_effect=_hooks)
    return agent


# =============================================================================
# Shared Fixtures
# =============================================================================

@pytest.fixture
def mock_provider():
    provider = MagicMock()
    provider.generate = AsyncMock(return_value='{"next_question": "test?", "extracted_settings": {}, "completed_categories": []}')
    provider.name = "mock_provider"
    provider.supports_streaming = False
    provider.max_tokens = 4096
    return provider


@pytest.fixture
def mock_event_bus():
    bus = MagicMock()
    bus.publish = AsyncMock()
    return bus


@pytest.fixture
def mock_ai_service():
    service = MagicMock()
    service.base_url = "https://api.example.com"
    service.endpoint_path = "/v1/chat/completions"
    service.api_key = "test-key"
    return service


@pytest.fixture
def sample_context():
    return AgentContext(
        task="test task",
        settings={"collected_settings": {}, "current_category": "genre"},
        history=[{"role": "user", "content": "hello"}],
        constraints=["constraint1"],
    )


# =============================================================================
# ContextAgent - Uncovered Paths
# =============================================================================

class TestContextAgentBuildPrompt:
    """Test _build_context_prompt validation and fallback logic."""

    @pytest.fixture
    def context_agent(self, mock_provider, mock_event_bus, mock_ai_service):
        from backend.agents.context_agent import ContextAgent

        class ConcreteContextAgent(ContextAgent):
            async def execute(self, context):
                return AgentResult(content="stub")

        return ConcreteContextAgent(provider=mock_provider, event_bus=mock_event_bus, ai_service=mock_ai_service)

    def _make_chapter(self, **kwargs):
        ch = MagicMock()
        ch.id = kwargs.get("id", 1)
        ch.title = kwargs.get("title", "第一章")
        ch.summary = kwargs.get("summary", "概要")
        ch.chapter_order = kwargs.get("chapter_order", 0)
        ch.outline_id = kwargs.get("outline_id", 1)
        return ch

    @pytest.mark.asyncio
    async def test_build_context_prompt_validates_core_task_must_be_dict(self, context_agent, mock_provider):
        """_build_context_prompt falls back when core_task is not a dict."""
        mock_provider.generate = AsyncMock()
        mock_client = MagicMock()
        mock_client.call = AsyncMock(
            return_value=json.dumps({
                "core_task": "not a dict",
                "承接上文": {"hooks": [], "reader_expectations": "test"},
                "active_characters": [],
                "scene_constraints": {"locations": [], "power_limits": "test"},
                "time_constraints": "test",
                "style_guidance": "test",
                "continuity": {"foreshadowing": [], "ongoing_threads": []},
                "engagement_strategy": "test",
            })
        )
        with patch.object(type(context_agent), 'api_client', new_callable=PropertyMock, return_value=mock_client):
            chapter = self._make_chapter()
            result = await context_agent._build_context_prompt(chapter, None, None, [], [], [])
            assert "parse_error" in result
            assert result["core_task"]["goal"] == "待确定"

    @pytest.mark.asyncio
    async def test_build_context_prompt_validates_core_task_fields(self, context_agent):
        """_build_context_prompt falls back when core_task missing goal/obstacle/cost."""
        mock_client = MagicMock()
        mock_client.call = AsyncMock(
            return_value=json.dumps({
                "core_task": {"goal": "目标"},  # missing obstacle and cost
                "承接上文": {"hooks": [], "reader_expectations": "test"},
                "active_characters": [],
                "scene_constraints": {"locations": [], "power_limits": "test"},
                "time_constraints": "test",
                "style_guidance": "test",
                "continuity": {"foreshadowing": [], "ongoing_threads": []},
                "engagement_strategy": "test",
            })
        )
        with patch.object(type(context_agent), 'api_client', new_callable=PropertyMock, return_value=mock_client):
            chapter = self._make_chapter()
            result = await context_agent._build_context_prompt(chapter, None, None, [], [], [])
            assert "parse_error" in result

    @pytest.mark.asyncio
    async def test_build_context_prompt_validates_active_characters_must_be_list(self, context_agent):
        """_build_context_prompt falls back when active_characters is not a list."""
        mock_client = MagicMock()
        mock_client.call = AsyncMock(
            return_value=json.dumps({
                "core_task": {"goal": "目标", "obstacle": "阻碍", "cost": "代价"},
                "承接上文": {"hooks": [], "reader_expectations": "test"},
                "active_characters": "not a list",
                "scene_constraints": {"locations": [], "power_limits": "test"},
                "time_constraints": "test",
                "style_guidance": "test",
                "continuity": {"foreshadowing": [], "ongoing_threads": []},
                "engagement_strategy": "test",
            })
        )
        with patch.object(type(context_agent), 'api_client', new_callable=PropertyMock, return_value=mock_client):
            chapter = self._make_chapter()
            result = await context_agent._build_context_prompt(chapter, None, None, [], [], [])
            assert "parse_error" in result

    @pytest.mark.asyncio
    async def test_build_context_prompt_validates_scene_constraints_must_be_dict(self, context_agent):
        """_build_context_prompt falls back when scene_constraints is not a dict."""
        mock_client = MagicMock()
        mock_client.call = AsyncMock(
            return_value=json.dumps({
                "core_task": {"goal": "目标", "obstacle": "阻碍", "cost": "代价"},
                "承接上文": {"hooks": [], "reader_expectations": "test"},
                "active_characters": [],
                "scene_constraints": "not a dict",
                "time_constraints": "test",
                "style_guidance": "test",
                "continuity": {"foreshadowing": [], "ongoing_threads": []},
                "engagement_strategy": "test",
            })
        )
        with patch.object(type(context_agent), 'api_client', new_callable=PropertyMock, return_value=mock_client):
            chapter = self._make_chapter()
            result = await context_agent._build_context_prompt(chapter, None, None, [], [], [])
            assert "parse_error" in result

    @pytest.mark.asyncio
    async def test_build_context_prompt_validates_continuity_must_be_dict(self, context_agent):
        """_build_context_prompt falls back when continuity is not a dict."""
        mock_client = MagicMock()
        mock_client.call = AsyncMock(
            return_value=json.dumps({
                "core_task": {"goal": "目标", "obstacle": "阻碍", "cost": "代价"},
                "承接上文": {"hooks": [], "reader_expectations": "test"},
                "active_characters": [],
                "scene_constraints": {"locations": [], "power_limits": "test"},
                "time_constraints": "test",
                "style_guidance": "test",
                "continuity": "not a dict",
                "engagement_strategy": "test",
            })
        )
        with patch.object(type(context_agent), 'api_client', new_callable=PropertyMock, return_value=mock_client):
            chapter = self._make_chapter()
            result = await context_agent._build_context_prompt(chapter, None, None, [], [], [])
            assert "parse_error" in result

    @pytest.mark.asyncio
    async def test_build_context_prompt_validates_chengjie_must_be_dict(self, context_agent):
        """_build_context_prompt falls back when 承接上文 is not a dict."""
        mock_client = MagicMock()
        mock_client.call = AsyncMock(
            return_value=json.dumps({
                "core_task": {"goal": "目标", "obstacle": "阻碍", "cost": "代价"},
                "承接上文": "not a dict",
                "active_characters": [],
                "scene_constraints": {"locations": [], "power_limits": "test"},
                "time_constraints": "test",
                "style_guidance": "test",
                "continuity": {"foreshadowing": [], "ongoing_threads": []},
                "engagement_strategy": "test",
            })
        )
        with patch.object(type(context_agent), 'api_client', new_callable=PropertyMock, return_value=mock_client):
            chapter = self._make_chapter()
            result = await context_agent._build_context_prompt(chapter, None, None, [], [], [])
            assert "parse_error" in result


class TestContextAgentStrandFragment:
    """Test _build_strand_fragment for different strand types."""

    @pytest.fixture
    def context_agent(self, mock_provider, mock_event_bus, mock_ai_service):
        from backend.agents.context_agent import ContextAgent

        class ConcreteContextAgent(ContextAgent):
            async def execute(self, context):
                return AgentResult(content="stub")

        return ConcreteContextAgent(provider=mock_provider, event_bus=mock_event_bus, ai_service=mock_ai_service)

    @pytest.mark.asyncio
    async def test_build_strand_fragment_main_type(self, context_agent):
        """MAIN strand fragment includes core_task and continuity."""
        from backend.agents.context_agent import StrandContext, StrandType

        strand = StrandContext(
            strand_type=StrandType.MAIN,
            title="主线",
            description="主线故事",
            priority=10,
        )
        base_context = {
            "core_task": {"goal": "目标"},
            "continuity": {"ongoing_threads": ["t1"]},
        }
        fragment = await context_agent._build_strand_fragment(strand, base_context)
        assert fragment["focus"] == "主线"
        assert fragment["type"] == "main"
        assert fragment["core_task"] == {"goal": "目标"}
        assert fragment["continuity"] == {"ongoing_threads": ["t1"]}

    @pytest.mark.asyncio
    async def test_build_strand_fragment_sub_type(self, context_agent):
        """SUB strand fragment filters relevant characters."""
        from backend.agents.context_agent import StrandContext, StrandType

        strand = StrandContext(
            strand_type=StrandType.SUB,
            title="副线A",
            description="副线故事",
            priority=5,
        )
        base_context = {
            "active_characters": [
                {"name": "副线A主角", "current_state": "修炼"},
                {"name": "其他角色", "current_state": "休息"},
            ],
        }
        fragment = await context_agent._build_strand_fragment(strand, base_context)
        assert fragment["type"] == "sub"
        assert len(fragment["relevant_characters"]) >= 1

    @pytest.mark.asyncio
    async def test_build_strand_fragment_if_type(self, context_agent):
        """IF strand fragment includes IF premise and divergence points."""
        from backend.agents.context_agent import StrandContext, StrandType

        strand = StrandContext(
            strand_type=StrandType.IF,
            title="IF线1",
            description="如果主角做了不同选择",
            priority=3,
        )
        base_context = {
            "continuity": {"ongoing_threads": ["thread1", "thread2"]},
        }
        fragment = await context_agent._build_strand_fragment(strand, base_context)
        assert fragment["type"] == "if"
        assert fragment["if premise"] == "如果主角做了不同选择"
        assert fragment["divergence_points"] == ["thread1", "thread2"]


class TestContextAgentFactCheck:
    """Test build_fact_check_list with DB mocks."""

    @pytest.fixture
    def context_agent(self, mock_provider, mock_event_bus, mock_ai_service):
        from backend.agents.context_agent import ContextAgent

        class ConcreteContextAgent(ContextAgent):
            async def execute(self, context):
                return AgentResult(content="stub")

        return ConcreteContextAgent(provider=mock_provider, event_bus=mock_event_bus, ai_service=mock_ai_service)

    @pytest.mark.asyncio
    async def test_build_fact_check_list_collects_all_entity_types(self, context_agent):
        """build_fact_check_list collects facts from all entity types."""
        mock_ws = MagicMock()
        mock_ws.id = 1
        mock_ws.name = "修仙世界"
        mock_ws.description = "灵气复苏的世界"

        mock_rule = MagicMock()
        mock_rule.id = 1
        mock_rule.name = "天道规则"
        mock_rule.description = "不可违抗天道"

        mock_char = MagicMock()
        mock_char.id = 1
        mock_char.name = "张三"
        mock_char.gender = "男"
        mock_char.cultivation_realm = "筑基期"

        mock_item = MagicMock()
        mock_item.id = 1
        mock_item.name = "神剑"
        mock_item.owner = "张三"

        mock_faction = MagicMock()
        mock_faction.id = 1
        mock_faction.name = "天剑宗"
        mock_faction.type = "宗门"

        # Mock db.execute with different return values per call
        call_count = 0

        class MockScalars:
            def __init__(self, items):
                self._items = items
            def all(self):
                return self._items

        class MockResult:
            def __init__(self, items):
                self._scalars = MockScalars(items)
            def scalars(self):
                return self._scalars

        results_map = [
            MockResult([mock_ws]),       # WorldSetting
            MockResult([mock_rule]),     # Rule
            MockResult([mock_char]),     # Character
            MockResult([mock_item]),     # Item (where owner is not None)
            MockResult([mock_faction]),  # Faction
        ]

        mock_db = MagicMock()
        mock_db.execute = AsyncMock(side_effect=results_map)

        facts = await context_agent.build_fact_check_list(1, mock_db)

        assert len(facts) >= 5
        categories = {f.category for f in facts}
        assert "world" in categories
        assert "rule" in categories
        assert "character" in categories
        assert "item" in categories
        assert "faction" in categories

    @pytest.mark.asyncio
    async def test_build_fact_check_list_character_with_realm(self, context_agent):
        """build_fact_check_list creates cultivation_realm fact for characters with realm."""
        mock_char = MagicMock()
        mock_char.id = 1
        mock_char.name = "李四"
        mock_char.gender = "女"
        mock_char.cultivation_realm = "金丹期"

        class MockScalars:
            def __init__(self, items):
                self._items = items
            def all(self):
                return self._items

        class MockResult:
            def __init__(self, items):
                self._scalars = MockScalars(items)
            def scalars(self):
                return self._scalars

        mock_db = MagicMock()
        mock_db.execute = AsyncMock(side_effect=[
            MockResult([]),           # WorldSetting
            MockResult([]),           # Rule
            MockResult([mock_char]),  # Character
            MockResult([]),           # Item
            MockResult([]),           # Faction
        ])

        facts = await context_agent.build_fact_check_list(1, mock_db)

        realm_facts = [f for f in facts if f.attribute == "cultivation_realm"]
        assert len(realm_facts) == 1
        assert realm_facts[0].value == "金丹期"


class TestContextAgentHierarchical:
    """Test build_hierarchical_context and to_flat_dict."""

    @pytest.fixture
    def context_agent(self, mock_provider, mock_event_bus, mock_ai_service):
        from backend.agents.context_agent import ContextAgent

        class ConcreteContextAgent(ContextAgent):
            async def execute(self, context):
                return AgentResult(content="stub")

        return ConcreteContextAgent(provider=mock_provider, event_bus=mock_event_bus, ai_service=mock_ai_service)

    @pytest.mark.asyncio
    async def test_build_hierarchical_context_layers(self, context_agent):
        """build_hierarchical_context builds world, scene, and character layers."""
        mock_ws = MagicMock()
        mock_ws.name = "修仙世界"
        mock_ws.description = "灵气复苏"

        mock_rule = MagicMock()
        mock_rule.name = "天道"
        mock_rule.description = "不可违"

        mock_chapter = MagicMock()
        mock_chapter.title = "第一章"
        mock_chapter.summary = "开篇"
        mock_chapter.chapter_order = 0

        mock_loc = MagicMock()
        mock_loc.name = "青云山"
        mock_loc.description = "宗门所在地"

        mock_char = MagicMock()
        mock_char.name = "张三"
        mock_char.gender = "男"
        mock_char.cultivation_realm = "练气期"

        mock_cs = MagicMock()
        mock_cs.arc = "成长线"
        mock_cs.progress = 30

        class MockScalars:
            def __init__(self, items):
                self._items = items
            def all(self):
                return self._items

        class MockResult:
            def __init__(self, items=None, scalar=None, pairs=None):
                self._scalars = MockScalars(items or [])
                self._scalar = scalar
                self._pairs = pairs or []
            def scalars(self):
                return self._scalars
            def scalar_one_or_none(self):
                return self._scalar
            def all(self):
                return self._pairs

        mock_db = MagicMock()
        mock_db.execute = AsyncMock(side_effect=[
            MockResult(items=[mock_ws]),         # WorldSetting
            MockResult(items=[mock_rule]),        # Rule
            MockResult(scalar=mock_chapter),      # Chapter
            MockResult(items=[mock_loc]),         # Location
            MockResult(pairs=[(mock_char, mock_cs)]),  # Character + CharacterStoryline
        ])

        hc = await context_agent.build_hierarchical_context(1, mock_db)

        assert hc.world_layer["world_name"] == "修仙世界"
        assert len(hc.world_layer["rules"]) == 1
        assert hc.scene_layer["chapter_title"] == "第一章"
        assert len(hc.character_layer["active_characters"]) == 1
        assert hc.character_layer["active_characters"][0]["name"] == "张三"

    def test_hierarchical_context_to_flat_dict_with_defaults(self):
        """HierarchicalContext.to_flat_dict with default empty dicts."""
        from backend.agents.context_agent import HierarchicalContext

        hc = HierarchicalContext()
        flat = hc.to_flat_dict()
        assert flat == {
            "world_context": {},
            "scene_context": {},
            "character_context": {},
        }


# =============================================================================
# DataAgent - Uncovered Paths
# =============================================================================

class TestDataAgentSliceScenes:
    """Test _slice_scenes with various response formats."""

    @pytest.fixture
    def data_agent(self, mock_provider, mock_event_bus, mock_ai_service):
        from backend.agents.data_agent import DataAgent

        class ConcreteDataAgent(DataAgent):
            async def execute(self, context):
                return AgentResult(content="stub")

        return ConcreteDataAgent(
            provider=mock_provider, event_bus=mock_event_bus, ai_service=mock_ai_service
        )

    @pytest.mark.asyncio
    async def test_slice_scenes_with_container_key(self, data_agent):
        """_slice_scenes extracts scenes from container dict."""
        mock_client = MagicMock()
        mock_client.call_and_parse_json = AsyncMock(
            return_value={"scenes": [
                {"scene_number": 1, "location": "山洞", "characters": ["张三"], "key_events": ["突破"], "mood": "紧张"},
                {"scene_number": 2, "location": "宗门", "characters": [], "key_events": [], "mood": "平静"},
            ]}
        )
        with patch.object(type(data_agent), 'api_client', new_callable=PropertyMock, return_value=mock_client):
            scenes = await data_agent._slice_scenes("测试内容")
            assert len(scenes) == 2
            assert scenes[0]["location"] == "山洞"

    @pytest.mark.asyncio
    async def test_slice_scenes_with_direct_list(self, data_agent):
        """_slice_scenes handles direct list response."""
        mock_client = MagicMock()
        mock_client.call_and_parse_json = AsyncMock(
            return_value=[{"scene_number": 1, "location": "广场", "characters": [], "key_events": [], "mood": "热血"}]
        )
        with patch.object(type(data_agent), 'api_client', new_callable=PropertyMock, return_value=mock_client):
            scenes = await data_agent._slice_scenes("测试内容")
            assert len(scenes) == 1

    @pytest.mark.asyncio
    async def test_slice_scenes_filters_non_dict_items(self, data_agent):
        """_slice_scenes filters out non-dict items from list."""
        mock_client = MagicMock()
        mock_client.call_and_parse_json = AsyncMock(
            return_value=[
                {"scene_number": 1, "location": "山", "characters": [], "key_events": [], "mood": ""},
                "not a dict",
                42,
            ]
        )
        with patch.object(type(data_agent), 'api_client', new_callable=PropertyMock, return_value=mock_client):
            scenes = await data_agent._slice_scenes("测试内容")
            assert len(scenes) == 1

    @pytest.mark.asyncio
    async def test_slice_scenes_handles_non_list_non_dict_raises(self, data_agent):
        """_slice_scenes returns empty for non-list, non-dict response."""
        mock_client = MagicMock()
        mock_client.call_and_parse_json = AsyncMock(return_value="invalid")
        with patch.object(type(data_agent), 'api_client', new_callable=PropertyMock, return_value=mock_client):
            scenes = await data_agent._slice_scenes("测试内容")
            assert scenes == []

    @pytest.mark.asyncio
    async def test_slice_scenes_handles_characters_not_list(self, data_agent):
        """_slice_scenes normalizes non-list characters/key_events."""
        mock_client = MagicMock()
        mock_client.call_and_parse_json = AsyncMock(
            return_value=[{"scene_number": 1, "location": "", "characters": "not_list", "key_events": "not_list", "mood": ""}]
        )
        with patch.object(type(data_agent), 'api_client', new_callable=PropertyMock, return_value=mock_client):
            scenes = await data_agent._slice_scenes("测试内容")
            assert scenes[0]["characters"] == []
            assert scenes[0]["key_events"] == []


class TestDataAgentGenerateSummary:
    """Test _generate_summary markdown stripping."""

    @pytest.fixture
    def data_agent(self, mock_provider, mock_event_bus, mock_ai_service):
        from backend.agents.data_agent import DataAgent

        class ConcreteDataAgent(DataAgent):
            async def execute(self, context):
                return AgentResult(content="stub")

        return ConcreteDataAgent(
            provider=mock_provider, event_bus=mock_event_bus, ai_service=mock_ai_service
        )

    @pytest.mark.asyncio
    async def test_generate_summary_strips_markdown_blocks(self, data_agent):
        """_generate_summary strips markdown code block wrappers."""
        mock_client = MagicMock()
        mock_client.call = AsyncMock(return_value="```markdown\n这是一段摘要。\n```")
        with patch.object(type(data_agent), 'api_client', new_callable=PropertyMock, return_value=mock_client):
            summary = await data_agent._generate_summary("测试内容")
            assert "```" not in summary
            assert "摘要" in summary

    @pytest.mark.asyncio
    async def test_generate_summary_handles_plain_text(self, data_agent):
        """_generate_summary returns plain text trimmed."""
        mock_client = MagicMock()
        mock_client.call = AsyncMock(return_value="  纯文本摘要  ")
        with patch.object(type(data_agent), 'api_client', new_callable=PropertyMock, return_value=mock_client):
            summary = await data_agent._generate_summary("测试内容")
            assert summary == "纯文本摘要"


class TestDataAgentEntityDeltaEdgeCases:
    """Test compute_entity_delta edge cases."""

    @pytest.fixture
    def data_agent(self, mock_provider, mock_event_bus, mock_ai_service):
        from backend.agents.data_agent import DataAgent

        class ConcreteDataAgent(DataAgent):
            async def execute(self, context):
                return AgentResult(content="stub")

        return ConcreteDataAgent(
            provider=mock_provider, event_bus=mock_event_bus, ai_service=mock_ai_service
        )

    def test_compute_entity_delta_multiple_fields_changed(self, data_agent):
        """compute_entity_delta detects multiple field changes in same entity."""
        old = [{"name": "张三", "type": "character", "description": "旧", "level": 1}]
        new = [{"name": "张三", "type": "character", "description": "新", "level": 5}]
        deltas = data_agent.compute_entity_delta(old, new)
        assert len(deltas) == 2
        fields = {d.field for d in deltas}
        assert "description" in fields
        assert "level" in fields

    def test_compute_entity_delta_added_entity_has_all_fields(self, data_agent):
        """compute_entity_delta creates delta for each field of added entity."""
        old = []
        new = [{"name": "新角色", "type": "character", "description": "desc", "level": 1}]
        deltas = data_agent.compute_entity_delta(old, new)
        assert len(deltas) == 4  # name, type, description, level
        assert all(d.change_type == "added" for d in deltas)
        assert all(d.old_value is None for d in deltas)

    def test_compute_entity_delta_removed_entity_has_all_fields(self, data_agent):
        """compute_entity_delta creates delta for each field of removed entity."""
        old = [{"name": "旧角色", "type": "character", "description": "desc"}]
        new = []
        deltas = data_agent.compute_entity_delta(old, new)
        assert len(deltas) == 3
        assert all(d.change_type == "removed" for d in deltas)
        assert all(d.new_value is None for d in deltas)


class TestDataAgentAliasMatches:
    """Test _find_alias_matches with description boost."""

    @pytest.fixture
    def data_agent(self, mock_provider, mock_event_bus, mock_ai_service):
        from backend.agents.data_agent import DataAgent

        class ConcreteDataAgent(DataAgent):
            async def execute(self, context):
                return AgentResult(content="stub")

        return ConcreteDataAgent(
            provider=mock_provider, event_bus=mock_event_bus, ai_service=mock_ai_service
        )

    def test_find_alias_matches_description_boost(self, data_agent):
        """_find_alias_matches boosts confidence when descriptions overlap."""
        extracted = [{"name": "张三丰", "type": "character", "description": "武当派掌门道士"}]
        canonical = [{"name": "张三", "type": "character", "description": "武当派掌门", "id": 1}]

        matches = data_agent._find_alias_matches(extracted, canonical)
        assert len(matches) >= 1
        # Should have boosted confidence from description similarity
        if matches:
            assert matches[0].confidence > data_agent.ALIAS_SIMILARITY_THRESHOLD

    def test_find_alias_matches_empty_lists(self, data_agent):
        """_find_alias_matches handles empty inputs."""
        matches = data_agent._find_alias_matches([], [])
        assert matches == []


class TestDataAgentRelationGraph:
    """Test RelationGraphNode and RelationGraphEdge."""

    def test_relation_graph_edge_to_dict(self):
        from backend.agents.data_agent import RelationGraph, RelationGraphNode, RelationGraphEdge

        graph = RelationGraph(
            nodes=[
                RelationGraphNode(id="c1", name="张三", type="character", properties={"gender": "男"}),
                RelationGraphNode(id="l1", name="青云山", type="location"),
            ],
            edges=[
                RelationGraphEdge(source="c1", target="l1", relation_type="位于", properties={"desc": "居住地"}),
            ],
        )
        d = graph.to_dict()
        assert len(d["nodes"]) == 2
        assert d["nodes"][0]["properties"]["gender"] == "男"
        assert d["edges"][0]["relation_type"] == "位于"

    def test_relation_graph_empty(self):
        from backend.agents.data_agent import RelationGraph

        graph = RelationGraph()
        d = graph.to_dict()
        assert d == {"nodes": [], "edges": []}


# =============================================================================
# Orchestrator - Uncovered Paths
# =============================================================================

class TestOrchestratorUnregisteredAgent:
    """Test execute_workflow with unregistered agent raises ValueError."""

    @pytest.mark.asyncio
    async def test_execute_workflow_unregistered_agent_raises(self, mock_event_bus):
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        stages = [StageConfig(name="s1", agents=["nonexistent_agent"])]
        orch.register_workflow("wf1", stages)

        with pytest.raises(ValueError, match="not registered"):
            await orch.execute_workflow("wf1", {"task": "test"})


class TestOrchestratorListExecutions:
    """Test list_executions with filter and populated data."""

    @pytest.mark.asyncio
    async def test_list_executions_with_workflow_filter(self, mock_event_bus):
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig

        orch = AgentOrchestrator(event_bus=mock_event_bus)

        agent1 = _mock_agent_with_hooks(
            execute_return=AgentResult(content="done", confidence=0.9)
        )
        orch.register_agent("a1", agent1)

        stages = [StageConfig(name="s1", agents=["a1"])]
        orch.register_workflow("wf1", stages)
        orch.register_workflow("wf2", stages)

        await orch.execute_workflow("wf1", {"task": "test"})
        await orch.execute_workflow("wf2", {"task": "test"})

        all_execs = orch.list_executions()
        assert len(all_execs) == 2

        filtered = orch.list_executions(workflow_name="wf1")
        assert len(filtered) == 1
        assert filtered[0]["workflow_name"] == "wf1"


class TestOrchestratorGetExecutionStatus:
    """Test get_execution_status returns correct data for known execution."""

    @pytest.mark.asyncio
    async def test_get_execution_status_returns_data(self, mock_event_bus):
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig

        orch = AgentOrchestrator(event_bus=mock_event_bus)

        agent1 = _mock_agent_with_hooks(
            execute_return=AgentResult(content="done", confidence=0.9)
        )
        orch.register_agent("a1", agent1)

        stages = [StageConfig(name="s1", agents=["a1"])]
        orch.register_workflow("wf1", stages)

        result = await orch.execute_workflow("wf1", {"task": "test"})
        exec_id = result["execution_id"]

        status = orch.get_execution_status(exec_id)
        assert status is not None
        assert status["status"] == "completed"
        assert status["workflow_name"] == "wf1"
        assert "s1" in status["stage_results"]


class TestOrchestratorWorkflowService:
    """Test workflow_service persistence integration."""

    @pytest.mark.asyncio
    async def test_execute_workflow_persists_via_service(self, mock_event_bus):
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig

        mock_service = MagicMock()
        mock_db_execution = MagicMock()
        mock_db_execution.id = 42
        mock_service.create_execution = AsyncMock(return_value=mock_db_execution)
        mock_service.complete_execution = AsyncMock()
        mock_service.log_agent_execution = AsyncMock()

        orch = AgentOrchestrator(event_bus=mock_event_bus, workflow_service=mock_service)

        agent1 = _mock_agent_with_hooks(
            execute_return=AgentResult(content="done", confidence=0.9)
        )
        orch.register_agent("a1", agent1)

        stages = [StageConfig(name="s1", agents=["a1"])]
        orch.register_workflow("wf1", stages)

        result = await orch.execute_workflow("wf1", {"task": "test"})

        mock_service.create_execution.assert_called_once_with("wf1")
        mock_service.complete_execution.assert_called_once()
        mock_service.log_agent_execution.assert_called_once()
        assert result["status"] == "completed"

    @pytest.mark.asyncio
    async def test_execute_workflow_handles_persistence_failure(self, mock_event_bus):
        """execute_workflow continues even if persistence fails."""
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig
        from backend.utils.exceptions import DatabaseError

        mock_service = MagicMock()
        mock_service.create_execution = AsyncMock(side_effect=DatabaseError("db fail"))

        orch = AgentOrchestrator(event_bus=mock_event_bus, workflow_service=mock_service)

        agent1 = _mock_agent_with_hooks(
            execute_return=AgentResult(content="done", confidence=0.9)
        )
        orch.register_agent("a1", agent1)

        stages = [StageConfig(name="s1", agents=["a1"])]
        orch.register_workflow("wf1", stages)

        result = await orch.execute_workflow("wf1", {"task": "test"})
        assert result["status"] == "completed"


class TestOrchestratorFailureEvents:
    """Test workflow failure event publishing."""

    @pytest.mark.asyncio
    async def test_execute_workflow_publishes_failure_event(self, mock_event_bus):
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig
        from backend.utils.exceptions import AgentError

        orch = AgentOrchestrator(event_bus=mock_event_bus)

        # Make agent fail with AgentError; use _mock_agent_with_hooks
        # so execute_with_hooks properly delegates to execute
        agent1 = _mock_agent_with_hooks(execute_side_effect=AgentError("agent failed"))
        orch.register_agent("a1", agent1)

        stages = [StageConfig(name="s1", agents=["a1"])]
        orch.register_workflow("wf1", stages)

        result = await orch.execute_workflow("wf1", {"task": "test"})
        # In sequential mode, AgentError is caught per-agent
        assert result["status"] == "completed"
        agent_results = result["stage_results"]["s1"]["agent_results"]
        assert "error" in agent_results["a1"]


# =============================================================================
# ChatAgent - Uncovered Paths
# =============================================================================

class TestChatAgentExtractSettings:
    """Test extract_settings_from_message method."""

    @pytest.mark.asyncio
    async def test_extract_settings_from_message_success(self, mock_provider, mock_event_bus):
        from backend.agents.chat_agent import ChatAgent

        mock_provider.generate = AsyncMock(
            return_value='{"type": "玄幻", "tone": "热血"}'
        )
        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        result = await agent.extract_settings_from_message("我想写玄幻小说", "genre")

        assert "genre" in result
        assert result["genre"]["type"] == "玄幻"

    @pytest.mark.asyncio
    async def test_extract_settings_from_message_ai_error(self, mock_provider, mock_event_bus):
        from backend.agents.chat_agent import ChatAgent
        from backend.utils.exceptions import AIServiceError

        mock_provider.generate = AsyncMock(side_effect=AIServiceError("fail"))
        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        result = await agent.extract_settings_from_message("test", "genre")
        assert result == {}

    @pytest.mark.asyncio
    async def test_extract_settings_from_message_no_json(self, mock_provider, mock_event_bus):
        from backend.agents.chat_agent import ChatAgent

        mock_provider.generate = AsyncMock(return_value="no json here")
        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        result = await agent.extract_settings_from_message("test", "genre")
        assert result == {}


class TestChatAgentBuildPrompt:
    """Test _build_prompt with populated data."""

    def test_build_prompt_with_settings_and_history(self, mock_provider, mock_event_bus):
        from backend.agents.chat_agent import ChatAgent

        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        settings = {"genre": {"type": "玄幻"}, "worldview": {"desc": "异世界"}}
        history = [
            {"role": "user", "content": "我想写玄幻"},
            {"role": "assistant", "content": "好的"},
        ]
        prompt = agent._build_prompt(history, settings, "protagonist")

        assert "protagonist" in prompt
        assert "玄幻" in prompt
        assert "异世界" in prompt
        assert "我想写玄幻" in prompt

    def test_build_prompt_with_empty_settings(self, mock_provider, mock_event_bus):
        from backend.agents.chat_agent import ChatAgent

        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        prompt = agent._build_prompt([], {}, "genre")
        assert "genre" in prompt


class TestChatAgentConfidenceCalculation:
    """Test execute confidence calculation with varying completion counts."""

    @pytest.mark.asyncio
    async def test_execute_confidence_with_many_completed(self, mock_provider, mock_event_bus):
        from backend.agents.chat_agent import ChatAgent

        mock_provider.generate = AsyncMock(
            return_value=json.dumps({
                "next_question": "下一个问题",
                "extracted_settings": {},
                "completed_categories": ["genre", "worldview", "power_system", "protagonist"],
            })
        )
        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="test", settings={"collected_settings": {}, "current_category": "genre"})
        result = await agent.execute(context)

        # 4/12 = 0.333...
        assert 0.3 < result.confidence < 0.4

    @pytest.mark.asyncio
    async def test_execute_with_all_completed(self, mock_provider, mock_event_bus):
        from backend.agents.chat_agent import ChatAgent, SETTING_CATEGORIES

        mock_provider.generate = AsyncMock(
            return_value=json.dumps({
                "next_question": "全部完成",
                "extracted_settings": {},
                "completed_categories": list(SETTING_CATEGORIES),
            })
        )
        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="test", settings={"collected_settings": {}, "current_category": "genre"})
        result = await agent.execute(context)

        assert result.confidence == 1.0
        assert result.content["next_category"] == "complete"


# =============================================================================
# StyleAgent - Uncovered Paths
# =============================================================================

class TestStyleAgentAnalyzeFingerprint:
    """Test analyze_fingerprint full async flow."""

    @pytest.mark.asyncio
    async def test_analyze_fingerprint_with_ai_deep_analysis(self, mock_provider, mock_event_bus):
        from backend.agents.style_agent import StyleAgent

        call_count = 0

        async def mock_generate(prompt, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First call: style summary
                return '{"summary": "细腻风格", "keywords": ["比喻", "意象"]}'
            else:
                # Second call: deep analysis
                return json.dumps({
                    "sentence_patterns": {"fragment_ratio": 0.1},
                    "vocabulary_features": {"visual_imagery": "high"},
                    "rhetoric_preferences": ["比喻", "拟人"],
                    "emotion_tone": "restrained_melancholy",
                    "narrative_voice": "third_person_omniscient",
                })

        mock_provider.generate = AsyncMock(side_effect=mock_generate)
        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)

        text = "月亮像银盘一样挂在天上。花儿微笑着。他感到悲伤和绝望。"
        report = await agent.analyze_fingerprint(text)

        assert report.fingerprint.raw_summary == "细腻风格"
        assert report.fingerprint.ai_deep_analysis != {}
        assert report.detected_style in ["default", "江南", "卡夫卡", "加缪"]

    @pytest.mark.asyncio
    async def test_analyze_fingerprint_ai_deep_analysis_fails(self, mock_provider, mock_event_bus):
        """analyze_fingerprint handles AI deep analysis failure gracefully."""
        from backend.agents.style_agent import StyleAgent
        from backend.utils.exceptions import AIServiceError

        call_count = 0

        async def mock_generate(prompt, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return '{"summary": "test", "keywords": []}'
            raise AIServiceError("deep analysis failed")

        mock_provider.generate = AsyncMock(side_effect=mock_generate)
        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)

        report = await agent.analyze_fingerprint("测试文本。")
        assert report.fingerprint.ai_deep_analysis == {}
        assert report.detected_style is not None


class TestStyleAgentAdjustStyle:
    """Test adjust_style method."""

    @pytest.mark.asyncio
    async def test_adjust_style_with_target(self, mock_provider, mock_event_bus):
        from backend.agents.style_agent import StyleAgent

        mock_provider.generate = AsyncMock(return_value="调整后的文本")
        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)

        result = await agent.adjust_style("原始文本", "江南")
        assert result == "调整后的文本"

    @pytest.mark.asyncio
    async def test_adjust_style_with_context_constraints(self, mock_provider, mock_event_bus):
        from backend.agents.style_agent import StyleAgent

        mock_provider.generate = AsyncMock(return_value="调整后的文本")
        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)

        context = AgentContext(task="test", constraints=["保持第一人称", "不超过500字"])
        result = await agent.adjust_style("原始文本", "卡夫卡", context)
        assert result == "调整后的文本"

    @pytest.mark.asyncio
    async def test_adjust_style_unknown_preset_uses_default(self, mock_provider, mock_event_bus):
        from backend.agents.style_agent import StyleAgent

        mock_provider.generate = AsyncMock(return_value="调整后")
        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)

        result = await agent.adjust_style("原始文本", "unknown_style")
        assert result == "调整后"


class TestStyleAgentMigrationSuggestions:
    """Test migration_suggestions for different target styles.

    migration_suggestions calls analyze_fingerprint which triggers:
      1. _ai_style_summary -> provider.generate
      2. _ai_deep_analysis -> provider.generate
    Then migration_suggestions calls:
      3. _ai_migration_suggestions -> provider.generate
    So 3 total generate calls.
    """

    @pytest.mark.asyncio
    async def test_migration_suggestions_jiangnan(self, mock_provider, mock_event_bus):
        from backend.agents.style_agent import StyleAgent

        call_count = 0

        async def mock_generate(prompt, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # call 1: _ai_style_summary
                return '{"summary": "test", "keywords": []}'
            elif call_count == 2:
                # call 2: _ai_deep_analysis
                return '{"sentence_patterns": {}, "emotion_tone": "neutral"}'
            else:
                # call 3: _ai_migration_suggestions
                return "[]"

        mock_provider.generate = AsyncMock(side_effect=mock_generate)
        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)

        suggestions = await agent.migration_suggestions("短句。", "江南")
        assert isinstance(suggestions, list)

    @pytest.mark.asyncio
    async def test_migration_suggestions_camus(self, mock_provider, mock_event_bus):
        """Test migration suggestions targeting Camus style."""
        from backend.agents.style_agent import StyleAgent

        call_count = 0

        async def mock_generate(prompt, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return '{"summary": "test", "keywords": []}'
            elif call_count == 2:
                return '{"sentence_patterns": {}, "emotion_tone": "neutral"}'
            return "[]"

        mock_provider.generate = AsyncMock(side_effect=mock_generate)
        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)

        # Text with high rhetoric density should trigger Camus suggestions
        text = "月亮像银盘一样挂在天上。花儿微笑着。风叹息着。" * 5
        suggestions = await agent.migration_suggestions(text, "加缪")
        assert isinstance(suggestions, list)

    @pytest.mark.asyncio
    async def test_migration_suggestions_kafka(self, mock_provider, mock_event_bus):
        """Test migration suggestions for Kafka style with high emotion."""
        from backend.agents.style_agent import StyleAgent

        call_count = 0

        async def mock_generate(prompt, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return '{"summary": "test", "keywords": []}'
            elif call_count == 2:
                return '{"sentence_patterns": {}, "emotion_tone": "neutral"}'
            return "[]"

        mock_provider.generate = AsyncMock(side_effect=mock_generate)
        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)

        text = "他感到非常喜悦和快乐，心中充满希望和幸福。" * 5
        suggestions = await agent.migration_suggestions(text, "卡夫卡")
        assert isinstance(suggestions, list)


class TestStyleAgentMatchPresetWithAI:
    """Test _match_preset_style with AI deep analysis data."""

    def test_match_preset_kafka_with_cold_detachment(self, mock_provider, mock_event_bus):
        from backend.agents.style_agent import StyleAgent, StyleFingerprint

        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        fp = StyleFingerprint()
        fp.ai_deep_analysis = {
            "emotion_tone": "cold_detachment",
            "narrative_voice": "first_person_limited",
        }
        detected, confidence, comparison = agent._match_preset_style(fp)
        assert "卡夫卡" in comparison

    def test_match_preset_camus_with_fragments(self, mock_provider, mock_event_bus):
        from backend.agents.style_agent import StyleAgent, StyleFingerprint

        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        fp = StyleFingerprint()
        fp.ai_deep_analysis = {
            "sentence_patterns": {"fragment_ratio": 0.3},
            "rhetoric_preferences": ["极简"],
        }
        detected, confidence, comparison = agent._match_preset_style(fp)
        assert "加缪" in comparison

    def test_match_preset_jiangnan_with_visual_imagery(self, mock_provider, mock_event_bus):
        from backend.agents.style_agent import StyleAgent, StyleFingerprint

        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        fp = StyleFingerprint()
        fp.ai_deep_analysis = {
            "emotion_tone": "restrained_melancholy",
            "vocabulary_features": {"visual_imagery": "high"},
        }
        detected, confidence, comparison = agent._match_preset_style(fp)
        assert "江南" in comparison


# =============================================================================
# PlotAgent - Uncovered Paths
# =============================================================================

class TestPlotAgentPromptBuilders:
    """Test prompt content builders."""

    def test_build_foreshadowing_prompt_content_all_sections(self, mock_provider, mock_event_bus):
        from backend.agents.plot_agent import PlotAgent

        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        content = agent._build_foreshadowing_prompt_content(
            content="章节内容",
            outline={"title": "大纲"},
            chapters=[{"summary": "ch1"}, {"summary": "ch2"}],
            active_threads=[{"title": "线索1"}],
        )
        assert "故事大纲" in content
        assert "近期章节摘要" in content
        assert "活跃线索" in content
        assert "章节内容" in content

    def test_build_foreshadowing_prompt_content_minimal(self, mock_provider, mock_event_bus):
        from backend.agents.plot_agent import PlotAgent

        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        content = agent._build_foreshadowing_prompt_content(
            content="章节内容", outline={}, chapters=[], active_threads=[]
        )
        assert "章节内容" in content

    def test_build_climax_prompt_content_with_progress(self, mock_provider, mock_event_bus):
        from backend.agents.plot_agent import PlotAgent

        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        content = agent._build_climax_prompt_content(
            outline={"title": "大纲"},
            chapters=[{"summary": "ch1"}],
            progress=0.75,
            active_threads=[],
        )
        assert "75.0%" in content

    def test_build_rhythm_prompt_content(self, mock_provider, mock_event_bus):
        from backend.agents.plot_agent import PlotAgent

        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        content = agent._build_rhythm_prompt_content(
            chapters=[{"summary": "ch1"}],
            current_content="当前内容",
        )
        assert "章节序列" in content
        assert "当前内容" in content


class TestPlotAgentValidateResults:
    """Test result validation methods."""

    def test_validate_foreshadowing_result_non_dict_raises(self, mock_provider, mock_event_bus):
        from backend.agents.plot_agent import PlotAgent

        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        with pytest.raises(ValueError, match="Expected dict"):
            agent._validate_foreshadowing_result("not a dict")

    def test_validate_rhythm_result_non_dict_raises(self, mock_provider, mock_event_bus):
        from backend.agents.plot_agent import PlotAgent

        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        with pytest.raises(ValueError, match="Expected dict"):
            agent._validate_rhythm_result([1, 2, 3])

    def test_validate_rhythm_result_normalizes_data(self, mock_provider, mock_event_bus):
        from backend.agents.plot_agent import PlotAgent

        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        data = {
            "tension_curve": [{"chapter": "ch1", "tension_score": 7, "emotional_tone": "紧张", "pacing": "快"}],
            "analysis": {"overall_rhythm": "好", "peak_distribution": "均匀", "valley_distribution": "少", "transition_quality": "流畅"},
            "issues": [{"location": "ch3", "type": "pacing", "severity": "medium", "description": "节奏慢", "uggestion": "加快"}],
            "recommendations": ["增加冲突"],
        }
        result = agent._validate_rhythm_result(data)
        assert len(result["tension_curve"]) == 1
        assert result["tension_curve"][0]["tension_score"] == 7
        assert result["analysis"]["overall_rhythm"] == "好"
        assert len(result["issues"]) == 1

    def test_validate_hook_list_resolvable_mode(self, mock_provider, mock_event_bus):
        from backend.agents.plot_agent import PlotAgent

        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        hooks = [{"description": "伏笔1", "origin": "ch1", "suggested_resolution": "ch5", "urgency": "high"}]
        result = agent._validate_hook_list(hooks, resolvable=True)
        assert len(result) == 1
        assert result[0]["origin"] == "ch1"
        assert result[0]["urgency"] == "high"

    def test_validate_hook_list_thread_mode(self, mock_provider, mock_event_bus):
        from backend.agents.plot_agent import PlotAgent

        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        hooks = [{"description": "线索1", "risk": "高", "suggestion": "尽快处理"}]
        result = agent._validate_hook_list(hooks, thread=True)
        assert len(result) == 1
        assert result[0]["risk"] == "高"


class TestPlotAgentAIServiceError:
    """Test individual analysis AIServiceError handling."""

    @pytest.mark.asyncio
    async def test_execute_foreshadowing_aiservice_error(self, mock_provider, mock_event_bus):
        from backend.agents.plot_agent import PlotAgent
        from backend.utils.exceptions import AIServiceError

        mock_provider.generate = AsyncMock(side_effect=AIServiceError("API down"))
        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(
            task="foreshadowing",
            settings={"content": "test", "outline": {}, "chapters": [], "active_threads": []},
        )
        result = await agent.execute(context)

        assert "error" in result.content["foreshadowing"]
        assert result.metadata["analyses_failed"] == 1

    @pytest.mark.asyncio
    async def test_execute_all_analyses_fail(self, mock_provider, mock_event_bus):
        from backend.agents.plot_agent import PlotAgent
        from backend.utils.exceptions import AIServiceError

        mock_provider.generate = AsyncMock(side_effect=AIServiceError("API down"))
        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(
            task="full",
            settings={"content": "test", "outline": {}, "chapters": [], "active_threads": [], "progress": 0.5},
        )
        result = await agent.execute(context)

        assert result.confidence == 0.0
        assert "All analyses failed" in result.warnings


# =============================================================================
# ReviewAgent - Uncovered Paths
# =============================================================================

class TestReviewAgentDisagreements:
    """Test _find_disagreements edge cases."""

    def test_find_disagreements_issue_count_divergence(self, mock_provider, mock_event_bus):
        from backend.agents.review_agent import ReviewAgent

        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        quick = {"c1": CheckerResult(score=80, issues=[{"type": "t", "message": "m"}])}
        deep = {"c1": CheckerResult(score=80, issues=[
            {"type": "t1", "message": "m1"},
            {"type": "t2", "message": "m2"},
            {"type": "t3", "message": "m3"},
            {"type": "t4", "message": "m4"},
            {"type": "t5", "message": "m5"},
            {"type": "t6", "message": "m6"},
        ])}

        disagreements = agent._find_disagreements(quick, deep)
        issue_count_disagree = [d for d in disagreements if d["type"] == "issue_count_disagreement"]
        assert len(issue_count_disagree) >= 1

    def test_find_disagreements_missed_by_deep_analysis(self, mock_provider, mock_event_bus):
        from backend.agents.review_agent import ReviewAgent

        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        quick = {"c1": CheckerResult(score=80, issues=[{"type": "t", "message": "m"}])}
        deep = {"c1": CheckerResult(score=80, issues=[])}

        disagreements = agent._find_disagreements(quick, deep)
        missed = [d for d in disagreements if d["type"] == "missed_by_deep_analysis"]
        assert len(missed) == 1

    def test_find_disagreements_missed_by_quick_scan(self, mock_provider, mock_event_bus):
        from backend.agents.review_agent import ReviewAgent

        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        quick = {"c1": CheckerResult(score=80, issues=[])}
        deep = {"c1": CheckerResult(score=80, issues=[{"type": "t", "message": "m"}])}

        disagreements = agent._find_disagreements(quick, deep)
        missed = [d for d in disagreements if d["type"] == "missed_by_quick_scan"]
        assert len(missed) == 1


class TestReviewAgentConfidenceAdjustment:
    """Test confidence adjustment based on disagreement count."""

    @pytest.mark.asyncio
    async def test_execute_many_disagreements_reduces_confidence(self, mock_provider, mock_event_bus):
        from backend.agents.review_agent import ReviewAgent
        from backend.agents.checkers.pipeline import CheckerPipeline

        # Create checkers that will produce divergent results
        checkers = []
        for i in range(4):
            checker = MagicMock(spec=BaseChecker)
            checker.name = f"checker_{i}"
            checker.weight = 1.0
            checker.quick_scan = AsyncMock(return_value=CheckerResult(score=90, issues=[]))
            checker.deep_analyze = AsyncMock(return_value=CheckerResult(
                score=50,
                issues=[{"type": f"issue_{j}", "message": f"msg_{j}"} for j in range(5)],
            ))
            checkers.append(checker)

        pipeline = CheckerPipeline(checkers=checkers)
        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        agent.set_pipeline(pipeline)

        context = AgentContext(task="章节内容", settings={"context": {}})
        result = await agent.execute(context)

        # With many disagreements, confidence should be reduced
        assert result.confidence <= 0.70

    @pytest.mark.asyncio
    async def test_execute_moderate_disagreements_reduces_confidence(self, mock_provider, mock_event_bus):
        from backend.agents.review_agent import ReviewAgent
        from backend.agents.checkers.pipeline import CheckerPipeline

        checker = MagicMock(spec=BaseChecker)
        checker.name = "checker1"
        checker.weight = 1.0
        checker.quick_scan = AsyncMock(return_value=CheckerResult(score=90, issues=[]))
        checker.deep_analyze = AsyncMock(return_value=CheckerResult(
            score=65,
            issues=[{"type": "t", "message": "m"}],
        ))

        pipeline = CheckerPipeline(checkers=[checker])
        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        agent.set_pipeline(pipeline)

        context = AgentContext(task="章节内容", settings={"context": {}})
        result = await agent.execute(context)

        # Some disagreements should reduce confidence somewhat
        assert result.metadata["disagreement_count"] > 0


class TestReviewAgentManualAggregate:
    """Test _manual_aggregate severity boundaries."""

    def test_manual_aggregate_high_severity(self, mock_provider, mock_event_bus):
        from backend.agents.review_agent import ReviewAgent

        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        results = {"c1": CheckerResult(score=50)}
        result = agent._manual_aggregate(results)
        assert result["severity"] == "high"

    def test_manual_aggregate_critical_severity(self, mock_provider, mock_event_bus):
        from backend.agents.review_agent import ReviewAgent

        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        results = {"c1": CheckerResult(score=30)}
        result = agent._manual_aggregate(results)
        assert result["severity"] == "critical"


# =============================================================================
# StrandTracker - Uncovered Paths
# =============================================================================

class TestStrandTrackerAggregateData:
    """Test _aggregate_strand_data with outlines and IF lines."""

    @pytest.mark.asyncio
    async def test_analyze_with_outlines_and_if_lines(self):
        from backend.agents.strand_tracker import StrandTracker

        mock_chapters = []
        for i in range(3):
            ch = MagicMock()
            ch.id = i + 1
            ch.word_count = 2000
            ch.outline_id = 1
            mock_chapters.append(ch)

        mock_outlines = []
        outline = MagicMock()
        outline.id = 1
        outline.title = "主线大纲"
        mock_outlines.append(outline)

        mock_if_lines = []
        ifl = MagicMock()
        ifl.id = 1
        ifl.title = "IF线1"
        ifl.description = "平行世界"
        mock_if_lines.append(ifl)

        tracker = StrandTracker()
        report = await tracker.analyze(mock_chapters, outlines=mock_outlines, if_lines=mock_if_lines)

        assert report.total_word_count == 6000
        assert len(report.strand_ratios) > 0

    @pytest.mark.asyncio
    async def test_analyze_chapters_without_outline_id(self):
        """analyze assigns chapters without outline_id to main line as fallback."""
        from backend.agents.strand_tracker import StrandTracker

        ch = MagicMock()
        ch.id = 1
        ch.word_count = 3000
        ch.outline_id = None  # No outline

        tracker = StrandTracker()
        report = await tracker.analyze([ch])

        # Should fall back to main line
        main_ratios = [r for r in report.strand_ratios if r.strand_type == "main"]
        assert len(main_ratios) >= 1
        assert main_ratios[0].word_count == 3000


class TestStrandTrackerOperators:
    """Test _run_red_line_checks with various operators.

    Note: custom rules are MERGED with DEFAULT_RULES (not replaced).
    We use a non-overlapping target_type to isolate the custom rule.
    """

    def test_red_line_checks_operator_less_than(self):
        from backend.agents.strand_tracker import StrandTracker, StrandRatio

        tracker = StrandTracker(rules={
            "test_lt": {
                "name": "test less than",
                "threshold": 0.5,
                "severity": "warning",
                "target_type": "sub",
                "operator": "<",
            }
        })
        ratios = [
            StrandRatio(strand_id="main", strand_name="主线", strand_type="main", ratio=0.7, target_ratio=0.65),
            StrandRatio(strand_id="sub", strand_name="副线", strand_type="sub", ratio=0.3, target_ratio=0.15),
        ]
        checks = tracker._run_red_line_checks(ratios)
        lt_check = [c for c in checks if "less than" in c.rule_name]
        assert len(lt_check) == 1
        assert lt_check[0].passed is True  # 0.3 < 0.5

    def test_red_line_checks_operator_greater_than(self):
        from backend.agents.strand_tracker import StrandTracker, StrandRatio

        tracker = StrandTracker(rules={
            "test_gt": {
                "name": "test greater than",
                "threshold": 0.1,
                "severity": "warning",
                "target_type": "sub",
                "operator": ">",
            }
        })
        ratios = [
            StrandRatio(strand_id="main", strand_name="主线", strand_type="main", ratio=0.7, target_ratio=0.65),
            StrandRatio(strand_id="sub", strand_name="副线", strand_type="sub", ratio=0.3, target_ratio=0.15),
        ]
        checks = tracker._run_red_line_checks(ratios)
        gt_check = [c for c in checks if "greater than" in c.rule_name]
        assert len(gt_check) == 1
        assert gt_check[0].passed is True  # 0.3 > 0.1

    def test_red_line_checks_operator_equal(self):
        from backend.agents.strand_tracker import StrandTracker, StrandRatio

        tracker = StrandTracker(rules={
            "test_eq": {
                "name": "test equal",
                "threshold": 0.3,
                "severity": "info",
                "target_type": "sub",
                "operator": "==",
            }
        })
        ratios = [
            StrandRatio(strand_id="main", strand_name="主线", strand_type="main", ratio=0.7, target_ratio=0.65),
            StrandRatio(strand_id="sub", strand_name="副线", strand_type="sub", ratio=0.3, target_ratio=0.15),
        ]
        checks = tracker._run_red_line_checks(ratios)
        eq_check = [c for c in checks if "equal" in c.rule_name]
        assert len(eq_check) == 1
        assert eq_check[0].passed is True  # abs(0.3 - 0.3) < 0.01

    def test_red_line_checks_unknown_operator_passes(self):
        from backend.agents.strand_tracker import StrandTracker, StrandRatio

        tracker = StrandTracker(rules={
            "test_unknown": {
                "name": "test unknown",
                "threshold": 0.5,
                "severity": "info",
                "target_type": "sub",
                "operator": "~=",
            }
        })
        ratios = [
            StrandRatio(strand_id="main", strand_name="主线", strand_type="main", ratio=0.7, target_ratio=0.65),
            StrandRatio(strand_id="sub", strand_name="副线", strand_type="sub", ratio=0.3, target_ratio=0.15),
        ]
        checks = tracker._run_red_line_checks(ratios)
        unknown_check = [c for c in checks if "unknown" in c.rule_name]
        assert len(unknown_check) == 1
        assert unknown_check[0].passed is True  # unknown operator defaults to True


class TestStrandTrackerSummary:
    """Test _generate_summary for different health score ranges."""

    def test_generate_summary_good_health(self):
        from backend.agents.strand_tracker import StrandTracker, StrandRatio, RedLineCheck

        tracker = StrandTracker()
        ratios = [StrandRatio(strand_id="main", strand_name="主线", strand_type="main", ratio=0.7)]
        red_lines = [RedLineCheck(rule_name="test", passed=True, severity="info", message="ok", actual_value=0.7, threshold_value=0.6)]
        summary = tracker._generate_summary(ratios, red_lines, 0.9)
        assert "良好" in summary
        assert "全部通过" in summary

    def test_generate_summary_medium_health(self):
        from backend.agents.strand_tracker import StrandTracker, StrandRatio, RedLineCheck

        tracker = StrandTracker()
        ratios = [StrandRatio(strand_id="main", strand_name="主线", strand_type="main", ratio=0.5)]
        red_lines = [RedLineCheck(rule_name="test", passed=False, severity="warning", message="warn", actual_value=0.5, threshold_value=0.6)]
        summary = tracker._generate_summary(ratios, red_lines, 0.6)
        assert "一般" in summary
        assert "1 项未通过" in summary

    def test_generate_summary_poor_health(self):
        from backend.agents.strand_tracker import StrandTracker, StrandRatio, RedLineCheck

        tracker = StrandTracker()
        ratios = [StrandRatio(strand_id="main", strand_name="主线", strand_type="main", ratio=0.3)]
        red_lines = []
        summary = tracker._generate_summary(ratios, red_lines, 0.3)
        assert "较差" in summary


class TestStrandTrackerAdjustments:
    """Test _generate_adjustments for different strand types and red lines."""

    def test_generate_adjustments_for_sub_line_below_target(self):
        from backend.agents.strand_tracker import StrandTracker, StrandRatio

        tracker = StrandTracker()
        ratios = [
            StrandRatio(strand_id="sub_1", strand_name="副线A", strand_type="sub", ratio=0.05, target_ratio=0.15, deviation=-0.10),
        ]
        adjustments = tracker._generate_adjustments(ratios, [])
        assert len(adjustments) >= 1
        assert any("副线A" in a.suggestion for a in adjustments)

    def test_generate_adjustments_for_if_line_above_target(self):
        from backend.agents.strand_tracker import StrandTracker, StrandRatio

        tracker = StrandTracker()
        ratios = [
            StrandRatio(strand_id="if_1", strand_name="IF线1", strand_type="if", ratio=0.40, target_ratio=0.20, deviation=0.20),
        ]
        adjustments = tracker._generate_adjustments(ratios, [])
        assert len(adjustments) >= 1
        assert any("IF" in a.suggestion for a in adjustments)

    def test_generate_adjustments_for_main_line_above_target(self):
        from backend.agents.strand_tracker import StrandTracker, StrandRatio

        tracker = StrandTracker()
        ratios = [
            StrandRatio(strand_id="main", strand_name="主线", strand_type="main", ratio=0.85, target_ratio=0.65, deviation=0.20),
        ]
        adjustments = tracker._generate_adjustments(ratios, [])
        assert len(adjustments) >= 1
        assert any("主线" in a.suggestion and "偏高" in a.suggestion for a in adjustments)

    def test_generate_adjustments_skips_small_deviation(self):
        from backend.agents.strand_tracker import StrandTracker, StrandRatio

        tracker = StrandTracker()
        ratios = [
            StrandRatio(strand_id="main", strand_name="主线", strand_type="main", ratio=0.66, target_ratio=0.65, deviation=0.01),
        ]
        adjustments = tracker._generate_adjustments(ratios, [])
        assert len(adjustments) == 0


class TestStrandTrackerHealthScore:
    """Test _calculate_health_score with warning-level failures."""

    def test_health_score_warning_penalty(self):
        from backend.agents.strand_tracker import StrandTracker, StrandRatio, RedLineCheck

        tracker = StrandTracker()
        ratios = []
        red_lines = [
            RedLineCheck(rule_name="test", passed=False, severity="warning", message="warn", actual_value=0.3, threshold_value=0.6),
        ]
        score = tracker._calculate_health_score(ratios, red_lines)
        assert score == 0.9  # 1.0 - 0.1 (warning penalty)

    def test_health_score_multiple_penalties(self):
        from backend.agents.strand_tracker import StrandTracker, StrandRatio, RedLineCheck

        tracker = StrandTracker()
        ratios = [
            StrandRatio(strand_id="main", strand_name="主线", strand_type="main", ratio=0.3, target_ratio=0.65, deviation=-0.35),
        ]
        red_lines = [
            RedLineCheck(rule_name="r1", passed=False, severity="error", message="fail", actual_value=0.3, threshold_value=0.6),
            RedLineCheck(rule_name="r2", passed=False, severity="warning", message="warn", actual_value=0.4, threshold_value=0.3),
        ]
        score = tracker._calculate_health_score(ratios, red_lines)
        assert score < 0.5


class TestStrandTrackerCheckRedLines:
    """Test check_red_lines shortcut method."""

    @pytest.mark.asyncio
    async def test_check_red_lines_returns_only_checks(self):
        from backend.agents.strand_tracker import StrandTracker

        ch = MagicMock()
        ch.id = 1
        ch.word_count = 5000
        ch.outline_id = 1

        tracker = StrandTracker()
        checks = await tracker.check_red_lines([ch])
        assert isinstance(checks, list)
        assert all(hasattr(c, "passed") for c in checks)


# =============================================================================
# Utils - Uncovered Paths
# =============================================================================

class TestExtractJsonBracketMatching:
    """Test extract_json_from_response bracket matching."""

    def test_extract_json_array_with_surrounding_text(self):
        from backend.agents.utils import extract_json_from_response

        result = extract_json_from_response('Here is the data: [{"id": 1}, {"id": 2}] and more text')
        assert isinstance(result, list)
        assert len(result) == 2

    def test_extract_json_object_with_surrounding_text(self):
        from backend.agents.utils import extract_json_from_response

        result = extract_json_from_response('Result: {"key": "value"} done.')
        assert result == {"key": "value"}

    def test_extract_json_markdown_block_with_extra_text(self):
        from backend.agents.utils import extract_json_from_response

        result = extract_json_from_response('```json\n{"key": "value"}\n```\nSome extra text')
        assert result == {"key": "value"}


class TestValidateListResponseEdgeCases:
    """Test validate_list_response edge cases."""

    def test_validate_list_response_all_items_missing_keys(self):
        from backend.agents.utils import validate_list_response

        data = [{"name": "a"}, {"name": "b"}]
        result = validate_list_response(data, ["name", "type"])
        assert len(result) == 0

    def test_validate_list_response_mixed_valid_invalid(self):
        from backend.agents.utils import validate_list_response

        data = [
            {"name": "a", "type": "t", "extra": "ignored"},
            {"name": "b"},  # missing type
            {"name": "c", "type": "t"},
        ]
        result = validate_list_response(data, ["name", "type"])
        assert len(result) == 2

    def test_validate_list_response_nested_container(self):
        from backend.agents.utils import validate_list_response

        data = {"results": [{"name": "a", "type": "t"}], "other": "data"}
        result = validate_list_response(data, ["name", "type"], container_keys=["results"])
        assert len(result) == 1

    def test_validate_list_response_multiple_container_keys(self):
        from backend.agents.utils import validate_list_response

        data = {"items": [{"name": "a", "type": "t"}]}
        result = validate_list_response(data, ["name", "type"], container_keys=["results", "items"])
        assert len(result) == 1


class TestRetryExhaustion:
    """Test retry_with_exponential_backoff when all retries fail."""

    @pytest.mark.asyncio
    async def test_retry_raises_last_exception_on_exhaustion(self):
        import httpx
        from backend.agents.utils import retry_with_exponential_backoff

        call_count = 0

        async def always_fails():
            nonlocal call_count
            call_count += 1
            raise httpx.ConnectError("Connection refused")

        with pytest.raises(httpx.ConnectError):
            await retry_with_exponential_backoff(
                always_fails,
                max_retries=2,
                initial_delay=0.01,
                max_delay=0.05,
            )

        assert call_count == 3  # 1 initial + 2 retries

    @pytest.mark.asyncio
    async def test_retry_handles_timeout_exception(self):
        import httpx
        from backend.agents.utils import retry_with_exponential_backoff

        async def timeout_func():
            raise httpx.TimeoutException("Timeout")

        with pytest.raises(httpx.TimeoutException):
            await retry_with_exponential_backoff(
                timeout_func,
                max_retries=1,
                initial_delay=0.01,
            )

    @pytest.mark.asyncio
    async def test_retry_handles_http_status_error(self):
        import httpx
        from backend.agents.utils import retry_with_exponential_backoff

        async def http_error():
            response = MagicMock()
            response.status_code = 500
            raise httpx.HTTPStatusError("Server Error", request=MagicMock(), response=response)

        with pytest.raises(httpx.HTTPStatusError):
            await retry_with_exponential_backoff(
                http_error,
                max_retries=1,
                initial_delay=0.01,
            )


class TestRetryDecorator:
    """Test retry_decorator usage."""

    @pytest.mark.asyncio
    async def test_retry_decorator_success(self):
        from backend.agents.utils import retry_decorator

        @retry_decorator(max_retries=2, initial_delay=0.01)
        async def success():
            return "ok"

        result = await success()
        assert result == "ok"


# =============================================================================
# Checkers - Pipeline Error Handling
# =============================================================================

class TestPipelineCheckerAnalysisError:
    """Test _run_checker_safe with CheckerAnalysisError."""

    @pytest.mark.asyncio
    async def test_checker_analysis_error_returns_zero_score(self):
        from backend.agents.checkers.pipeline import CheckerPipeline
        from backend.utils.exceptions import CheckerAnalysisError

        checker = MagicMock(spec=BaseChecker)
        checker.name = "failing_checker"
        checker.quick_scan = AsyncMock(side_effect=CheckerAnalysisError("analysis failed"))

        pipeline = CheckerPipeline(checkers=[checker])
        results = await pipeline.run_quick_scan("content")

        assert results["failing_checker"].score == 0
        assert results["failing_checker"].failure_mode == "analysis_failed"

    @pytest.mark.asyncio
    async def test_collect_results_handles_base_exception(self):
        """_collect_results handles BaseException items defensively."""
        from backend.agents.checkers.pipeline import CheckerPipeline

        pipeline = CheckerPipeline(checkers=[])
        results = [RuntimeError("unexpected error")]
        collected = pipeline._collect_results(results)
        assert "unknown" in collected
        assert collected["unknown"].score == 0

    def test_aggregate_results_high_severity(self):
        """aggregate_results returns 'high' severity for score 40-59."""
        from backend.agents.checkers.pipeline import CheckerPipeline

        pipeline = CheckerPipeline(checkers=[])
        results = {"c1": CheckerResult(score=50)}
        aggregated = pipeline.aggregate_results(results)
        assert aggregated["severity"] == "high"


# =============================================================================
# Base - api_client Lazy Init
# =============================================================================

class TestDatabaseMixinApiClient:
    """Test DatabaseMixin.api_client lazy creation."""

    def test_api_client_lazy_creation(self, mock_ai_service):
        """api_client creates MiniMaxAPIClient on first access."""
        class TestAgent(DatabaseMixin):
            pass

        agent = TestAgent(ai_service=mock_ai_service)
        # Access api_client twice to test lazy creation
        client1 = agent.api_client
        client2 = agent.api_client
        assert client1 is client2  # Same instance
        assert client1.ai_service == mock_ai_service
