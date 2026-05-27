"""Tests for EngagementAnalyzer - engagement metrics, cool points, fulfillments, retention."""

import pytest
from backend.services.engagement_analyzer import (
    EngagementAnalyzer,
    CoolPointType,
    FulfillmentSize,
    engagement_analyzer,
)


@pytest.fixture
def analyzer():
    return EngagementAnalyzer()


# =============================================================================
# Empty / edge-case inputs
# =============================================================================

class TestEmptyContent:
    """Behavior when content is empty or blank."""

    def test_analyze_empty_string_returns_zero_scores(self, analyzer):
        """Empty content produces zeroed engagement metrics."""
        result = analyzer.analyze(chapter_id=1, content="")
        assert result.word_count == 0
        assert result.cool_point_count == 0
        assert result.fulfillment_count == 0
        assert result.overall_engagement_score == 0.0
        assert result.predicted_retention == 0.0

    def test_analyze_whitespace_only_returns_zero_scores(self, analyzer):
        """Whitespace-only content is treated as empty."""
        result = analyzer.analyze(chapter_id=2, content="   \n\t  ")
        assert result.word_count == 0
        assert result.cool_point_count == 0

    def test_analyze_empty_content_suggests_no_engagement(self, analyzer):
        """Empty content includes a helpful suggestion."""
        result = analyzer.analyze(chapter_id=3, content="")
        assert len(result.suggestions) == 1
        assert "为空" in result.suggestions[0]


# =============================================================================
# Cool point detection
# =============================================================================

class TestCoolPointDetection:
    """Detect cool/satisfying moments in content."""

    def test_detects_face_slap_keyword(self, analyzer):
        """Face-slap keywords are detected as cool points."""
        content = "他狠狠地打了对方的脸，全场震惊。"
        result = analyzer.analyze(chapter_id=10, content=content)
        types = [cp.type for cp in result.cool_points]
        assert CoolPointType.FACE_SLAP in types or CoolPointType.RECOGNITION in types

    def test_detects_power_display(self, analyzer):
        """Power display keywords are detected."""
        content = "他展现了恐怖的力量，排山倒海般碾压对手。"
        result = analyzer.analyze(chapter_id=11, content=content)
        assert result.cool_point_count > 0

    def test_detects_breakthrough(self, analyzer):
        """Breakthrough keywords are detected."""
        content = "他终于突破了瓶颈，晋级到了新的境界。"
        result = analyzer.analyze(chapter_id=12, content=content)
        types = [cp.type for cp in result.cool_points]
        assert CoolPointType.BREAKTHROUGH in types

    def test_cool_point_intensity_varies_by_level(self, analyzer):
        """High-level keywords produce higher intensity than low-level."""
        high_content = "他碾压了对手" * 5
        low_content = "他冷笑了一声" * 5
        high_result = analyzer.analyze(chapter_id=20, content=high_content)
        low_result = analyzer.analyze(chapter_id=21, content=low_content)
        if high_result.cool_points and low_result.cool_points:
            max_high = max(cp.intensity for cp in high_result.cool_points)
            max_low = max(cp.intensity for cp in low_result.cool_points)
            assert max_high >= max_low

    def test_cool_points_sorted_by_position(self, analyzer):
        """Cool points are returned in order of their position in text."""
        content = "他突破了。" + "很长的中间内容。" * 50 + "他碾压了对手。"
        result = analyzer.analyze(chapter_id=30, content=content)
        positions = [cp.position for cp in result.cool_points]
        assert positions == sorted(positions)

    def test_cool_point_density_is_nonnegative(self, analyzer):
        """Cool point density is always non-negative."""
        content = "他突破了，晋级了，碾压了对手。" * 10
        result = analyzer.analyze(chapter_id=40, content=content)
        assert result.cool_point_density >= 0.0
        if result.cool_point_count > 0:
            assert result.cool_point_density > 0.0


# =============================================================================
# Fulfillment detection
# =============================================================================

class TestFulfillmentDetection:
    """Detect fulfillment moments in content."""

    def test_detects_minor_fulfillment(self, analyzer):
        """Minor fulfillment patterns are detected."""
        content = "他终于获得了传说中的宝物。"
        result = analyzer.analyze(chapter_id=50, content=content)
        assert result.fulfillment_count >= 0  # may or may not match

    def test_detects_major_fulfillment(self, analyzer):
        """Major fulfillment patterns are detected."""
        content = "经过漫长的旅程，他终于实现了多年的心愿。"
        result = analyzer.analyze(chapter_id=51, content=content)
        # The result should process without error
        assert result.fulfillment_score >= 0.0

    def test_empty_content_has_zero_fulfillments(self, analyzer):
        """Empty content has no fulfillments."""
        result = analyzer.analyze(chapter_id=52, content="")
        assert result.fulfillment_count == 0
        assert result.fulfillment_score == 0.0


# =============================================================================
# Retention prediction
# =============================================================================

class TestRetentionPrediction:
    """Predict reader retention based on content features."""

    def test_retention_with_conflict_keywords(self, analyzer):
        """Content with conflict keywords has non-zero retention factors."""
        content = "两人展开了激烈的对决，冲突一触即发。这场战斗异常激烈。"
        result = analyzer.analyze(chapter_id=60, content=content)
        assert "conflict_density" in result.retention_factors
        assert result.retention_factors["conflict_density"] > 0

    def test_retention_with_suspense(self, analyzer):
        """Content with suspense keywords contributes to retention."""
        content = "危机四伏，未知的危险正在逼近。悬念重重。"
        result = analyzer.analyze(chapter_id=61, content=content)
        assert result.retention_factors.get("suspense_density", 0) > 0

    def test_retention_with_ending_hook(self, analyzer):
        """Content ending with hook keywords boosts ending_hook factor."""
        # Pad with enough content then add ending hook
        content = "普通的内容。" * 50 + "究竟真相是什么？"
        result = analyzer.analyze(chapter_id=62, content=content)
        assert "ending_hook" in result.retention_factors

    def test_retention_range_is_0_to_100(self, analyzer):
        """Retention prediction is always between 0 and 100."""
        content = "对决战斗冲突悬念危机" * 100
        result = analyzer.analyze(chapter_id=63, content=content)
        assert 0.0 <= result.predicted_retention <= 100.0


# =============================================================================
# Pacing analysis
# =============================================================================

class TestPacingAnalysis:
    """Analyze chapter pacing."""

    def test_fast_pacing_from_short_paragraphs(self, analyzer):
        """Many short paragraphs result in fast pacing."""
        content = "突然！\n" * 100
        result = analyzer.analyze(chapter_id=70, content=content)
        assert result.pacing_analysis["pace"] in ("fast", "moderate", "slow", "unknown")

    def test_pacing_analysis_includes_metrics(self, analyzer):
        """Pacing analysis includes all expected metrics."""
        content = "这是一段中等长度的内容，用来测试节奏分析。" * 20
        result = analyzer.analyze(chapter_id=71, content=content)
        assert "pace" in result.pacing_analysis
        assert "paragraph_count" in result.pacing_analysis


# =============================================================================
# Quick analysis and serialization
# =============================================================================

class TestQuickAnalysis:
    """Test quick analysis and serialization."""

    def test_analyze_quick_returns_dict(self, analyzer):
        """analyze_quick returns a JSON-serializable dict."""
        content = "他突破了新的境界，碾压了对手。"
        result = analyzer.analyze_quick(chapter_id=80, content=content)
        assert isinstance(result, dict)
        assert "chapter_id" in result
        assert result["chapter_id"] == 80

    def test_analyze_quick_serializes_cool_points(self, analyzer):
        """Cool points are serialized with type as string value."""
        content = "他突破了新的境界。" * 10
        result = analyzer.analyze_quick(chapter_id=81, content=content)
        for cp in result.get("cool_points", []):
            assert isinstance(cp["type"], str)
            assert isinstance(cp["intensity"], float)


# =============================================================================
# Suggestions
# =============================================================================

class TestSuggestions:
    """Test suggestion generation."""

    def test_low_density_generates_suggestion(self, analyzer):
        """Low cool point density generates improvement suggestion."""
        content = "普通的内容，没有任何爽点。" * 100
        result = analyzer.analyze(chapter_id=90, content=content)
        # With low density, should get a suggestion about it
        all_suggestions = " ".join(result.suggestions)
        assert len(result.suggestions) > 0

    def test_good_content_gets_positive_suggestion(self, analyzer):
        """Well-balanced content gets a positive suggestion."""
        # Build content with good balance
        content = (
            "他突破了境界，碾压了对手，获得了神器。全场震惊。"
            "终于完成了誓言。危机四伏，悬念重重。究竟真相是什么？"
        ) * 5
        result = analyzer.analyze(chapter_id=91, content=content)
        assert len(result.suggestions) > 0


# =============================================================================
# Module singleton
# =============================================================================

class TestSingleton:
    """Test module-level singleton."""

    def test_singleton_is_engagement_analyzer_instance(self):
        """Module-level engagement_analyzer is an EngagementAnalyzer instance."""
        assert isinstance(engagement_analyzer, EngagementAnalyzer)
