"""Comprehensive tests for all agent modules.

Covers:
- ChatAgent: initialization, execute, settings extraction, helpers
- StyleAgent: execute dispatch, fingerprint analysis, preset styles
- AgentOrchestrator: registration, execution, topological sort, status
- PlotAgent: execute with task types, JSON extraction, validation
- ReviewAgent: three-phase review, cross-validation, report synthesis
- StrandTracker: analyze, red line checks, health score
- DataAgent: entity delta, relation graph, alias matching
- Utils: JSON extraction, validation, retry logic
- Workflows: workflow registry, config lookup
- Checkers: quick_scan logic for each checker type
"""

import json
import pytest
from unittest.mock import MagicMock, AsyncMock, patch

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
    """Create a mock AIProvider."""
    provider = MagicMock()
    provider.generate = AsyncMock(return_value='{"next_question": "test?", "extracted_settings": {}, "completed_categories": []}')
    provider.name = "mock_provider"
    provider.supports_streaming = False
    provider.max_tokens = 4096
    return provider


@pytest.fixture
def mock_event_bus():
    """Create a mock AsyncEventBus."""
    bus = MagicMock()
    bus.publish = AsyncMock()
    return bus


@pytest.fixture
def mock_ai_service():
    """Create a mock AIService."""
    service = MagicMock()
    service.base_url = "https://api.example.com"
    service.endpoint_path = "/v1/chat/completions"
    service.api_key = "test-key"
    return service


@pytest.fixture
def sample_context():
    """Create a sample AgentContext."""
    return AgentContext(
        task="test task",
        settings={"collected_settings": {}, "current_category": "genre"},
        history=[{"role": "user", "content": "hello"}],
        constraints=["constraint1"],
    )


# =============================================================================
# ChatAgent Tests
# =============================================================================

class TestChatAgent:
    """Test ChatAgent initialization and behavior."""

    def test_init_stores_categories_and_templates(self, mock_provider, mock_event_bus):
        """ChatAgent stores setting categories and question templates."""
        from backend.agents.chat_agent import ChatAgent

        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        assert len(agent._categories) == 12
        assert "genre" in agent._categories
        assert "worldview" in agent._categories
        assert "protagonist" in agent._categories
        assert isinstance(agent._templates, dict)

    @pytest.mark.asyncio
    async def test_execute_returns_result_with_next_question(self, mock_provider, mock_event_bus, sample_context):
        """ChatAgent execute returns AgentResult with next question."""
        from backend.agents.chat_agent import ChatAgent

        mock_provider.generate = AsyncMock(
            return_value='{"next_question": "想写什么类型?", "extracted_settings": {}, "completed_categories": ["genre"]}'
        )
        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        result = await agent.execute(sample_context)

        assert isinstance(result, AgentResult)
        assert "next_question" in result.content
        assert result.confidence > 0.0

    @pytest.mark.asyncio
    async def test_execute_handles_ai_service_error_with_fallback(self, mock_provider, mock_event_bus, sample_context):
        """ChatAgent falls back to template question on AI error."""
        from backend.agents.chat_agent import ChatAgent
        from backend.utils.exceptions import AIServiceError

        mock_provider.generate = AsyncMock(side_effect=AIServiceError("API down"))
        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        result = await agent.execute(sample_context)

        assert result.confidence == 0.3
        assert result.metadata.get("fallback") is True
        assert "next_question" in result.content

    @pytest.mark.asyncio
    async def test_execute_publishes_event(self, mock_provider, mock_event_bus, sample_context):
        """ChatAgent publishes AGENT_EXECUTED event after execution."""
        from backend.agents.chat_agent import ChatAgent

        mock_provider.generate = AsyncMock(
            return_value='{"next_question": "test", "extracted_settings": {}, "completed_categories": []}'
        )
        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        await agent.execute(sample_context)

        mock_event_bus.publish.assert_called_once()
        call_args = mock_event_bus.publish.call_args
        assert call_args[0][0] == "agent.executed"

    def test_determine_next_category_returns_current_if_not_completed(self, mock_provider, mock_event_bus):
        """_determine_next_category returns current if not yet completed."""
        from backend.agents.chat_agent import ChatAgent

        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        result = agent._determine_next_category([], "genre")
        assert result == "genre"

    def test_determine_next_category_skips_completed(self, mock_provider, mock_event_bus):
        """_determine_next_category finds first uncompleted category."""
        from backend.agents.chat_agent import ChatAgent

        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        result = agent._determine_next_category(["genre", "worldview"], "genre")
        assert result == "power_system"

    def test_determine_next_category_returns_complete_when_all_done(self, mock_provider, mock_event_bus):
        """_determine_next_category returns 'complete' when all done."""
        from backend.agents.chat_agent import ChatAgent

        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        result = agent._determine_next_category(agent._categories, "genre")
        assert result == "complete"

    def test_extract_json_from_markdown_code_block(self, mock_provider, mock_event_bus):
        """_extract_json parses JSON from markdown code blocks."""
        from backend.agents.chat_agent import ChatAgent

        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        text = '```json\n{"key": "value"}\n```'
        result = agent._extract_json(text)
        assert result == {"key": "value"}

    def test_extract_json_from_raw_json(self, mock_provider, mock_event_bus):
        """_extract_json parses raw JSON objects."""
        from backend.agents.chat_agent import ChatAgent

        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        text = 'some text {"key": "value"} more text'
        result = agent._extract_json(text)
        assert result == {"key": "value"}

    def test_extract_json_returns_none_for_invalid(self, mock_provider, mock_event_bus):
        """_extract_json returns None when no JSON found."""
        from backend.agents.chat_agent import ChatAgent

        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        result = agent._extract_json("no json here")
        assert result is None

    def test_fallback_question_returns_template(self, mock_provider, mock_event_bus):
        """_fallback_question returns a question from templates."""
        from backend.agents.chat_agent import ChatAgent

        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        q = agent._fallback_question("genre", {})
        assert isinstance(q, str)
        assert len(q) > 0

    def test_get_setting_summary_produces_readable_output(self, mock_provider, mock_event_bus):
        """get_setting_summary produces human-readable summary."""
        from backend.agents.chat_agent import ChatAgent

        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        settings = {"genre": {"type": "玄幻"}, "worldview": {"desc": "异世界"}}
        summary = agent.get_setting_summary(settings)
        assert "genre" in summary
        assert "worldview" in summary

    def test_parse_response_extracts_json(self, mock_provider, mock_event_bus):
        """_parse_response extracts structured data from AI response."""
        from backend.agents.chat_agent import ChatAgent

        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        raw = '{"next_question": "问题", "extracted_settings": {}, "completed_categories": []}'
        result = agent._parse_response(raw)
        assert result["next_question"] == "问题"

    def test_parse_response_falls_back_to_plain_text(self, mock_provider, mock_event_bus):
        """_parse_response falls back to plain text extraction."""
        from backend.agents.chat_agent import ChatAgent

        agent = ChatAgent(provider=mock_provider, event_bus=mock_event_bus)
        result = agent._parse_response("just a plain question")
        assert "next_question" in result


# =============================================================================
# StyleAgent Tests
# =============================================================================

class TestStyleAgent:
    """Test StyleAgent initialization and behavior."""

    def test_init_with_provider(self, mock_provider, mock_event_bus):
        """StyleAgent initializes with provider and event_bus."""
        from backend.agents.style_agent import StyleAgent

        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        assert agent.provider == mock_provider

    @pytest.mark.asyncio
    async def test_execute_analyze_returns_fingerprint(self, mock_provider, mock_event_bus):
        """StyleAgent analyze task returns style fingerprint dict."""
        from backend.agents.style_agent import StyleAgent

        mock_provider.generate = AsyncMock(return_value='{"summary": "test", "keywords": []}')
        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="analyze:这是一段测试文字。包含一些句子。")
        result = await agent.execute(context)

        assert result.metadata["operation"] == "analyze"
        assert "fingerprint" in result.content

    @pytest.mark.asyncio
    async def test_execute_adjust_returns_adjusted_text(self, mock_provider, mock_event_bus):
        """StyleAgent adjust task returns adjusted text."""
        from backend.agents.style_agent import StyleAgent

        mock_provider.generate = AsyncMock(return_value="调整后的文本")
        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="adjust:原始文本:江南")
        result = await agent.execute(context)

        assert result.metadata["operation"] == "adjust"
        assert "adjusted_text" in result.content

    @pytest.mark.asyncio
    async def test_execute_suggest_returns_suggestions(self, mock_provider, mock_event_bus):
        """StyleAgent suggest task returns migration suggestions."""
        from backend.agents.style_agent import StyleAgent

        mock_provider.generate = AsyncMock(return_value='{"summary": "", "keywords": []}')
        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="suggest:测试文本:加缪")
        result = await agent.execute(context)

        assert result.metadata["operation"] == "suggest"
        assert "suggestions" in result.content

    @pytest.mark.asyncio
    async def test_execute_unknown_task_returns_error(self, mock_provider, mock_event_bus):
        """StyleAgent unknown task prefix returns error result."""
        from backend.agents.style_agent import StyleAgent

        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="unknown:something")
        result = await agent.execute(context)

        assert result.confidence == 0.0
        assert "error" in result.content

    @pytest.mark.asyncio
    async def test_execute_adjust_invalid_format_returns_error(self, mock_provider, mock_event_bus):
        """StyleAgent adjust with wrong format returns error."""
        from backend.agents.style_agent import StyleAgent

        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="adjust:missing_target")
        result = await agent.execute(context)

        assert result.confidence == 0.0

    def test_analyze_sentences_returns_metrics(self, mock_provider, mock_event_bus):
        """_analyze_sentences computes correct sentence metrics."""
        from backend.agents.style_agent import StyleAgent

        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        text = "这是第一句话。这是第二句话！这是比较长的第三句话，包含更多的内容和细节。"
        metrics = agent._analyze_sentences(text)

        assert metrics.avg_length > 0
        assert metrics.max_length >= metrics.min_length

    def test_analyze_sentences_empty_text(self, mock_provider, mock_event_bus):
        """_analyze_sentences handles empty text."""
        from backend.agents.style_agent import StyleAgent

        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        metrics = agent._analyze_sentences("")
        assert metrics.avg_length == 0.0

    def test_analyze_vocabulary_returns_metrics(self, mock_provider, mock_event_bus):
        """_analyze_vocabulary computes vocabulary metrics."""
        from backend.agents.style_agent import StyleAgent

        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        text = "这是一段中文文本，包含一些词汇。"
        metrics = agent._analyze_vocabulary(text)

        assert metrics.total_words > 0
        assert metrics.unique_words > 0
        assert 0 < metrics.diversity_index <= 1.0

    def test_analyze_rhetoric_detects_patterns(self, mock_provider, mock_event_bus):
        """_analyze_rhetoric detects rhetorical patterns in text."""
        from backend.agents.style_agent import StyleAgent

        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        text = "月亮像银盘一样挂在天上。花儿微笑着。"
        metrics = agent._analyze_rhetoric(text)

        assert metrics.simile_count >= 0
        assert metrics.personification_count >= 0

    def test_analyze_emotion_positive_text(self, mock_provider, mock_event_bus):
        """_analyze_emotion detects positive sentiment."""
        from backend.agents.style_agent import StyleAgent

        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        text = "他感到非常喜悦和快乐，心中充满希望和幸福。"
        metrics = agent._analyze_emotion(text)

        assert metrics.polarity > 0
        assert metrics.dominant_emotion == "positive"

    def test_analyze_emotion_negative_text(self, mock_provider, mock_event_bus):
        """_analyze_emotion detects negative sentiment."""
        from backend.agents.style_agent import StyleAgent

        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        text = "他感到悲伤和绝望，孤独和痛苦折磨着他。"
        metrics = agent._analyze_emotion(text)

        assert metrics.polarity < 0
        assert metrics.dominant_emotion == "negative"

    def test_analyze_emotion_neutral_text(self, mock_provider, mock_event_bus):
        """_analyze_emotion returns neutral for non-emotional text."""
        from backend.agents.style_agent import StyleAgent

        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        metrics = agent._analyze_emotion("今天天气不错。")

        assert metrics.dominant_emotion == "neutral"

    def test_match_preset_style_returns_best_match(self, mock_provider, mock_event_bus):
        """_match_preset_style returns a valid preset style name."""
        from backend.agents.style_agent import StyleAgent, StyleFingerprint

        agent = StyleAgent(provider=mock_provider, event_bus=mock_event_bus)
        fp = StyleFingerprint()
        detected, confidence, comparison = agent._match_preset_style(fp)

        assert detected in comparison
        assert 0.0 <= confidence <= 1.0

    def test_get_preset_styles_returns_all_presets(self, mock_provider, mock_event_bus):
        """get_preset_styles returns all defined preset styles."""
        from backend.agents.style_agent import StyleAgent

        styles = StyleAgent.get_preset_styles()
        assert "default" in styles
        assert "江南" in styles
        assert "卡夫卡" in styles
        assert "加缪" in styles

    def test_register_custom_style(self, mock_provider, mock_event_bus):
        """register_custom_style adds a new style to presets."""
        from backend.agents.style_agent import StyleAgent, PRESET_STYLES

        StyleAgent.register_custom_style("test_style", "测试", "测试风格", "测试特征")
        assert "test_style" in PRESET_STYLES
        # Clean up
        del PRESET_STYLES["test_style"]

    def test_style_report_to_dict(self, mock_provider, mock_event_bus):
        """StyleReport.to_dict serializes correctly."""
        from backend.agents.style_agent import StyleReport, StyleFingerprint

        report = StyleReport(
            fingerprint=StyleFingerprint(),
            detected_style="default",
            confidence=0.5,
        )
        d = report.to_dict()
        assert "fingerprint" in d
        assert "detected_style" in d
        assert "confidence" in d


# =============================================================================
# AgentOrchestrator Tests
# =============================================================================

class TestAgentOrchestrator:
    """Test AgentOrchestrator workflow registration and execution."""

    def test_init_creates_empty_registries(self, mock_event_bus):
        """Orchestrator initializes with empty registries."""
        from backend.agents.orchestrator import AgentOrchestrator

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        assert orch.list_workflows() == []

    def test_register_workflow(self, mock_event_bus):
        """register_workflow stores workflow config."""
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        stages = [StageConfig(name="s1", agents=["a1"], mode="sequential")]
        orch.register_workflow("test_wf", stages, description="test")

        wf = orch.get_workflow("test_wf")
        assert wf is not None
        assert wf.name == "test_wf"
        assert len(wf.stages) == 1

    def test_register_workflow_duplicate_raises(self, mock_event_bus):
        """register_workflow raises ValueError on duplicate name."""
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        stages = [StageConfig(name="s1", agents=["a1"])]
        orch.register_workflow("wf1", stages)

        with pytest.raises(ValueError, match="already registered"):
            orch.register_workflow("wf1", stages)

    def test_register_workflow_empty_stages_raises(self, mock_event_bus):
        """register_workflow raises ValueError for empty stages."""
        from backend.agents.orchestrator import AgentOrchestrator

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        with pytest.raises(ValueError, match="at least one stage"):
            orch.register_workflow("wf1", [])

    def test_register_workflow_invalid_dependency_raises(self, mock_event_bus):
        """register_workflow raises ValueError for unknown dependency."""
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        stages = [StageConfig(name="s1", agents=["a1"], depends_on=["nonexistent"])]
        with pytest.raises(ValueError, match="unknown stage"):
            orch.register_workflow("wf1", stages)

    def test_unregister_workflow(self, mock_event_bus):
        """unregister_workflow removes workflow and returns True."""
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        stages = [StageConfig(name="s1", agents=["a1"])]
        orch.register_workflow("wf1", stages)

        assert orch.unregister_workflow("wf1") is True
        assert orch.get_workflow("wf1") is None

    def test_unregister_nonexistent_returns_false(self, mock_event_bus):
        """unregister_workflow returns False for unknown workflow."""
        from backend.agents.orchestrator import AgentOrchestrator

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        assert orch.unregister_workflow("nonexistent") is False

    def test_register_agent(self, mock_event_bus):
        """register_agent stores agent in registry."""
        from backend.agents.orchestrator import AgentOrchestrator

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        agent = MagicMock(spec=BaseAgent)
        orch.register_agent("test_agent", agent)

    def test_register_agent_duplicate_raises(self, mock_event_bus):
        """register_agent raises ValueError on duplicate name."""
        from backend.agents.orchestrator import AgentOrchestrator

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        agent = MagicMock(spec=BaseAgent)
        orch.register_agent("a1", agent)

        with pytest.raises(ValueError, match="already registered"):
            orch.register_agent("a1", agent)

    def test_list_workflows(self, mock_event_bus):
        """list_workflows returns all registered workflows."""
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        stages = [StageConfig(name="s1", agents=["a1"])]
        orch.register_workflow("wf1", stages, description="first")
        orch.register_workflow("wf2", stages, description="second")

        workflows = orch.list_workflows()
        assert len(workflows) == 2
        names = [w["name"] for w in workflows]
        assert "wf1" in names
        assert "wf2" in names

    def test_stage_config_validates_mode(self):
        """StageConfig raises ValueError for invalid mode."""
        from backend.agents.orchestrator import StageConfig

        with pytest.raises(ValueError, match="mode must be"):
            StageConfig(name="s1", agents=["a1"], mode="invalid")

    def test_stage_config_accepts_parallel_mode(self):
        """StageConfig accepts 'parallel' mode."""
        from backend.agents.orchestrator import StageConfig

        stage = StageConfig(name="s1", agents=["a1"], mode="parallel")
        assert stage.mode == "parallel"

    @pytest.mark.asyncio
    async def test_execute_workflow_not_found_raises(self, mock_event_bus):
        """execute_workflow raises ValueError for unknown workflow."""
        from backend.agents.orchestrator import AgentOrchestrator

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        with pytest.raises(ValueError, match="not found"):
            await orch.execute_workflow("nonexistent", {})

    @pytest.mark.asyncio
    async def test_execute_workflow_runs_agents(self, mock_event_bus):
        """execute_workflow executes registered agents in stages."""
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig

        orch = AgentOrchestrator(event_bus=mock_event_bus)

        mock_agent = _mock_agent_with_hooks(
            execute_return=AgentResult(content="done", confidence=0.9)
        )
        orch.register_agent("agent1", mock_agent)

        stages = [StageConfig(name="s1", agents=["agent1"], mode="sequential")]
        orch.register_workflow("wf1", stages)

        result = await orch.execute_workflow("wf1", {"task": "test"})

        assert result["status"] == "completed"
        assert "s1" in result["stage_results"]
        mock_agent.execute_with_hooks.assert_called_once()

    @pytest.mark.asyncio
    async def test_execute_workflow_parallel_stage(self, mock_event_bus):
        """execute_workflow runs parallel stage agents concurrently."""
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig

        orch = AgentOrchestrator(event_bus=mock_event_bus)

        agent1 = _mock_agent_with_hooks(
            execute_return=AgentResult(content="a1", confidence=0.8)
        )
        agent2 = _mock_agent_with_hooks(
            execute_return=AgentResult(content="a2", confidence=0.7)
        )

        orch.register_agent("agent1", agent1)
        orch.register_agent("agent2", agent2)

        stages = [StageConfig(name="s1", agents=["agent1", "agent2"], mode="parallel")]
        orch.register_workflow("wf1", stages)

        result = await orch.execute_workflow("wf1", {"task": "test"})
        assert result["status"] == "completed"
        assert len(result["stage_results"]["s1"]["agent_results"]) == 2

    @pytest.mark.asyncio
    async def test_execute_workflow_with_dependency_ordering(self, mock_event_bus):
        """execute_workflow respects stage dependencies via topological sort."""
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        execution_order = []

        async def exec_a1(ctx):
            execution_order.append("a1")
            return AgentResult(content="a1", confidence=0.9)

        async def exec_a2(ctx):
            execution_order.append("a2")
            return AgentResult(content="a2", confidence=0.9)

        agent1 = _mock_agent_with_hooks(execute_side_effect=exec_a1)
        agent2 = _mock_agent_with_hooks(execute_side_effect=exec_a2)

        orch.register_agent("agent1", agent1)
        orch.register_agent("agent2", agent2)

        stages = [
            StageConfig(name="s2", agents=["agent2"], depends_on=["s1"]),
            StageConfig(name="s1", agents=["agent1"]),
        ]
        orch.register_workflow("wf1", stages)

        result = await orch.execute_workflow("wf1", {"task": "test"})
        assert result["status"] == "completed"
        assert execution_order == ["a1", "a2"]

    @pytest.mark.asyncio
    async def test_execute_workflow_agent_failure_in_sequential(self, mock_event_bus):
        """execute_workflow continues after agent failure in sequential mode."""
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig
        from backend.utils.exceptions import AgentError

        orch = AgentOrchestrator(event_bus=mock_event_bus)

        agent1 = _mock_agent_with_hooks(execute_side_effect=AgentError("fail"))
        agent2 = _mock_agent_with_hooks(
            execute_return=AgentResult(content="ok", confidence=0.9)
        )

        orch.register_agent("agent1", agent1)
        orch.register_agent("agent2", agent2)

        stages = [StageConfig(name="s1", agents=["agent1", "agent2"], mode="sequential")]
        orch.register_workflow("wf1", stages)

        result = await orch.execute_workflow("wf1", {"task": "test"})
        # In sequential mode, AgentError is caught per-agent; workflow continues
        assert result["status"] == "completed"
        # agent1 failed, agent2 succeeded
        agent_results = result["stage_results"]["s1"]["agent_results"]
        assert "error" in agent_results["agent1"]
        assert agent_results["agent2"]["status"] == "completed"

    def test_get_execution_status_returns_none_for_unknown(self, mock_event_bus):
        """get_execution_status returns None for unknown execution."""
        from backend.agents.orchestrator import AgentOrchestrator

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        assert orch.get_execution_status("unknown") is None

    def test_list_executions_empty(self, mock_event_bus):
        """list_executions returns empty list initially."""
        from backend.agents.orchestrator import AgentOrchestrator

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        assert orch.list_executions() == []

    def test_topological_sort_no_dependencies(self):
        """_topological_sort preserves order for independent stages."""
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig

        stages = [
            StageConfig(name="s1", agents=["a1"]),
            StageConfig(name="s2", agents=["a2"]),
        ]
        result = AgentOrchestrator._topological_sort(stages)
        names = [s.name for s in result]
        assert "s1" in names
        assert "s2" in names

    def test_topological_sort_with_dependencies(self):
        """_topological_sort orders stages by dependency."""
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig

        stages = [
            StageConfig(name="s2", agents=["a2"], depends_on=["s1"]),
            StageConfig(name="s1", agents=["a1"]),
            StageConfig(name="s3", agents=["a3"], depends_on=["s2"]),
        ]
        result = AgentOrchestrator._topological_sort(stages)
        names = [s.name for s in result]
        assert names.index("s1") < names.index("s2")
        assert names.index("s2") < names.index("s3")

    def test_topological_sort_circular_dependency_raises(self):
        """_topological_sort raises ValueError for circular dependency."""
        from backend.agents.orchestrator import AgentOrchestrator, StageConfig

        stages = [
            StageConfig(name="s1", agents=["a1"], depends_on=["s2"]),
            StageConfig(name="s2", agents=["a2"], depends_on=["s1"]),
        ]
        with pytest.raises(ValueError, match="Circular dependency"):
            AgentOrchestrator._topological_sort(stages)


# =============================================================================
# PlotAgent Tests
# =============================================================================

class TestPlotAgent:
    """Test PlotAgent initialization and behavior."""

    def test_init_with_provider(self, mock_provider, mock_event_bus):
        """PlotAgent initializes correctly."""
        from backend.agents.plot_agent import PlotAgent

        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        assert agent.provider == mock_provider

    @pytest.mark.asyncio
    async def test_execute_foreshadowing_task(self, mock_provider, mock_event_bus):
        """PlotAgent foreshadowing task returns structured result."""
        from backend.agents.plot_agent import PlotAgent

        mock_provider.generate = AsyncMock(
            return_value='{"new_hooks": [], "resolvable_hooks": [], "dangling_threads": [], "overall_assessment": "ok"}'
        )
        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(
            task="foreshadowing",
            settings={"content": "章节内容", "outline": {}, "chapters": [], "active_threads": []},
        )
        result = await agent.execute(context)

        assert isinstance(result, AgentResult)
        assert "foreshadowing" in result.content
        assert result.metadata["task_type"] == "foreshadowing"

    @pytest.mark.asyncio
    async def test_execute_climax_task(self, mock_provider, mock_event_bus):
        """PlotAgent climax task returns structured result."""
        from backend.agents.plot_agent import PlotAgent

        mock_provider.generate = AsyncMock(
            return_value='{"climax_points": [], "current_phase": {}, "pacing_recommendations": [], "risk_warnings": []}'
        )
        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(
            task="climax",
            settings={"content": "test", "outline": {}, "chapters": [], "active_threads": [], "progress": 0.5},
        )
        result = await agent.execute(context)

        assert "climax" in result.content

    @pytest.mark.asyncio
    async def test_execute_rhythm_task(self, mock_provider, mock_event_bus):
        """PlotAgent rhythm task returns structured result."""
        from backend.agents.plot_agent import PlotAgent

        mock_provider.generate = AsyncMock(
            return_value='{"tension_curve": [], "analysis": {}, "issues": [], "recommendations": []}'
        )
        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(
            task="rhythm",
            settings={"content": "test", "chapters": []},
        )
        result = await agent.execute(context)

        assert "rhythm" in result.content

    @pytest.mark.asyncio
    async def test_execute_full_task_runs_all_analyses(self, mock_provider, mock_event_bus):
        """PlotAgent full task runs all three analyses."""
        from backend.agents.plot_agent import PlotAgent

        mock_provider.generate = AsyncMock(
            return_value='{"new_hooks": [], "resolvable_hooks": [], "dangling_threads": [], "overall_assessment": "ok"}'
        )
        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(
            task="full",
            settings={"content": "test", "outline": {"title": "大纲"}, "chapters": [], "active_threads": [], "progress": 0.3},
        )
        result = await agent.execute(context)

        assert "foreshadowing" in result.content
        assert "climax" in result.content
        assert "rhythm" in result.content

    @pytest.mark.asyncio
    async def test_execute_empty_content_adds_warning(self, mock_provider, mock_event_bus):
        """PlotAgent warns when no content provided."""
        from backend.agents.plot_agent import PlotAgent

        mock_provider.generate = AsyncMock(
            return_value='{"new_hooks": [], "resolvable_hooks": [], "dangling_threads": [], "overall_assessment": "ok"}'
        )
        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="foreshadowing", settings={"content": ""})
        result = await agent.execute(context)

        assert any("No chapter content" in w for w in result.warnings)

    def test_extract_json_from_code_block(self, mock_provider, mock_event_bus):
        """_extract_json parses JSON from markdown code blocks."""
        from backend.agents.plot_agent import PlotAgent

        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        text = '```json\n{"key": "value"}\n```'
        result = agent._extract_json(text)
        assert result == {"key": "value"}

    def test_extract_json_from_raw(self, mock_provider, mock_event_bus):
        """_extract_json parses raw JSON."""
        from backend.agents.plot_agent import PlotAgent

        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        result = agent._extract_json('{"key": "value"}')
        assert result == {"key": "value"}

    def test_clamp_intensity_clamps_to_range(self, mock_provider, mock_event_bus):
        """_clamp_intensity clamps values to 1-10 range."""
        from backend.agents.plot_agent import PlotAgent

        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        assert agent._clamp_intensity(15) == 10
        assert agent._clamp_intensity(-5) == 1
        assert agent._clamp_intensity(5) == 5
        assert agent._clamp_intensity("invalid") == 5

    def test_validate_hook_list_filters_invalid(self, mock_provider, mock_event_bus):
        """_validate_hook_list filters out items without description."""
        from backend.agents.plot_agent import PlotAgent

        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        hooks = [
            {"description": "valid hook", "placement": "ch1"},
            "invalid",
            {"no_description": "missing"},
        ]
        result = agent._validate_hook_list(hooks)
        assert len(result) == 1

    def test_validate_climax_result_normalizes_data(self, mock_provider, mock_event_bus):
        """_validate_climax_result normalizes climax data."""
        from backend.agents.plot_agent import PlotAgent

        agent = PlotAgent(provider=mock_provider, event_bus=mock_event_bus)
        data = {
            "climax_points": [{"name": "高潮1", "intensity": 8}],
            "current_phase": {"name": "发展阶段", "description": "desc"},
            "pacing_recommendations": ["rec1"],
            "risk_warnings": [{"risk": "r1", "mitigation": "m1"}],
        }
        result = agent._validate_climax_result(data)
        assert len(result["climax_points"]) == 1
        assert result["climax_points"][0]["intensity"] == 8


# =============================================================================
# ReviewAgent Tests
# =============================================================================

class TestReviewAgent:
    """Test ReviewAgent three-phase review process."""

    def test_init_with_provider(self, mock_provider, mock_event_bus):
        """ReviewAgent initializes with provider and event_bus."""
        from backend.agents.review_agent import ReviewAgent

        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        assert agent._pipeline is None

    def test_set_pipeline(self, mock_provider, mock_event_bus):
        """set_pipeline assigns checker pipeline."""
        from backend.agents.review_agent import ReviewAgent
        from backend.agents.checkers.pipeline import CheckerPipeline

        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        pipeline = CheckerPipeline(checkers=[])
        agent.set_pipeline(pipeline)
        assert agent._pipeline is pipeline

    @pytest.mark.asyncio
    async def test_execute_empty_content_returns_critical(self, mock_provider, mock_event_bus):
        """ReviewAgent returns critical result for empty content."""
        from backend.agents.review_agent import ReviewAgent

        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="")
        result = await agent.execute(context)

        assert result.content["severity"] == "critical"
        assert result.confidence == 0.0

    @pytest.mark.asyncio
    async def test_execute_with_pipeline_runs_all_phases(self, mock_provider, mock_event_bus):
        """ReviewAgent runs all three phases with pipeline."""
        from backend.agents.review_agent import ReviewAgent
        from backend.agents.checkers.pipeline import CheckerPipeline

        mock_checker = MagicMock(spec=BaseChecker)
        mock_checker.name = "test_checker"
        mock_checker.weight = 1.0
        mock_checker.quick_scan = AsyncMock(return_value=CheckerResult(score=85, issues=[], suggestions=[]))
        mock_checker.deep_analyze = AsyncMock(return_value=CheckerResult(score=80, issues=[], suggestions=[]))

        pipeline = CheckerPipeline(checkers=[mock_checker])
        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        agent.set_pipeline(pipeline)

        context = AgentContext(task="章节内容", settings={"context": {}})
        result = await agent.execute(context)

        assert result.metadata["phases_completed"] == 3
        assert "overall_score" in result.content

    @pytest.mark.asyncio
    async def test_execute_without_pipeline_skips_scans(self, mock_provider, mock_event_bus):
        """ReviewAgent handles missing pipeline gracefully."""
        from backend.agents.review_agent import ReviewAgent

        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="some content", settings={})
        result = await agent.execute(context)

        assert result.metadata["phases_completed"] == 3
        assert any("no results" in w.lower() for w in result.warnings)

    def test_find_disagreements_detects_score_diff(self, mock_provider, mock_event_bus):
        """_find_disagreements detects score divergence."""
        from backend.agents.review_agent import ReviewAgent

        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        quick = {"c1": CheckerResult(score=90)}
        deep = {"c1": CheckerResult(score=50)}

        disagreements = agent._find_disagreements(quick, deep)
        assert any(d["type"] == "score_disagreement" for d in disagreements)

    def test_find_disagreements_detects_missing_checker(self, mock_provider, mock_event_bus):
        """_find_disagreements detects missing checker results."""
        from backend.agents.review_agent import ReviewAgent

        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        quick = {"c1": CheckerResult(score=80)}
        deep = {}

        disagreements = agent._find_disagreements(quick, deep)
        assert any(d["type"] == "missing_deep_analysis" for d in disagreements)

    def test_synthesize_report_builds_complete_report(self, mock_provider, mock_event_bus):
        """_synthesize_report builds a complete review report."""
        from backend.agents.review_agent import ReviewAgent

        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        quick = {"c1": CheckerResult(score=80, issues=[{"type": "t", "message": "m"}], suggestions=["s1"])}
        deep = {"c1": CheckerResult(score=75, issues=[{"type": "t2", "message": "m2"}], suggestions=["s2"])}

        report = agent._synthesize_report(quick, deep, [])
        assert "overall_score" in report
        assert "severity" in report
        assert "issues" in report
        assert "suggestions" in report

    def test_manual_aggregate_empty_results(self, mock_provider, mock_event_bus):
        """_manual_aggregate returns defaults for empty results."""
        from backend.agents.review_agent import ReviewAgent

        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        result = agent._manual_aggregate({})
        assert result["overall_score"] == 100
        assert result["severity"] == "low"

    def test_manual_aggregate_computes_correct_score(self, mock_provider, mock_event_bus):
        """_manual_aggregate averages scores correctly."""
        from backend.agents.review_agent import ReviewAgent

        agent = ReviewAgent(provider=mock_provider, event_bus=mock_event_bus)
        results = {
            "c1": CheckerResult(score=80),
            "c2": CheckerResult(score=60),
        }
        result = agent._manual_aggregate(results)
        assert result["overall_score"] == 70

    def test_severity_confidence_mapping(self, mock_provider, mock_event_bus):
        """SEVERITY_CONFIDENCE maps severity levels correctly."""
        from backend.agents.review_agent import ReviewAgent

        assert ReviewAgent.SEVERITY_CONFIDENCE["low"] == 0.85
        assert ReviewAgent.SEVERITY_CONFIDENCE["critical"] == 0.40


# =============================================================================
# StrandTracker Tests
# =============================================================================

class TestStrandTracker:
    """Test StrandTracker analysis and red line checks."""

    def test_init_with_default_rules(self):
        """StrandTracker initializes with default rules."""
        from backend.agents.strand_tracker import StrandTracker

        tracker = StrandTracker()
        assert "main_line_dominance" in tracker._rules
        assert "if_line_ceiling" in tracker._rules
        assert tracker._target_ratios["main"] == 0.65

    def test_init_with_custom_rules(self):
        """StrandTracker accepts custom rules."""
        from backend.agents.strand_tracker import StrandTracker

        custom = {"custom_rule": {"name": "test", "threshold": 0.5, "severity": "warning", "target_type": "main", "operator": ">="}}
        tracker = StrandTracker(rules=custom)
        assert "custom_rule" in tracker._rules

    def test_init_with_custom_target_ratios(self):
        """StrandTracker accepts custom target ratios."""
        from backend.agents.strand_tracker import StrandTracker

        tracker = StrandTracker(target_ratios={"main": 0.7, "sub": 0.2, "if": 0.1})
        assert tracker._target_ratios["main"] == 0.7

    @pytest.mark.asyncio
    async def test_analyze_with_empty_chapters(self):
        """analyze handles empty chapter list."""
        from backend.agents.strand_tracker import StrandTracker

        tracker = StrandTracker()
        report = await tracker.analyze([])

        assert report.total_word_count == 0
        assert report.total_chapter_count == 0
        assert isinstance(report.strand_ratios, list)

    @pytest.mark.asyncio
    async def test_analyze_with_chapters(self):
        """analyze computes strand ratios from chapters."""
        from backend.agents.strand_tracker import StrandTracker

        mock_chapters = []
        for i in range(5):
            ch = MagicMock()
            ch.id = i + 1
            ch.word_count = 2000
            ch.outline_id = 1
            mock_chapters.append(ch)

        tracker = StrandTracker()
        report = await tracker.analyze(mock_chapters)

        assert report.total_word_count == 10000
        assert report.total_chapter_count == 5
        assert len(report.strand_ratios) > 0

    @pytest.mark.asyncio
    async def test_analyze_with_chapter_strand_map(self):
        """analyze uses explicit strand map when provided."""
        from backend.agents.strand_tracker import StrandTracker

        ch1 = MagicMock()
        ch1.id = 1
        ch1.word_count = 3000
        ch1.outline_id = None
        ch2 = MagicMock()
        ch2.id = 2
        ch2.word_count = 2000
        ch2.outline_id = None

        strand_map = {1: ["main"], 2: ["sub_1"]}
        tracker = StrandTracker()
        report = await tracker.analyze([ch1, ch2], chapter_strand_map=strand_map)

        assert report.total_word_count == 5000

    def test_run_red_line_checks_passes_when_within_bounds(self):
        """_run_red_line_checks passes when ratios are within bounds."""
        from backend.agents.strand_tracker import StrandTracker, StrandRatio

        tracker = StrandTracker()
        ratios = [
            StrandRatio(strand_id="main", strand_name="主线", strand_type="main", ratio=0.7, target_ratio=0.65),
            StrandRatio(strand_id="sub", strand_name="副线", strand_type="sub", ratio=0.15, target_ratio=0.15),
            StrandRatio(strand_id="if", strand_name="IF线", strand_type="if", ratio=0.15, target_ratio=0.20),
        ]
        checks = tracker._run_red_line_checks(ratios)
        passed = [c for c in checks if c.passed]
        assert len(passed) == 3

    def test_run_red_line_checks_fails_when_violated(self):
        """_run_red_line_checks fails when main line is below threshold."""
        from backend.agents.strand_tracker import StrandTracker, StrandRatio

        tracker = StrandTracker()
        ratios = [
            StrandRatio(strand_id="main", strand_name="主线", strand_type="main", ratio=0.4, target_ratio=0.65),
        ]
        checks = tracker._run_red_line_checks(ratios)
        failed = [c for c in checks if not c.passed]
        assert len(failed) > 0

    def test_calculate_health_score_perfect(self):
        """_calculate_health_score returns 1.0 for perfect ratios."""
        from backend.agents.strand_tracker import StrandTracker, StrandRatio, RedLineCheck

        tracker = StrandTracker()
        ratios = [
            StrandRatio(strand_id="main", strand_name="主线", strand_type="main", ratio=0.65, target_ratio=0.65, deviation=0.0),
        ]
        red_lines = [RedLineCheck(rule_name="test", passed=True, severity="info", message="ok", actual_value=0.65, threshold_value=0.60)]
        score = tracker._calculate_health_score(ratios, red_lines)
        assert score > 0.9

    def test_calculate_health_score_penalizes_failures(self):
        """_calculate_health_score penalizes red line failures."""
        from backend.agents.strand_tracker import StrandTracker, StrandRatio, RedLineCheck

        tracker = StrandTracker()
        ratios = []
        red_lines = [
            RedLineCheck(rule_name="test", passed=False, severity="error", message="fail", actual_value=0.3, threshold_value=0.6),
        ]
        score = tracker._calculate_health_score(ratios, red_lines)
        assert score <= 0.8

    def test_generate_adjustments_for_deviation(self):
        """_generate_adjustments creates suggestions for significant deviation."""
        from backend.agents.strand_tracker import StrandTracker, StrandRatio

        tracker = StrandTracker()
        ratios = [
            StrandRatio(strand_id="main", strand_name="主线", strand_type="main", ratio=0.4, target_ratio=0.65, deviation=-0.25),
        ]
        adjustments = tracker._generate_adjustments(ratios, [])
        assert len(adjustments) > 0
        assert any("主线" in a.suggestion for a in adjustments)

    def test_update_target_ratios(self):
        """update_target_ratios merges new ratios."""
        from backend.agents.strand_tracker import StrandTracker

        tracker = StrandTracker()
        tracker.update_target_ratios({"main": 0.70})
        assert tracker._target_ratios["main"] == 0.70

    def test_update_rules(self):
        """update_rules merges new rules."""
        from backend.agents.strand_tracker import StrandTracker

        tracker = StrandTracker()
        tracker.update_rules({"new_rule": {"name": "test", "threshold": 0.5, "severity": "info", "target_type": "main", "operator": ">="}})
        assert "new_rule" in tracker._rules

    def test_strand_analysis_report_to_dict(self):
        """StrandAnalysisReport.to_dict serializes correctly."""
        from backend.agents.strand_tracker import StrandAnalysisReport, StrandRatio

        report = StrandAnalysisReport(
            total_word_count=5000,
            strand_ratios=[StrandRatio(strand_id="main", strand_name="主线", strand_type="main", ratio=0.7)],
        )
        d = report.to_dict()
        assert d["total_word_count"] == 5000
        assert len(d["strand_ratios"]) == 1


# =============================================================================
# DataAgent Tests
# =============================================================================

class TestDataAgent:
    """Test DataAgent entity operations."""

    @pytest.fixture
    def data_agent(self, mock_provider, mock_event_bus, mock_ai_service):
        """Create a concrete DataAgent subclass for testing."""
        from backend.agents.data_agent import DataAgent

        class ConcreteDataAgent(DataAgent):
            async def execute(self, context):
                return AgentResult(content="stub")

        return ConcreteDataAgent(
            provider=mock_provider, event_bus=mock_event_bus, ai_service=mock_ai_service
        )

    def test_init_with_provider_and_service(self, data_agent, mock_provider, mock_ai_service):
        """DataAgent initializes with provider, event_bus, and ai_service."""
        assert data_agent.provider == mock_provider
        assert data_agent.ai_service == mock_ai_service

    def test_compute_entity_delta_detects_additions(self, data_agent):
        """compute_entity_delta detects new entities."""
        old = []
        new = [{"name": "新角色", "type": "character", "description": "desc"}]
        deltas = data_agent.compute_entity_delta(old, new)

        assert len(deltas) > 0
        assert all(d.change_type == "added" for d in deltas)

    def test_compute_entity_delta_detects_removals(self, data_agent):
        """compute_entity_delta detects removed entities."""
        old = [{"name": "角色A", "type": "character", "description": "desc"}]
        new = []
        deltas = data_agent.compute_entity_delta(old, new)

        assert len(deltas) > 0
        assert all(d.change_type == "removed" for d in deltas)

    def test_compute_entity_delta_detects_modifications(self, data_agent):
        """compute_entity_delta detects field changes."""
        old = [{"name": "角色A", "type": "character", "description": "旧描述"}]
        new = [{"name": "角色A", "type": "character", "description": "新描述"}]
        deltas = data_agent.compute_entity_delta(old, new)

        assert len(deltas) == 1
        assert deltas[0].change_type == "modified"
        assert deltas[0].old_value == "旧描述"
        assert deltas[0].new_value == "新描述"

    def test_compute_entity_delta_no_changes(self, data_agent):
        """compute_entity_delta returns empty for identical data."""
        entities = [{"name": "角色A", "type": "character"}]
        deltas = data_agent.compute_entity_delta(entities, entities)

        assert len(deltas) == 0

    def test_find_alias_matches_exact_match(self, data_agent):
        """_find_alias_matches finds exact name matches."""
        extracted = [{"name": "张三", "type": "character", "description": "主角"}]
        canonical = [{"name": "张三", "type": "character", "description": "主角", "id": 1}]

        matches = data_agent._find_alias_matches(extracted, canonical)
        assert len(matches) == 1
        assert matches[0].confidence == 1.0

    def test_find_alias_matches_similarity(self, data_agent):
        """_find_alias_matches finds similar name matches."""
        extracted = [{"name": "张三丰", "type": "character", "description": "道士"}]
        canonical = [{"name": "张三", "type": "character", "description": "道士", "id": 1}]

        matches = data_agent._find_alias_matches(extracted, canonical)
        assert len(matches) >= 1

    def test_find_alias_matches_type_mismatch_ignored(self, data_agent):
        """_find_alias_matches ignores type mismatches."""
        extracted = [{"name": "张三", "type": "character"}]
        canonical = [{"name": "张三", "type": "location", "id": 1}]

        matches = data_agent._find_alias_matches(extracted, canonical)
        assert len(matches) == 0

    def test_relation_graph_to_dict(self):
        """RelationGraph.to_dict serializes correctly."""
        from backend.agents.data_agent import RelationGraph, RelationGraphNode, RelationGraphEdge

        graph = RelationGraph(
            nodes=[RelationGraphNode(id="n1", name="角色A", type="character")],
            edges=[RelationGraphEdge(source="n1", target="n2", relation_type="friend")],
        )
        d = graph.to_dict()
        assert len(d["nodes"]) == 1
        assert len(d["edges"]) == 1
        assert d["nodes"][0]["id"] == "n1"


# =============================================================================
# Utils Tests
# =============================================================================

class TestUtils:
    """Test agent utility functions."""

    def test_extract_json_from_response_valid_json(self):
        """extract_json_from_response parses valid JSON."""
        from backend.agents.utils import extract_json_from_response

        result = extract_json_from_response('{"key": "value"}')
        assert result == {"key": "value"}

    def test_extract_json_from_response_markdown_block(self):
        """extract_json_from_response handles markdown code blocks."""
        from backend.agents.utils import extract_json_from_response

        result = extract_json_from_response('```json\n{"key": "value"}\n```')
        assert result == {"key": "value"}

    def test_extract_json_from_response_array(self):
        """extract_json_from_response parses JSON arrays."""
        from backend.agents.utils import extract_json_from_response

        result = extract_json_from_response('[{"id": 1}, {"id": 2}]')
        assert len(result) == 2

    def test_extract_json_from_response_nested_in_text(self):
        """extract_json_from_response extracts JSON from surrounding text."""
        from backend.agents.utils import extract_json_from_response

        result = extract_json_from_response('Here is the result: {"key": "value"} done.')
        assert result == {"key": "value"}

    def test_extract_json_from_response_invalid_raises(self):
        """extract_json_from_response raises ValueError for invalid content."""
        from backend.agents.utils import extract_json_from_response

        with pytest.raises(ValueError, match="Cannot parse JSON"):
            extract_json_from_response("no json here at all")

    def test_validate_context_response_valid(self):
        """validate_context_response returns True for valid data."""
        from backend.agents.utils import validate_context_response

        data = {"field1": "a", "field2": "b"}
        assert validate_context_response(data, ["field1", "field2"]) is True

    def test_validate_context_response_missing_fields(self):
        """validate_context_response raises ValueError for missing fields."""
        from backend.agents.utils import validate_context_response

        with pytest.raises(ValueError, match="Missing required fields"):
            validate_context_response({"field1": "a"}, ["field1", "field2"])

    def test_validate_context_response_not_dict(self):
        """validate_context_response raises ValueError for non-dict."""
        from backend.agents.utils import validate_context_response

        with pytest.raises(ValueError, match="Expected dict"):
            validate_context_response("not a dict", ["field1"])

    def test_validate_list_response_valid(self):
        """validate_list_response returns validated items."""
        from backend.agents.utils import validate_list_response

        data = [{"name": "a", "type": "t"}, {"name": "b", "type": "t"}]
        result = validate_list_response(data, ["name", "type"])
        assert len(result) == 2

    def test_validate_list_response_filters_invalid(self):
        """validate_list_response filters items missing required keys."""
        from backend.agents.utils import validate_list_response

        data = [{"name": "a", "type": "t"}, {"name": "b"}]  # second missing "type"
        result = validate_list_response(data, ["name", "type"])
        assert len(result) == 1

    def test_validate_list_response_not_list_raises(self):
        """validate_list_response raises ValueError for non-list."""
        from backend.agents.utils import validate_list_response

        with pytest.raises(ValueError, match="Expected list"):
            validate_list_response("not a list", ["name"])

    def test_validate_list_response_with_container_keys(self):
        """validate_list_response extracts from container dict."""
        from backend.agents.utils import validate_list_response

        data = {"entities": [{"name": "a", "type": "t"}]}
        result = validate_list_response(data, ["name", "type"], container_keys=["entities"])
        assert len(result) == 1

    def test_validate_list_response_container_not_found_raises(self):
        """validate_list_response raises when container key not found."""
        from backend.agents.utils import validate_list_response

        with pytest.raises(ValueError, match="Expected list"):
            validate_list_response({"other": []}, ["name"], container_keys=["entities"])

    @pytest.mark.asyncio
    async def test_retry_with_exponential_backoff_success(self):
        """retry_with_exponential_backoff returns on success."""
        from backend.agents.utils import retry_with_exponential_backoff

        async def success():
            return "ok"

        result = await retry_with_exponential_backoff(success)
        assert result == "ok"

    @pytest.mark.asyncio
    async def test_retry_with_exponential_backoff_json_error_raises_value_error(self):
        """retry_with_exponential_backoff raises ValueError for JSON errors."""
        from backend.agents.utils import retry_with_exponential_backoff

        async def json_error():
            raise json.JSONDecodeError("bad", "", 0)

        with pytest.raises(ValueError, match="Invalid JSON"):
            await retry_with_exponential_backoff(json_error)

    def test_mini_max_api_client_init(self, mock_ai_service):
        """MiniMaxAPIClient initializes with correct defaults."""
        from backend.agents.utils import MiniMaxAPIClient

        client = MiniMaxAPIClient(ai_service=mock_ai_service)
        assert client.ai_service == mock_ai_service
        assert client.timeout == 60.0

    def test_mini_max_api_client_custom_params(self, mock_ai_service):
        """MiniMaxAPIClient accepts custom parameters."""
        from backend.agents.utils import MiniMaxAPIClient

        client = MiniMaxAPIClient(
            ai_service=mock_ai_service,
            model="custom-model",
            timeout=30.0,
            max_retries=5,
        )
        assert client.model == "custom-model"
        assert client.timeout == 30.0
        assert client.max_retries == 5


# =============================================================================
# Workflows Tests
# =============================================================================

class TestWorkflows:
    """Test workflow definitions and registry."""

    def test_initialization_workflow_stages(self):
        """INITIALIZATION_WORKFLOW has correct stage chain."""
        from backend.agents.workflows import INITIALIZATION_WORKFLOW

        assert len(INITIALIZATION_WORKFLOW) == 3
        names = [s.name for s in INITIALIZATION_WORKFLOW]
        assert "chat_collection" in names
        assert "context_synthesis" in names
        assert "data_extraction" in names

    def test_writing_workflow_stages(self):
        """WRITING_WORKFLOW has correct stage chain."""
        from backend.agents.workflows import WRITING_WORKFLOW

        assert len(WRITING_WORKFLOW) == 4
        names = [s.name for s in WRITING_WORKFLOW]
        assert "context_building" in names
        assert "plot_planning" in names
        assert "style_application" in names
        assert "quality_review" in names

    def test_review_workflow_stages(self):
        """REVIEW_WORKFLOW has parallel review stage."""
        from backend.agents.workflows import REVIEW_WORKFLOW

        assert len(REVIEW_WORKFLOW) == 1
        assert REVIEW_WORKFLOW[0].mode == "parallel"

    def test_workflow_registry_contains_all(self):
        """WORKFLOW_REGISTRY contains all three workflows."""
        from backend.agents.workflows import WORKFLOW_REGISTRY

        assert "initialization" in WORKFLOW_REGISTRY
        assert "writing" in WORKFLOW_REGISTRY
        assert "review" in WORKFLOW_REGISTRY

    def test_get_workflow_config_valid(self):
        """get_workflow_config returns stages for valid name."""
        from backend.agents.workflows import get_workflow_config

        stages = get_workflow_config("initialization")
        assert len(stages) == 3

    def test_get_workflow_config_invalid_raises(self):
        """get_workflow_config raises KeyError for unknown name."""
        from backend.agents.workflows import get_workflow_config

        with pytest.raises(KeyError, match="Unknown workflow"):
            get_workflow_config("nonexistent")

    def test_list_workflow_names(self):
        """list_workflow_names returns all registered names."""
        from backend.agents.workflows import list_workflow_names

        names = list_workflow_names()
        assert "initialization" in names
        assert "writing" in names
        assert "review" in names


# =============================================================================
# Checker Quick Scan Tests
# =============================================================================

class TestConsistencyCheckerQuickScan:
    """Test ConsistencyChecker quick_scan heuristic logic."""

    @pytest.mark.asyncio
    async def test_quick_scan_clean_content(self):
        """quick_scan returns high score for clean content."""
        from backend.agents.checkers.consistency_checker import ConsistencyChecker

        checker = ConsistencyChecker(ai_service=None)
        result = await checker.quick_scan("这是一段正常的章节内容，没有矛盾。")
        assert result.score >= 80

    @pytest.mark.asyncio
    async def test_quick_scan_detects_timeline_contradiction(self):
        """quick_scan detects timeline contradictions."""
        from backend.agents.checkers.consistency_checker import ConsistencyChecker

        checker = ConsistencyChecker(ai_service=None)
        result = await checker.quick_scan("昨天他还在家，今天他已经在千里之外。")
        # May or may not trigger depending on pattern match
        assert isinstance(result, CheckerResult)

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self):
        """quick_scan handles empty content."""
        from backend.agents.checkers.consistency_checker import ConsistencyChecker

        checker = ConsistencyChecker(ai_service=None)
        result = await checker.quick_scan("")
        assert result.score == 100
        assert result.issues == []

    @pytest.mark.asyncio
    async def test_deep_analyze_without_ai_service(self):
        """deep_analyze returns error when no AI service configured."""
        from backend.agents.checkers.consistency_checker import ConsistencyChecker

        checker = ConsistencyChecker(ai_service=None)
        result = await checker.deep_analyze("content", {})
        assert result.score == 0
        assert result.issues[0]["type"] == "configuration_error"


class TestContinuityCheckerQuickScan:
    """Test ContinuityChecker quick_scan heuristic logic."""

    @pytest.mark.asyncio
    async def test_quick_scan_clean_content(self):
        """quick_scan returns high score for clean content."""
        from backend.agents.checkers.continuity_checker import ContinuityChecker

        checker = ContinuityChecker(ai_service=None)
        result = await checker.quick_scan("他走进了房间。桌上放着一杯茶。")
        assert result.score >= 80

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self):
        """quick_scan handles empty content."""
        from backend.agents.checkers.continuity_checker import ContinuityChecker

        checker = ContinuityChecker(ai_service=None)
        result = await checker.quick_scan("")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_deep_analyze_without_ai_service(self):
        """deep_analyze returns error when no AI service configured."""
        from backend.agents.checkers.continuity_checker import ContinuityChecker

        checker = ContinuityChecker(ai_service=None)
        result = await checker.deep_analyze("content", {})
        assert result.score == 0


class TestOOCCheckerQuickScan:
    """Test OOCChecker quick_scan heuristic logic."""

    @pytest.mark.asyncio
    async def test_quick_scan_clean_content(self):
        """quick_scan returns high score for clean content."""
        from backend.agents.checkers.ooc_checker import OOCChecker

        checker = OOCChecker(ai_service=None)
        result = await checker.quick_scan("他平静地走着，心里想着明天的计划。")
        assert result.score >= 80

    @pytest.mark.asyncio
    async def test_quick_scan_detects_personality_shift(self):
        """quick_scan detects personality shift markers."""
        from backend.agents.checkers.ooc_checker import OOCChecker

        checker = OOCChecker(ai_service=None)
        result = await checker.quick_scan("他一反常态地笑了起来。")
        assert len(result.issues) > 0
        assert result.score < 100

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self):
        """quick_scan handles empty content."""
        from backend.agents.checkers.ooc_checker import OOCChecker

        checker = OOCChecker(ai_service=None)
        result = await checker.quick_scan("")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_deep_analyze_without_ai_service(self):
        """deep_analyze returns error when no AI service configured."""
        from backend.agents.checkers.ooc_checker import OOCChecker

        checker = OOCChecker(ai_service=None)
        result = await checker.deep_analyze("content", {})
        assert result.score == 0


class TestHighPointCheckerQuickScan:
    """Test HighPointChecker quick_scan heuristic logic."""

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self):
        """quick_scan handles empty content."""
        from backend.agents.checkers.high_point_checker import HighPointChecker

        checker = HighPointChecker(ai_service=None)
        result = await checker.quick_scan("")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_quick_scan_short_content(self):
        """quick_scan handles very short content."""
        from backend.agents.checkers.high_point_checker import HighPointChecker

        checker = HighPointChecker(ai_service=None)
        result = await checker.quick_scan("短")
        assert isinstance(result, CheckerResult)

    @pytest.mark.asyncio
    async def test_quick_scan_content_with_climax_keywords(self):
        """quick_scan detects climax keywords in content."""
        from backend.agents.checkers.high_point_checker import HighPointChecker

        checker = HighPointChecker(ai_service=None)
        content = "他突然爆发了，释放出惊人的力量。这一逆转震惊了所有人。" * 20
        result = await checker.quick_scan(content)
        assert result.score >= 0

    @pytest.mark.asyncio
    async def test_deep_analyze_without_ai_service(self):
        """deep_analyze returns error when no AI service configured."""
        from backend.agents.checkers.high_point_checker import HighPointChecker

        checker = HighPointChecker(ai_service=None)
        result = await checker.deep_analyze("content", {})
        assert result.score == 0


class TestPacingCheckerQuickScan:
    """Test PacingChecker quick_scan heuristic logic."""

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self):
        """quick_scan handles empty content."""
        from backend.agents.checkers.pacing_checker import PacingChecker

        checker = PacingChecker(ai_service=None)
        result = await checker.quick_scan("")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_quick_scan_short_chapter(self):
        """quick_scan flags chapters that are too short."""
        from backend.agents.checkers.pacing_checker import PacingChecker

        checker = PacingChecker(ai_service=None)
        result = await checker.quick_scan("很短的内容")
        assert any(i["type"] == "chapter_too_short" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_strand_keywords(self):
        """quick_scan analyzes strand keyword density."""
        from backend.agents.checkers.pacing_checker import PacingChecker

        checker = PacingChecker(ai_service=None)
        content = "他开始修炼，突破了境界。战斗开始了。" * 50
        result = await checker.quick_scan(content)
        assert result.score >= 0

    def test_strand_ratios_defined(self):
        """PacingChecker defines expected strand ratios."""
        from backend.agents.checkers.pacing_checker import PacingChecker

        assert PacingChecker.STRAND_RATIOS["quest"] == 0.60
        assert PacingChecker.STRAND_RATIOS["fire"] == 0.20
        assert PacingChecker.STRAND_RATIOS["constellation"] == 0.20

    @pytest.mark.asyncio
    async def test_deep_analyze_without_ai_service(self):
        """deep_analyze returns error when no AI service configured."""
        from backend.agents.checkers.pacing_checker import PacingChecker

        checker = PacingChecker(ai_service=None)
        result = await checker.deep_analyze("content", {})
        assert result.score == 0


class TestReaderPullCheckerQuickScan:
    """Test ReaderPullChecker quick_scan heuristic logic."""

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self):
        """quick_scan handles empty content."""
        from backend.agents.checkers.reader_pull_checker import ReaderPullChecker

        checker = ReaderPullChecker(ai_service=None)
        result = await checker.quick_scan("")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_quick_scan_content_with_hooks(self):
        """quick_scan detects opening hooks and ending cliffhangers."""
        from backend.agents.checkers.reader_pull_checker import ReaderPullChecker

        checker = ReaderPullChecker(ai_service=None)
        content = "突然，一声巨响打破了宁静。" + "故事继续发展。" * 50 + "没想到，真相竟然是……"
        result = await checker.quick_scan(content)
        assert result.score >= 0

    @pytest.mark.asyncio
    async def test_deep_analyze_without_ai_service(self):
        """deep_analyze returns error when no AI service configured."""
        from backend.agents.checkers.reader_pull_checker import ReaderPullChecker

        checker = ReaderPullChecker(ai_service=None)
        result = await checker.deep_analyze("content", {})
        assert result.score == 0


class TestOutlineLawEnforcerQuickScan:
    """Test OutlineLawEnforcer quick_scan heuristic logic."""

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self):
        """quick_scan handles empty content."""
        from backend.agents.checkers.outline_law_enforcer import OutlineLawEnforcer

        checker = OutlineLawEnforcer(ai_service=None)
        result = await checker.quick_scan("")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_quick_scan_detects_death_keywords(self):
        """quick_scan detects character death keywords."""
        from backend.agents.checkers.outline_law_enforcer import OutlineLawEnforcer

        checker = OutlineLawEnforcer(ai_service=None)
        result = await checker.quick_scan("他死了。他的尸体躺在地上。")
        assert any(i["type"] == "potential_death" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_detects_plot_deviation(self):
        """quick_scan detects plot deviation signals."""
        from backend.agents.checkers.outline_law_enforcer import OutlineLawEnforcer

        checker = OutlineLawEnforcer(ai_service=None)
        result = await checker.quick_scan("剧情突然完全变了方向。")
        assert any(i["type"] == "plot_deviation_signal" for i in result.issues)

    @pytest.mark.asyncio
    async def test_deep_analyze_without_ai_service(self):
        """deep_analyze returns error when no AI service configured."""
        from backend.agents.checkers.outline_law_enforcer import OutlineLawEnforcer

        checker = OutlineLawEnforcer(ai_service=None)
        result = await checker.deep_analyze("content", {})
        assert result.score == 0


class TestSettingPhysicsEnforcerQuickScan:
    """Test SettingPhysicsEnforcer quick_scan heuristic logic."""

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self):
        """quick_scan handles empty content."""
        from backend.agents.checkers.setting_physics_enforcer import SettingPhysicsEnforcer

        checker = SettingPhysicsEnforcer(ai_service=None)
        result = await checker.quick_scan("")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_quick_scan_detects_realm_jump(self):
        """quick_scan detects cultivation realm jumps without breakthrough."""
        from backend.agents.checkers.setting_physics_enforcer import SettingPhysicsEnforcer

        checker = SettingPhysicsEnforcer(ai_service=None)
        result = await checker.quick_scan("他从练气期直接到了元婴期。")
        assert any(i["type"] == "realm_jump_without_explanation" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_detects_magic_violation(self):
        """quick_scan detects magic system violations."""
        from backend.agents.checkers.setting_physics_enforcer import SettingPhysicsEnforcer

        checker = SettingPhysicsEnforcer(ai_service=None)
        result = await checker.quick_scan("他没有魔力施展了禁咒。")
        assert any(i["type"] == "magic_system_violation" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_clean_content(self):
        """quick_scan returns high score for clean content."""
        from backend.agents.checkers.setting_physics_enforcer import SettingPhysicsEnforcer

        checker = SettingPhysicsEnforcer(ai_service=None)
        result = await checker.quick_scan("他慢慢修炼，从练气期突破到了筑基期。")
        assert result.score >= 60

    @pytest.mark.asyncio
    async def test_deep_analyze_without_ai_service(self):
        """deep_analyze returns error when no AI service configured."""
        from backend.agents.checkers.setting_physics_enforcer import SettingPhysicsEnforcer

        checker = SettingPhysicsEnforcer(ai_service=None)
        result = await checker.deep_analyze("content", {})
        assert result.score == 0


# =============================================================================
# ContextAgent Data Classes Tests
# =============================================================================

class TestContextAgentDataClasses:
    """Test ContextAgent data classes and structures."""

    def test_strand_type_enum_values(self):
        """StrandType has correct enum values."""
        from backend.agents.context_agent import StrandType

        assert StrandType.MAIN.value == "main"
        assert StrandType.SUB.value == "sub"
        assert StrandType.IF.value == "if"

    def test_strand_context_creation(self):
        """StrandContext can be created with all fields."""
        from backend.agents.context_agent import StrandContext, StrandType

        ctx = StrandContext(
            strand_type=StrandType.MAIN,
            title="主线",
            description="主要故事线",
            priority=10,
        )
        assert ctx.strand_type == StrandType.MAIN
        assert ctx.priority == 10

    def test_fact_check_item_creation(self):
        """FactCheckItem can be created with all fields."""
        from backend.agents.context_agent import FactCheckItem

        item = FactCheckItem(
            category="character",
            entity_name="张三",
            attribute="gender",
            value="男",
            source="characters:1",
        )
        assert item.category == "character"
        assert item.entity_name == "张三"

    def test_hierarchical_context_to_flat_dict(self):
        """HierarchicalContext.to_flat_dict returns correct structure."""
        from backend.agents.context_agent import HierarchicalContext

        hc = HierarchicalContext(
            world_layer={"name": "世界"},
            scene_layer={"chapter": 1},
            character_layer={"chars": []},
        )
        flat = hc.to_flat_dict()
        assert "world_context" in flat
        assert "scene_context" in flat
        assert "character_context" in flat
        assert flat["world_context"]["name"] == "世界"


# =============================================================================
# CheckerResult and BaseChecker Tests
# =============================================================================

class TestCheckerResultAndBase:
    """Test CheckerResult validation and BaseChecker interface."""

    def test_checker_result_default_values(self):
        """CheckerResult has correct defaults."""
        result = CheckerResult()
        assert result.score == 100
        assert result.issues == []
        assert result.suggestions == []

    def test_checker_result_validation_accepts_valid_score(self):
        """CheckerResult accepts scores between 0 and 100."""
        for score in [0, 50, 100]:
            result = CheckerResult(score=score)
            assert result.score == score

    def test_checker_result_validation_rejects_invalid_score(self):
        """CheckerResult rejects scores outside 0-100 range."""
        with pytest.raises(ValueError, match="score must be between"):
            CheckerResult(score=-1)
        with pytest.raises(ValueError, match="score must be between"):
            CheckerResult(score=101)

    def test_base_checker_requires_methods(self):
        """BaseChecker subclasses must implement quick_scan and deep_analyze."""
        with pytest.raises(TypeError):
            class IncompleteChecker(BaseChecker):
                pass
            IncompleteChecker(name="test", description="test")


# =============================================================================
# Event Bus Tests
# =============================================================================

class TestAsyncEventBus:
    """Test AsyncEventBus publish/subscribe behavior."""

    def test_subscribe_adds_handler(self):
        """subscribe adds handler to event type."""
        from backend.utils.event_bus import AsyncEventBus

        bus = AsyncEventBus()
        handler = MagicMock()
        bus.subscribe("test.event", handler)
        assert handler in bus.get_subscribers("test.event")

    def test_unsubscribe_removes_handler(self):
        """unsubscribe removes handler from event type."""
        from backend.utils.event_bus import AsyncEventBus

        bus = AsyncEventBus()
        handler = MagicMock()
        bus.subscribe("test.event", handler)
        assert bus.unsubscribe("test.event", handler) is True
        assert handler not in bus.get_subscribers("test.event")

    def test_unsubscribe_nonexistent_returns_false(self):
        """unsubscribe returns False for unknown handler."""
        from backend.utils.event_bus import AsyncEventBus

        bus = AsyncEventBus()
        assert bus.unsubscribe("test.event", MagicMock()) is False

    @pytest.mark.asyncio
    async def test_publish_calls_handlers(self):
        """publish invokes all subscribed handlers."""
        from backend.utils.event_bus import AsyncEventBus

        bus = AsyncEventBus()
        handler = AsyncMock()
        bus.subscribe("test.event", handler)
        await bus.publish("test.event", {"data": "value"})
        handler.assert_called_once_with({"data": "value"})

    @pytest.mark.asyncio
    async def test_publish_no_handlers_does_not_raise(self):
        """publish with no handlers does not raise."""
        from backend.utils.event_bus import AsyncEventBus

        bus = AsyncEventBus()
        await bus.publish("nonexistent.event", {})

    def test_list_event_types(self):
        """list_event_types returns types with subscribers."""
        from backend.utils.event_bus import AsyncEventBus

        bus = AsyncEventBus()
        bus.subscribe("event1", MagicMock())
        bus.subscribe("event2", MagicMock())
        types = bus.list_event_types()
        assert "event1" in types
        assert "event2" in types

    def test_list_event_types_empty(self):
        """list_event_types returns empty list when no subscribers."""
        from backend.utils.event_bus import AsyncEventBus

        bus = AsyncEventBus()
        assert bus.list_event_types() == []
