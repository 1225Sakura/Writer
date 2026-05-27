"""Tests for Pacing Analyzer - strand ratios, red line violations, streaks, gaps."""

import pytest
from backend.services.pacing_analyzer import (
    PacingAnalyzer,
    PacingAnalysis,
    RedLineViolation,
)
from backend.services.strand_classifier import StrandClassification


def _make_classif(chapter_id: int, quest: float, fire: float, constellation: float) -> StrandClassification:
    """Create a StrandClassification with given raw scores (post_init normalizes)."""
    return StrandClassification(
        chapter_id=chapter_id,
        quest=quest,
        fire=fire,
        constellation=constellation,
    )


@pytest.fixture
def analyzer():
    return PacingAnalyzer(classifier=None)  # classifier not needed for unit tests


# =============================================================================
# RedLineViolation
# =============================================================================


class TestRedLineViolation:
    """Test RedLineViolation dataclass."""

    def test_to_dict(self):
        v = RedLineViolation(
            strand="quest",
            violation_type="continuous",
            chapters_affected=[1, 2, 3, 4, 5, 6],
            severity="critical",
            message="Quest连续6章",
            suggestion="插入感情线",
        )
        d = v.to_dict()
        assert d["strand"] == "quest"
        assert d["violation_type"] == "continuous"
        assert len(d["chapters_affected"]) == 6
        assert d["severity"] == "critical"


# =============================================================================
# PacingAnalysis
# =============================================================================


class TestPacingAnalysis:
    """Test PacingAnalysis dataclass."""

    def test_to_dict(self):
        analysis = PacingAnalysis(outline_id=1, total_chapters=10)
        d = analysis.to_dict()
        assert d["outline_id"] == 1
        assert d["total_chapters"] == 10
        assert "strand_ratios" in d
        assert "red_line_violations" in d


# =============================================================================
# _calculate_overall_ratios
# =============================================================================


class TestCalculateOverallRatios:
    """Test ratio calculation."""

    def test_empty_classifications(self, analyzer):
        ratios = analyzer._calculate_overall_ratios([])
        assert ratios == {"quest": 0.0, "fire": 0.0, "constellation": 0.0}

    def test_balanced_ratios(self, analyzer):
        classifs = [
            _make_classif(1, 3, 1, 1),
            _make_classif(2, 3, 1, 1),
            _make_classif(3, 3, 1, 1),
        ]
        ratios = analyzer._calculate_overall_ratios(classifs)
        # After normalization each is 0.6/0.2/0.2
        assert abs(ratios["quest"] - 0.6) < 0.01
        assert abs(ratios["fire"] - 0.2) < 0.01
        assert abs(ratios["constellation"] - 0.2) < 0.01

    def test_quest_heavy(self, analyzer):
        classifs = [
            _make_classif(1, 10, 1, 1),
            _make_classif(2, 10, 1, 1),
        ]
        ratios = analyzer._calculate_overall_ratios(classifs)
        assert ratios["quest"] > ratios["fire"]


# =============================================================================
# _find_streaks
# =============================================================================


class TestFindStreaks:
    """Test streak detection."""

    def test_single_streak(self, analyzer):
        # All quest-dominant
        classifs = [
            _make_classif(i, 10, 1, 1) for i in range(5)
        ]
        streaks = analyzer._find_streaks(classifs, "quest")
        assert len(streaks) == 1
        assert streaks[0]["length"] == 5

    def test_no_streak(self, analyzer):
        classifs = [
            _make_classif(1, 1, 10, 1),  # fire dominant
            _make_classif(2, 1, 10, 1),  # fire dominant
        ]
        streaks = analyzer._find_streaks(classifs, "quest")
        assert len(streaks) == 0

    def test_multiple_streaks(self, analyzer):
        classifs = [
            _make_classif(1, 10, 1, 1),  # quest
            _make_classif(2, 1, 10, 1),  # fire
            _make_classif(3, 10, 1, 1),  # quest
        ]
        streaks = analyzer._find_streaks(classifs, "quest")
        assert len(streaks) == 2


# =============================================================================
# _find_gaps
# =============================================================================


class TestFindGaps:
    """Test gap detection."""

    def test_no_gap_when_present(self, analyzer):
        classifs = [_make_classif(1, 1, 10, 1)]  # fire dominant
        gaps = analyzer._find_gaps(classifs, "fire")
        assert len(gaps) == 0

    def test_full_gap(self, analyzer):
        classifs = [_make_classif(1, 10, 1, 1)]  # quest dominant
        gaps = analyzer._find_gaps(classifs, "fire")
        assert len(gaps) == 1
        assert gaps[0]["length"] == 1


# =============================================================================
# _calculate_current_streak / _calculate_current_gap
# =============================================================================


class TestCurrentStreakAndGap:
    """Test current streak/gap from end."""

    def test_current_streak_quest(self, analyzer):
        classifs = [
            _make_classif(1, 10, 1, 1),  # quest
            _make_classif(2, 10, 1, 1),  # quest
            _make_classif(3, 1, 10, 1),  # fire
        ]
        # Reversed: fire, quest, quest -> streak starts from end
        streak = analyzer._calculate_current_streak(classifs, "quest")
        # From end: index 2 is quest, index 1 is quest, index 0 is fire
        # Wait - reversed iterates from last: classif[2]=fire, then breaks
        assert streak == 0  # Last element is fire, not quest

    def test_current_streak_from_end(self, analyzer):
        classifs = [
            _make_classif(1, 1, 10, 1),  # fire
            _make_classif(2, 10, 1, 1),  # quest
            _make_classif(3, 10, 1, 1),  # quest
        ]
        streak = analyzer._calculate_current_streak(classifs, "quest")
        assert streak == 2

    def test_current_gap_fire(self, analyzer):
        classifs = [
            _make_classif(1, 10, 1, 1),  # quest
            _make_classif(2, 10, 1, 1),  # quest
        ]
        gap = analyzer._calculate_current_gap(classifs, "fire")
        assert gap == 2


# =============================================================================
# _calculate_health_score
# =============================================================================


class TestHealthScore:
    """Test health score calculation."""

    def test_perfect_score(self, analyzer):
        ratios = {"quest": 0.6, "fire": 0.2, "constellation": 0.2}
        score = analyzer._calculate_health_score(
            ratios, violations=[], quest_streak=0, fire_gap=0, constellation_gap=0
        )
        assert score == 100

    def test_violation_deducts(self, analyzer):
        ratios = {"quest": 0.6, "fire": 0.2, "constellation": 0.2}
        violation = RedLineViolation(
            strand="quest", violation_type="continuous", severity="critical"
        )
        score = analyzer._calculate_health_score(
            ratios, violations=[violation], quest_streak=0, fire_gap=0, constellation_gap=0
        )
        assert score < 100

    def test_approaching_red_line_deducts(self, analyzer):
        ratios = {"quest": 0.6, "fire": 0.2, "constellation": 0.2}
        score = analyzer._calculate_health_score(
            ratios, violations=[], quest_streak=4, fire_gap=8, constellation_gap=12
        )
        assert score < 100

    def test_score_clamped_0_to_100(self, analyzer):
        # Very bad ratios
        ratios = {"quest": 1.0, "fire": 0.0, "constellation": 0.0}
        violations = [
            RedLineViolation(strand="quest", violation_type="continuous", severity="critical")
            for _ in range(20)
        ]
        score = analyzer._calculate_health_score(
            ratios, violations=violations, quest_streak=10, fire_gap=20, constellation_gap=20
        )
        assert 0 <= score <= 100


# =============================================================================
# _generate_summary
# =============================================================================


class TestGenerateSummary:
    """Test summary generation."""

    def test_healthy_summary(self, analyzer):
        ratios = {"quest": 0.6, "fire": 0.2, "constellation": 0.2}
        summary = analyzer._generate_summary(
            ratios, violations=[], quest_streak=0, fire_gap=0, constellation_gap=0
        )
        assert "Quest" in summary
        assert "未检测到红线违规" in summary

    def test_violations_in_summary(self, analyzer):
        ratios = {"quest": 0.6, "fire": 0.2, "constellation": 0.2}
        violation = RedLineViolation(
            strand="quest", violation_type="continuous",
            message="Quest连续6章超过红线"
        )
        summary = analyzer._generate_summary(
            ratios, violations=[violation], quest_streak=6, fire_gap=0, constellation_gap=0
        )
        assert "1 处红线违规" in summary
        assert "Quest连续6章" in summary


# =============================================================================
# IDEAL_RATIOS and RED_LINES constants
# =============================================================================


class TestConstants:
    """Test analyzer constants."""

    def test_ideal_ratios_sum_to_1(self, analyzer):
        total = sum(analyzer.IDEAL_RATIOS.values())
        assert abs(total - 1.0) < 0.001

    def test_red_lines_quest_max_continuous(self, analyzer):
        assert analyzer.RED_LINES["quest"]["max_continuous"] == 5

    def test_red_lines_fire_max_gap(self, analyzer):
        assert analyzer.RED_LINES["fire"]["max_gap"] == 10

    def test_red_lines_constellation_max_gap(self, analyzer):
        assert analyzer.RED_LINES["constellation"]["max_gap"] == 15
