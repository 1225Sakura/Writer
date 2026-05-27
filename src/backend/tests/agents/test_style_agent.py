"""Tests for StyleAgent — style fingerprint analysis, adjustment, and migration.

Covers:
- Happy path: analyze, adjust, suggest operations
- Error handling: AI failures, invalid task formats
- Lifecycle hooks: pre_execute injects available_styles
- Fingerprint analysis: sentence, vocabulary, rhetoric, emotion metrics
- Preset style matching and registration
"""

from __future__ import annotations

import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from backend.agents.base import AgentContext, AgentResult
from backend.agents.style_agent import (
    StyleAgent,
    StyleFingerprint,
    StyleReport,
    StyleMigrationSuggestion,
    SentenceMetrics,
    VocabularyMetrics,
    RhetoricMetrics,
    EmotionMetrics,
    PRESET_STYLES,
)
from backend.utils.exceptions import AIServiceError, AIServiceTimeoutError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_style_agent() -> StyleAgent:
    """Create a StyleAgent with mocked provider and event_bus."""
    provider = MagicMock()
    provider.generate = AsyncMock(return_value='{"summary": "test", "keywords": []}')
    provider.name = "mock_provider"
    event_bus = AsyncMock()
    event_bus.publish = AsyncMock()
    return StyleAgent(provider=provider, event_bus=event_bus)


def _sample_chinese_text() -> str:
    return (
        "他站在山巅之上，望着远方的云海。风轻轻吹过，带来一丝凉意。"
        "那座古老的城堡在夕阳下显得格外壮观，仿佛一位沉睡的巨人。"
        "他的心中涌起一股莫名的感动，这便是他追寻已久的答案。"
        "时光如水，岁月如歌。"
    )


# ===========================================================================
# Lifecycle Hook Tests
# ===========================================================================

class TestStyleAgentPreExecute:
    """Test pre_execute hook injects available styles."""

    @pytest.mark.asyncio
    async def test_pre_execute_injects_available_styles(self):
        agent = _make_style_agent()
        context = AgentContext(task="analyze:text")
        result = await agent.pre_execute(context)
        assert "available_styles" in result.settings
        assert "default" in result.settings["available_styles"]
        assert "江南" in result.settings["available_styles"]

    @pytest.mark.asyncio
    async def test_pre_execute_preserves_existing_settings(self):
        agent = _make_style_agent()
        context = AgentContext(task="test", settings={"custom_key": "value"})
        result = await agent.pre_execute(context)
        assert result.settings["custom_key"] == "value"
        assert "available_styles" in result.settings


# ===========================================================================
# Execute Dispatch Tests
# ===========================================================================

class TestStyleAgentExecute:
    """Test execute dispatches based on task prefix."""

    @pytest.mark.asyncio
    async def test_analyze_happy_path(self):
        agent = _make_style_agent()
        text = _sample_chinese_text()
        agent._provider.generate = AsyncMock(
            return_value='{"summary": "古典风格", "keywords": ["山巅", "云海"]}'
        )
        context = AgentContext(task=f"analyze:{text}")
        result = await agent.execute(context)
        assert result.confidence > 0
        assert "detected_style" in result.metadata
        assert result.metadata["operation"] == "analyze"

    @pytest.mark.asyncio
    async def test_adjust_happy_path(self):
        agent = _make_style_agent()
        agent._provider.generate = AsyncMock(return_value="调整后的文本内容")
        context = AgentContext(task="adjust:原始文本:江南")
        result = await agent.execute(context)
        assert "adjusted_text" in result.content
        assert result.content["target_style"] == "江南"
        assert result.confidence == 0.85

    @pytest.mark.asyncio
    async def test_adjust_invalid_format(self):
        agent = _make_style_agent()
        context = AgentContext(task="adjust:only_one_part")
        result = await agent.execute(context)
        assert result.confidence == 0.0
        assert any("adjust" in w for w in result.warnings)

    @pytest.mark.asyncio
    async def test_suggest_happy_path(self):
        agent = _make_style_agent()
        agent._provider.generate = AsyncMock(
            return_value='[{"aspect": "句式", "current_state": "短", "target_state": "长", "suggestion": "合并短句", "priority": "high"}]'
        )
        context = AgentContext(task="suggest:文本:加缪")
        result = await agent.execute(context)
        assert "suggestions" in result.content
        assert result.confidence == 0.8

    @pytest.mark.asyncio
    async def test_suggest_invalid_format(self):
        agent = _make_style_agent()
        context = AgentContext(task="suggest:only_one_part")
        result = await agent.execute(context)
        assert result.confidence == 0.0

    @pytest.mark.asyncio
    async def test_unknown_task_prefix(self):
        agent = _make_style_agent()
        context = AgentContext(task="unknown:some text")
        result = await agent.execute(context)
        assert result.confidence == 0.0
        assert any("Unrecognized" in w for w in result.warnings)

    @pytest.mark.asyncio
    async def test_execute_with_hooks_full_lifecycle(self):
        """Test full lifecycle: pre_execute -> execute -> post_execute."""
        agent = _make_style_agent()
        agent._provider.generate = AsyncMock(
            return_value='{"summary": "风格分析", "keywords": []}'
        )
        context = AgentContext(task=f"analyze:{_sample_chinese_text()}")
        result = await agent.execute_with_hooks(context)
        assert result.confidence > 0
        assert "available_styles" in context.settings


# ===========================================================================
# Fingerprint Analysis Tests
# ===========================================================================

class TestAnalyzeFingerprint:
    """Test the analyze_fingerprint method."""

    @pytest.mark.asyncio
    async def test_returns_style_report(self):
        agent = _make_style_agent()
        agent._provider.generate = AsyncMock(
            return_value='{"summary": "test summary", "keywords": ["test"]}'
        )
        report = await agent.analyze_fingerprint(_sample_chinese_text())
        assert isinstance(report, StyleReport)
        assert report.fingerprint is not None
        assert report.detected_style in PRESET_STYLES

    @pytest.mark.asyncio
    async def test_sentence_metrics_populated(self):
        agent = _make_style_agent()
        agent._provider.generate = AsyncMock(return_value='{"summary": "", "keywords": []}')
        report = await agent.analyze_fingerprint(_sample_chinese_text())
        fp = report.fingerprint
        assert fp.sentence.avg_length > 0
        assert fp.sentence.max_length >= fp.sentence.min_length

    @pytest.mark.asyncio
    async def test_vocabulary_metrics_populated(self):
        agent = _make_style_agent()
        agent._provider.generate = AsyncMock(return_value='{"summary": "", "keywords": []}')
        report = await agent.analyze_fingerprint(_sample_chinese_text())
        fp = report.fingerprint
        assert fp.vocabulary.total_words > 0
        assert 0 <= fp.vocabulary.diversity_index <= 1

    @pytest.mark.asyncio
    async def test_rhetoric_metrics_populated(self):
        agent = _make_style_agent()
        agent._provider.generate = AsyncMock(return_value='{"summary": "", "keywords": []}')
        report = await agent.analyze_fingerprint(_sample_chinese_text())
        fp = report.fingerprint
        assert fp.rhetoric.rhetorical_density >= 0

    @pytest.mark.asyncio
    async def test_emotion_metrics_positive_text(self):
        agent = _make_style_agent()
        agent._provider.generate = AsyncMock(return_value='{"summary": "", "keywords": []}')
        positive_text = "喜悦充满了她的内心，幸福的泪水滑落。温暖的阳光照耀着美好的一天。"
        report = await agent.analyze_fingerprint(positive_text)
        assert report.fingerprint.emotion.dominant_emotion in ("positive", "neutral")

    @pytest.mark.asyncio
    async def test_emotion_metrics_negative_text(self):
        agent = _make_style_agent()
        agent._provider.generate = AsyncMock(return_value='{"summary": "", "keywords": []}')
        negative_text = "悲伤笼罩了一切，痛苦与绝望交织。孤独的泪水无声滑落。"
        report = await agent.analyze_fingerprint(negative_text)
        assert report.fingerprint.emotion.dominant_emotion in ("negative", "neutral")

    @pytest.mark.asyncio
    async def test_empty_text_handling(self):
        agent = _make_style_agent()
        agent._provider.generate = AsyncMock(return_value='{"summary": "", "keywords": []}')
        report = await agent.analyze_fingerprint("")
        assert isinstance(report, StyleReport)

    @pytest.mark.asyncio
    async def test_ai_deep_analysis_failure_graceful(self):
        """AI deep analysis failure should not crash the fingerprint."""
        agent = _make_style_agent()
        call_count = 0

        async def mock_generate(prompt, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return '{"summary": "ok", "keywords": []}'
            raise AIServiceError(message="API down")

        agent._provider.generate = AsyncMock(side_effect=mock_generate)
        report = await agent.analyze_fingerprint(_sample_chinese_text())
        assert isinstance(report, StyleReport)
        assert report.fingerprint.ai_deep_analysis == {}


# ===========================================================================
# Preset Style Tests
# ===========================================================================

class TestPresetStyles:
    """Test preset style definitions."""

    def test_all_presets_exist(self):
        assert "default" in PRESET_STYLES
        assert "江南" in PRESET_STYLES
        assert "卡夫卡" in PRESET_STYLES
        assert "加缪" in PRESET_STYLES
        assert "custom" in PRESET_STYLES

    def test_preset_has_required_fields(self):
        for key, preset in PRESET_STYLES.items():
            assert "name" in preset
            assert "description" in preset
            assert "traits" in preset

    def test_get_preset_styles_returns_copy(self):
        styles = StyleAgent.get_preset_styles()
        assert "default" in styles

    def test_register_custom_style(self):
        StyleAgent.register_custom_style("test_style", "测试", "测试风格", "测试特征")
        assert "test_style" in PRESET_STYLES
        # Cleanup
        del PRESET_STYLES["test_style"]


# ===========================================================================
# Migration Suggestions Tests
# ===========================================================================

class TestMigrationSuggestions:
    """Test migration_suggestions method."""

    @pytest.mark.asyncio
    async def test_suggestions_for_jiangnan_style(self):
        agent = _make_style_agent()
        agent._provider.generate = AsyncMock(return_value='[]')
        # Short sentences should trigger suggestion for 江南
        short_text = "他走了。她哭了。天亮了。"
        suggestions = await agent.migration_suggestions(short_text, "江南")
        assert isinstance(suggestions, list)

    @pytest.mark.asyncio
    async def test_suggestions_for_camus_style(self):
        agent = _make_style_agent()
        agent._provider.generate = AsyncMock(return_value='[]')
        # Long sentences should trigger suggestion for 加缪
        long_text = "他站在那里望着远方的天空中飘过的云朵心中涌起一股莫名的感动仿佛整个世界都在这一刻静止了只剩下他一个人在这无尽的虚空中寻找着属于自己的答案。"
        suggestions = await agent.migration_suggestions(long_text, "加缪")
        assert isinstance(suggestions, list)


# ===========================================================================
# Helper Method Tests
# ===========================================================================

class TestStyleAgentHelpers:
    """Test internal helper methods."""

    def test_analyze_sentences_basic(self):
        agent = _make_style_agent()
        text = "这是一个测试句子。这是另一个句子！第三句？"
        metrics = agent._analyze_sentences(text)
        assert isinstance(metrics, SentenceMetrics)
        assert metrics.avg_length > 0
        assert metrics.max_length > 0

    def test_analyze_sentences_empty(self):
        agent = _make_style_agent()
        metrics = agent._analyze_sentences("")
        assert metrics.avg_length == 0

    def test_analyze_vocabulary_basic(self):
        agent = _make_style_agent()
        text = "这是一段中文文本用于测试词汇分析功能"
        metrics = agent._analyze_vocabulary(text)
        assert isinstance(metrics, VocabularyMetrics)
        assert metrics.total_words > 0
        assert metrics.unique_words > 0

    def test_analyze_vocabulary_empty(self):
        agent = _make_style_agent()
        metrics = agent._analyze_vocabulary("")
        assert metrics.total_words == 0

    def test_analyze_rhetoric_basic(self):
        agent = _make_style_agent()
        text = "她的笑容像花一样绽放。月亮微笑着俯瞰大地。"
        metrics = agent._analyze_rhetoric(text)
        assert isinstance(metrics, RhetoricMetrics)
        assert metrics.simile_count >= 0

    def test_analyze_emotion_neutral(self):
        agent = _make_style_agent()
        text = "今天天气不错。他去了一趟超市。"
        metrics = agent._analyze_emotion(text)
        assert isinstance(metrics, EmotionMetrics)
        assert metrics.dominant_emotion == "neutral"

    def test_match_preset_style_returns_tuple(self):
        agent = _make_style_agent()
        fp = StyleFingerprint()
        detected, confidence, comparison = agent._match_preset_style(fp)
        assert isinstance(detected, str)
        assert 0 <= confidence <= 1
        assert isinstance(comparison, dict)
