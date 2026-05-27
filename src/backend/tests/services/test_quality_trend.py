"""Tests for Quality Trend Service - parsing inspections, risk flags, dimension trends."""

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.quality_trend import QualityTrendService


@pytest.fixture
def service():
    return QualityTrendService()


# =============================================================================
# _parse_inspection
# =============================================================================


class TestParseInspection:
    """Test inspection parsing."""

    def _make_insp(self, **kwargs):
        defaults = {
            "id": 1,
            "chapter_id": 10,
            "inspection_type": "quality",
            "created_at": datetime(2024, 1, 1, tzinfo=timezone.utc),
            "auto_fixed": 0,
            "issues_json": None,
            "suggestions_json": None,
        }
        defaults.update(kwargs)
        return MagicMock(**defaults)

    def test_basic_parse(self, service):
        insp = self._make_insp()
        result = service._parse_inspection(insp)
        assert result["id"] == 1
        assert result["chapter_id"] == 10
        assert result["inspection_type"] == "quality"
        assert result["auto_fixed"] is False
        assert result["overall_score"] is None

    def test_parse_issues_list(self, service):
        issues = [{"severity": "high"}, {"severity": "high"}, {"severity": "low"}]
        insp = self._make_insp(issues_json=json.dumps(issues))
        result = service._parse_inspection(insp)
        assert result["severity_counts"]["high"] == 2
        assert result["severity_counts"]["low"] == 1

    def test_parse_issues_dict(self, service):
        issues = {"high": 3, "low": 1}
        insp = self._make_insp(issues_json=json.dumps(issues))
        result = service._parse_inspection(insp)
        assert result["severity_counts"]["high"] == 3

    def test_parse_suggestions_list(self, service):
        suggestions = [
            {"dimension": "pacing", "score": 80},
            {"dimension": "dialogue", "score": 70},
        ]
        insp = self._make_insp(suggestions_json=json.dumps(suggestions))
        result = service._parse_inspection(insp)
        assert result["dimension_scores"]["pacing"] == 80.0
        assert result["dimension_scores"]["dialogue"] == 70.0
        assert result["overall_score"] == 75.0

    def test_parse_suggestions_dict(self, service):
        suggestions = {"pacing": 85, "dialogue": 75}
        insp = self._make_insp(suggestions_json=json.dumps(suggestions))
        result = service._parse_inspection(insp)
        assert result["dimension_scores"]["pacing"] == 85.0
        assert result["overall_score"] == 80.0

    def test_parse_suggestions_dict_with_score_key(self, service):
        suggestions = {"pacing": {"score": 90}, "dialogue": {"score": 70}}
        insp = self._make_insp(suggestions_json=json.dumps(suggestions))
        result = service._parse_inspection(insp)
        assert result["dimension_scores"]["pacing"] == 90.0

    def test_parse_invalid_json_no_error(self, service):
        insp = self._make_insp(issues_json="not json{{{")
        result = service._parse_inspection(insp)
        assert result["severity_counts"] == {}

    def test_auto_fixed_true(self, service):
        insp = self._make_insp(auto_fixed=1)
        result = service._parse_inspection(insp)
        assert result["auto_fixed"] is True


# =============================================================================
# _detect_risk_flags
# =============================================================================


class TestDetectRiskFlags:
    """Test risk flag detection."""

    def test_no_flags_when_healthy(self, service):
        flags = service._detect_risk_flags(
            overall_avg=85.0,
            severity_totals={},
            dimension_avg={"pacing": 80.0, "dialogue": 80.0},
            chapter_scores=[],
            trend_items=[],
        )
        assert len(flags) == 1
        assert "稳定" in flags[0]

    def test_low_overall_avg_warning(self, service):
        flags = service._detect_risk_flags(
            overall_avg=68.0,
            severity_totals={},
            dimension_avg={},
            chapter_scores=[],
            trend_items=[],
        )
        assert any("偏低" in f for f in flags)

    def test_critical_overall_avg(self, service):
        flags = service._detect_risk_flags(
            overall_avg=55.0,
            severity_totals={},
            dimension_avg={},
            chapter_scores=[],
            trend_items=[],
        )
        assert any("严重偏低" in f for f in flags)

    def test_critical_issues_detected(self, service):
        flags = service._detect_risk_flags(
            overall_avg=80.0,
            severity_totals={"critical": 2},
            dimension_avg={},
            chapter_scores=[],
            trend_items=[],
        )
        assert any("严重" in f and "2" in f for f in flags)

    def test_high_issues_threshold(self, service):
        flags = service._detect_risk_flags(
            overall_avg=80.0,
            severity_totals={"high": 10},
            dimension_avg={},
            chapter_scores=[],
            trend_items=[],
        )
        assert any("高级别" in f for f in flags)

    def test_low_dimension_score(self, service):
        flags = service._detect_risk_flags(
            overall_avg=80.0,
            severity_totals={},
            dimension_avg={"pacing": 55.0},
            chapter_scores=[],
            trend_items=[],
        )
        assert any("pacing" in f for f in flags)

    def test_declining_trend_detected(self, service):
        # Create chapter scores that show decline
        chapter_scores = [
            {"chapter_id": i, "best_score": 90 - i * 3}
            for i in range(15)
        ]
        flags = service._detect_risk_flags(
            overall_avg=80.0,
            severity_totals={},
            dimension_avg={},
            chapter_scores=chapter_scores,
            trend_items=[],
        )
        assert any("下降趋势" in f for f in flags)


# =============================================================================
# Threshold constants
# =============================================================================


class TestThresholds:
    """Test service threshold constants."""

    def test_warning_threshold(self, service):
        assert service.OVERALL_SCORE_WARNING == 70.0

    def test_critical_threshold(self, service):
        assert service.OVERALL_SCORE_CRITICAL == 60.0

    def test_decline_window(self, service):
        assert service.DECLINE_WINDOW_CHAPTERS == 10
