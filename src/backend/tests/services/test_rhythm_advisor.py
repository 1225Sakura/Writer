"""Tests for Rhythm Advisor - advice generation, urgency levels, quick advise."""

import pytest
from backend.services.rhythm_advisor import RhythmAdvisor, StrandAdvice
from backend.services.pacing_analyzer import PacingAnalysis, RedLineViolation
from backend.services.strand_classifier import StrandClassification


@pytest.fixture
def advisor():
    return RhythmAdvisor(analyzer=None)


# =============================================================================
# StrandAdvice
# =============================================================================


class TestStrandAdvice:
    """Test StrandAdvice dataclass."""

    def test_to_dict(self):
        advice = StrandAdvice(
            recommended_strand="quest",
            confidence=0.8,
            reasoning="test reasoning",
            urgency="normal",
            alternative_strands=["fire"],
            suggested_elements=["element1"],
            warnings=["warning1"],
        )
        d = advice.to_dict()
        assert d["recommended_strand"] == "quest"
        assert d["confidence"] == 0.8
        assert d["urgency"] == "normal"
        assert "fire" in d["alternative_strands"]


# =============================================================================
# _generate_advice - red line violations
# =============================================================================


class TestGenerateAdviceRedLines:
    """Test advice generation for red line violations."""

    def test_quest_streak_critical(self, advisor):
        analysis = PacingAnalysis(
            outline_id=1,
            total_chapters=10,
            strand_ratios={"quest": 0.8, "fire": 0.1, "constellation": 0.1},
            quest_streak=6,
            fire_gap=0,
            constellation_gap=0,
            red_line_violations=[
                RedLineViolation(strand="quest", violation_type="continuous", severity="critical", message="test")
            ],
        )
        advice = advisor._generate_advice(analysis)
        assert advice.recommended_strand == "fire_or_constellation"
        assert advice.urgency == "critical"
        assert advice.confidence == 0.95

    def test_fire_gap_critical(self, advisor):
        analysis = PacingAnalysis(
            outline_id=1,
            total_chapters=10,
            strand_ratios={"quest": 0.8, "fire": 0.0, "constellation": 0.2},
            quest_streak=0,
            fire_gap=11,
            constellation_gap=0,
        )
        advice = advisor._generate_advice(analysis)
        assert advice.recommended_strand == "fire"
        assert advice.urgency == "critical"

    def test_constellation_gap_critical(self, advisor):
        analysis = PacingAnalysis(
            outline_id=1,
            total_chapters=10,
            strand_ratios={"quest": 0.7, "fire": 0.2, "constellation": 0.1},
            quest_streak=0,
            fire_gap=0,
            constellation_gap=16,
        )
        advice = advisor._generate_advice(analysis)
        assert advice.recommended_strand == "constellation"
        assert advice.urgency == "critical"


# =============================================================================
# _generate_advice - approaching red lines
# =============================================================================


class TestGenerateAdviceApproaching:
    """Test advice for approaching red lines."""

    def test_quest_approaching_red_line(self, advisor):
        analysis = PacingAnalysis(
            outline_id=1,
            total_chapters=10,
            strand_ratios={"quest": 0.7, "fire": 0.15, "constellation": 0.15},
            quest_streak=4,
            fire_gap=0,
            constellation_gap=0,
        )
        advice = advisor._generate_advice(analysis)
        assert advice.recommended_strand == "fire"
        assert advice.urgency == "high"

    def test_fire_approaching_red_line(self, advisor):
        analysis = PacingAnalysis(
            outline_id=1,
            total_chapters=10,
            strand_ratios={"quest": 0.7, "fire": 0.1, "constellation": 0.2},
            quest_streak=0,
            fire_gap=8,
            constellation_gap=0,
        )
        advice = advisor._generate_advice(analysis)
        assert advice.recommended_strand == "fire"
        assert advice.urgency == "high"

    def test_constellation_approaching_red_line(self, advisor):
        analysis = PacingAnalysis(
            outline_id=1,
            total_chapters=10,
            strand_ratios={"quest": 0.7, "fire": 0.2, "constellation": 0.1},
            quest_streak=0,
            fire_gap=0,
            constellation_gap=12,
        )
        advice = advisor._generate_advice(analysis)
        assert advice.recommended_strand == "constellation"
        assert advice.urgency == "high"


# =============================================================================
# _generate_advice - balanced ratios
# =============================================================================


class TestGenerateAdviceBalanced:
    """Test advice for balanced ratios."""

    def test_balanced_with_quest_streak(self, advisor):
        analysis = PacingAnalysis(
            outline_id=1,
            total_chapters=10,
            strand_ratios={"quest": 0.6, "fire": 0.2, "constellation": 0.2},
            quest_streak=3,
            fire_gap=0,
            constellation_gap=0,
        )
        advice = advisor._generate_advice(analysis)
        assert advice.recommended_strand == "fire"
        assert advice.urgency == "normal"

    def test_balanced_no_streak(self, advisor):
        analysis = PacingAnalysis(
            outline_id=1,
            total_chapters=10,
            strand_ratios={"quest": 0.6, "fire": 0.2, "constellation": 0.2},
            quest_streak=1,
            fire_gap=0,
            constellation_gap=0,
        )
        advice = advisor._generate_advice(analysis)
        assert advice.recommended_strand == "quest"
        assert advice.urgency == "normal"

    def test_underrepresented_strand_recommended(self, advisor):
        analysis = PacingAnalysis(
            outline_id=1,
            total_chapters=10,
            strand_ratios={"quest": 0.7, "fire": 0.2, "constellation": 0.1},
            quest_streak=0,
            fire_gap=0,
            constellation_gap=0,
        )
        advice = advisor._generate_advice(analysis)
        assert advice.recommended_strand == "constellation"


# =============================================================================
# quick_advise
# =============================================================================


class TestQuickAdvise:
    """Test quick advice without DB."""

    def test_empty_classifications(self, advisor):
        advice = advisor.quick_advise([])
        assert advice.recommended_strand == "quest"
        assert advice.confidence == 0.5

    def test_quest_heavy_recent(self, advisor):
        classifs = [
            StrandClassification(chapter_id=i, quest=10, fire=1, constellation=1)
            for i in range(5)
        ]
        advice = advisor.quick_advise(classifs)
        # Quest is dominant in all, so fire_gap and constellation_gap are high
        assert advice.recommended_strand in ("fire", "constellation", "fire_or_constellation")

    def test_balanced_recent(self, advisor):
        classifs = [
            StrandClassification(chapter_id=1, quest=3, fire=1, constellation=1),
            StrandClassification(chapter_id=2, quest=1, fire=3, constellation=1),
            StrandClassification(chapter_id=3, quest=1, fire=1, constellation=3),
        ]
        advice = advisor.quick_advise(classifs)
        assert advice.recommended_strand in ("quest", "fire", "constellation")


# =============================================================================
# _get_suggested_elements
# =============================================================================


class TestSuggestedElements:
    """Test element suggestions."""

    def test_quest_elements(self, advisor):
        elements = advisor._get_suggested_elements("quest")
        assert len(elements) >= 3
        assert any("任务" in e or "目标" in e for e in elements)

    def test_fire_elements(self, advisor):
        elements = advisor._get_suggested_elements("fire")
        assert len(elements) >= 3
        assert any("情感" in e or "感情" in e for e in elements)

    def test_constellation_elements(self, advisor):
        elements = advisor._get_suggested_elements("constellation")
        assert len(elements) >= 3

    def test_unknown_strand_defaults_to_quest(self, advisor):
        elements = advisor._get_suggested_elements("unknown")
        assert len(elements) >= 3

    def test_fire_or_constellation_elements(self, advisor):
        elements = advisor._get_suggested_elements("fire_or_constellation")
        assert len(elements) >= 3
