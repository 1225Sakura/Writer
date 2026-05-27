"""Tests for ContextRanker - context pack ranking with recency, frequency, and hook heuristics."""

import pytest
from backend.services.context_ranker import (
    ContextRanker,
    ContextRankerConfig,
    context_ranker,
)


@pytest.fixture
def ranker():
    return ContextRanker()


@pytest.fixture
def debug_ranker():
    return ContextRanker(ContextRankerConfig(debug=True))


# =============================================================================
# Config
# =============================================================================

class TestConfig:
    """Test ContextRankerConfig defaults."""

    def test_default_config_values(self):
        config = ContextRankerConfig()
        assert config.context_ranker_recency_weight == 0.5
        assert config.context_ranker_frequency_weight == 0.3
        assert config.context_ranker_hook_bonus == 0.2
        assert config.context_ranker_length_bonus_cap == 0.3
        assert len(config.context_ranker_alert_critical_keywords) > 0

    def test_custom_config_values(self):
        config = ContextRankerConfig(recency_weight=0.7, frequency_weight=0.2, hook_bonus=0.1)
        assert config.context_ranker_recency_weight == 0.7
        assert config.context_ranker_frequency_weight == 0.2
        assert config.context_ranker_hook_bonus == 0.1


# =============================================================================
# rank_recent_summaries
# =============================================================================

class TestRankRecentSummaries:
    """Rank chapter summaries by relevance."""

    def test_recent_chapter_ranks_higher(self, ranker):
        """More recent chapters rank higher than older ones."""
        items = [
            {"chapter": 1, "summary": "早期章节"},
            {"chapter": 10, "summary": "最新章节"},
        ]
        ranked = ranker.rank_recent_summaries(items, current_chapter=10)
        assert ranked[0]["chapter"] == 10

    def test_hook_hint_boosts_score(self, ranker):
        """Summaries with hook hints get a bonus."""
        items = [
            {"chapter": 5, "summary": "普通内容"},
            {"chapter": 5, "summary": "悬念重重？反转来了！"},
        ]
        ranked = ranker.rank_recent_summaries(items, current_chapter=10)
        # The one with hook hints should rank higher
        assert "悬念" in ranked[0]["summary"] or "反转" in ranked[0]["summary"]

    def test_empty_items_returns_empty(self, ranker):
        """Empty input returns empty list."""
        ranked = ranker.rank_recent_summaries([], current_chapter=1)
        assert ranked == []

    def test_none_chapter_scores_zero_recency(self, ranker):
        """Items with None chapter get zero recency score."""
        items = [{"chapter": None, "summary": "无章节号"}]
        ranked = ranker.rank_recent_summaries(items, current_chapter=10)
        assert len(ranked) == 1


# =============================================================================
# rank_recent_meta
# =============================================================================

class TestRankRecentMeta:
    """Rank meta items by relevance."""

    def test_meta_with_hook_ranks_higher(self, ranker):
        """Items with hook text get bonus."""
        items = [
            {"chapter": 5, "hook": ""},
            {"chapter": 5, "hook": "重要悬念"},
        ]
        ranked = ranker.rank_recent_meta(items, current_chapter=10)
        assert ranked[0]["hook"] == "重要悬念"


# =============================================================================
# rank_appearances
# =============================================================================

class TestRankAppearances:
    """Rank character/item appearances."""

    def test_recent_appearance_ranks_higher(self, ranker):
        """More recent appearances rank higher."""
        items = [
            {"last_chapter": 2, "total": 10},
            {"last_chapter": 9, "total": 3},
        ]
        ranked = ranker.rank_appearances(items, current_chapter=10)
        assert ranked[0]["last_chapter"] == 9

    def test_higher_total_gets_frequency_bonus(self, ranker):
        """Higher total appearances get frequency bonus."""
        items = [
            {"last_chapter": 5, "total": 1},
            {"last_chapter": 5, "total": 100},
        ]
        ranked = ranker.rank_appearances(items, current_chapter=10)
        # With equal recency, higher total should rank higher
        assert ranked[0]["total"] == 100

    def test_warning_penalty_applied(self, ranker):
        """Items with warning flag get a penalty."""
        items = [
            {"last_chapter": 5, "total": 10, "warning": True},
            {"last_chapter": 5, "total": 10},
        ]
        ranked = ranker.rank_appearances(items, current_chapter=10)
        # The one without warning should rank higher
        assert "warning" not in ranked[0] or ranked[0].get("warning") is None


# =============================================================================
# rank_story_skeleton
# =============================================================================

class TestRankStorySkeleton:
    """Rank story skeleton/outline items."""

    def test_recent_skeleton_ranks_higher(self, ranker):
        """More recent skeleton items rank higher."""
        items = [
            {"chapter": 1, "summary": "早期大纲"},
            {"chapter": 10, "summary": "最新大纲"},
        ]
        ranked = ranker.rank_story_skeleton(items, current_chapter=10)
        assert ranked[0]["chapter"] == 10


# =============================================================================
# rank_alerts
# =============================================================================

class TestRankAlerts:
    """Rank alerts by severity and recency."""

    def test_critical_alert_ranks_higher(self, ranker):
        """Critical severity alerts rank higher."""
        alerts = [
            {"chapter": 5, "message": "低级警告", "severity": "low"},
            {"chapter": 5, "message": "严重错误", "severity": "critical"},
        ]
        ranked = ranker.rank_alerts(alerts, current_chapter=10)
        assert ranked[0]["severity"] == "critical"

    def test_keyword_bonus_for_critical_words(self, ranker):
        """Alerts containing critical keywords get bonus."""
        alerts = [
            {"chapter": 5, "message": "普通消息"},
            {"chapter": 5, "message": "发生错误，存在冲突"},
        ]
        ranked = ranker.rank_alerts(alerts, current_chapter=10)
        assert "错误" in ranked[0]["message"] or "冲突" in ranked[0]["message"]

    def test_string_alerts_handled(self, ranker):
        """Plain string alerts are handled."""
        alerts = ["普通警告", "另一个警告"]
        ranked = ranker.rank_alerts(alerts, current_chapter=10)
        assert len(ranked) == 2


# =============================================================================
# rank_generic_items
# =============================================================================

class TestRankGenericItems:
    """Test generic item ranking."""

    def test_generic_ranking_by_recency(self, ranker):
        """Generic items ranked by recency."""
        items = [
            {"chapter": 1, "content": "早期"},
            {"chapter": 10, "content": "最新"},
        ]
        ranked = ranker.rank_generic_items(items, current_chapter=10)
        assert ranked[0]["chapter"] == 10

    def test_custom_chapter_key(self, ranker):
        """Custom chapter key is supported."""
        items = [
            {"ch": 1, "content": "早期"},
            {"ch": 10, "content": "最新"},
        ]
        ranked = ranker.rank_generic_items(items, current_chapter=10, chapter_key="ch")
        assert ranked[0]["ch"] == 10


# =============================================================================
# apply_entity_weights
# =============================================================================

class TestApplyEntityWeights:
    """Test entity weight application."""

    def test_character_weight_is_highest(self, ranker):
        """Character entities get the highest weight."""
        items = [
            {"type": "item", "_context_score": 0.5},
            {"type": "character", "_context_score": 0.5},
        ]
        weighted = ranker.apply_entity_weights(items)
        assert weighted[0]["type"] == "character"

    def test_non_dict_items_get_zero_score(self, ranker):
        """Non-dict items get score 0."""
        items = ["plain string", {"type": "character", "_context_score": 0.8}]
        weighted = ranker.apply_entity_weights(items)
        assert len(weighted) == 2


# =============================================================================
# rank_pack
# =============================================================================

class TestRankPack:
    """Test full pack ranking."""

    def test_rank_pack_preserves_structure(self, ranker):
        """rank_pack preserves the pack structure."""
        pack = {
            "core": {
                "recent_summaries": [{"chapter": 1, "summary": "test"}],
                "recent_meta": [],
            },
            "scene": {"appearing_characters": []},
            "story_skeleton": [],
            "alerts": {"disambiguation_warnings": [], "disambiguation_pending": []},
            "meta": {},
        }
        ranked = ranker.rank_pack(pack, chapter=10)
        assert "core" in ranked
        assert "scene" in ranked
        assert "story_skeleton" in ranked
        assert "alerts" in ranked
        assert "meta" in ranked

    def test_rank_pack_adds_meta_info(self, ranker):
        """rank_pack adds ranker metadata."""
        pack = {"core": {}, "scene": {}, "story_skeleton": [], "alerts": {}, "meta": {}}
        ranked = ranker.rank_pack(pack, chapter=10)
        assert ranked["meta"]["ranker"]["enabled"] is True
        assert "context_contract_version" in ranked["meta"]


# =============================================================================
# Debug mode
# =============================================================================

class TestDebugMode:
    """Test debug mode scoring details."""

    def test_debug_mode_adds_score_details(self, debug_ranker):
        """Debug mode adds _context_score_detail to items."""
        items = [{"chapter": 5, "summary": "测试内容"}]
        ranked = debug_ranker.rank_recent_summaries(items, current_chapter=10)
        assert "_context_score" in ranked[0]
        assert "_context_score_detail" in ranked[0]


# =============================================================================
# Scoring helpers
# =============================================================================

class TestScoringHelpers:
    """Test internal scoring methods."""

    def test_recency_score_none_returns_zero(self, ranker):
        """None source chapter returns zero recency."""
        score = ranker._recency_score(None, 10)
        assert score == 0.0

    def test_recency_score_same_chapter(self, ranker):
        """Same chapter returns highest recency (1.0)."""
        score = ranker._recency_score(10, 10)
        assert score == 1.0

    def test_recency_score_decreases_with_gap(self, ranker):
        """Recency decreases as gap increases."""
        score_close = ranker._recency_score(9, 10)
        score_far = ranker._recency_score(1, 10)
        assert score_close > score_far

    def test_frequency_score_zero_for_no_appearances(self, ranker):
        """Zero total returns zero frequency."""
        score = ranker._frequency_score(0)
        assert score == 0.0

    def test_frequency_score_caps_at_one(self, ranker):
        """Frequency score caps at 1.0."""
        score = ranker._frequency_score(10000)
        assert score <= 1.0

    def test_length_score_empty_text(self, ranker):
        """Empty text returns zero length score."""
        score = ranker._length_score("")
        assert score == 0.0

    def test_has_hook_hint_detects_question_marks(self, ranker):
        """Question marks are detected as hook hints."""
        assert ranker._has_hook_hint("这是什么？") is True
        assert ranker._has_hook_hint("普通内容") is False

    def test_as_int_handles_various_types(self, ranker):
        """_as_int handles int, float, string, None."""
        assert ranker._as_int(5) == 5
        assert ranker._as_int("10") == 10
        assert ranker._as_int(3.7) == 3
        assert ranker._as_int(None) is None
        assert ranker._as_int("abc") is None


# =============================================================================
# Module singleton
# =============================================================================

class TestSingleton:
    """Test module-level singleton."""

    def test_singleton_is_context_ranker_instance(self):
        assert isinstance(context_ranker, ContextRanker)
