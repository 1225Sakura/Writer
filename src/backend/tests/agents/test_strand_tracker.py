"""Tests for StrandTracker — story strand tracking and analysis.

Covers:
- StrandTracker initialization with default and custom rules
- StrandRatio, RedLineCheck, StrandAdjustment data models
- StrandAnalysisReport serialization
- Red line rule definitions
- Target ratio configuration
"""

from __future__ import annotations

import pytest

from backend.agents.strand_tracker import (
    StrandTracker,
    StrandRatio,
    RedLineCheck,
    StrandAdjustment,
    StrandAnalysisReport,
)


# ===========================================================================
# Initialization Tests
# ===========================================================================

class TestStrandTrackerInit:
    """Test StrandTracker initialization."""

    def test_creation_with_defaults(self):
        tracker = StrandTracker()
        assert tracker is not None

    def test_default_rules_loaded(self):
        tracker = StrandTracker()
        assert "main_line_dominance" in tracker._rules
        assert "if_line_ceiling" in tracker._rules
        assert "sub_line_balance" in tracker._rules

    def test_default_target_ratios(self):
        tracker = StrandTracker()
        assert tracker._target_ratios["main"] == 0.65
        assert tracker._target_ratios["sub"] == 0.15
        assert tracker._target_ratios["if"] == 0.20

    def test_custom_rules_override(self):
        custom = {"my_rule": {"name": "custom", "threshold": 0.5, "severity": "info", "target_type": "main", "operator": ">="}}
        tracker = StrandTracker(rules=custom)
        assert "my_rule" in tracker._rules

    def test_custom_target_ratios(self):
        tracker = StrandTracker(target_ratios={"main": 0.70, "sub": 0.20, "if": 0.10})
        assert tracker._target_ratios["main"] == 0.70


# ===========================================================================
# Data Model Tests
# ===========================================================================

class TestStrandRatio:
    """Test StrandRatio dataclass."""

    def test_creation(self):
        ratio = StrandRatio(
            strand_id="main_1",
            strand_name="主线",
            strand_type="main",
            word_count=5000,
            chapter_count=10,
            ratio=0.65,
            target_ratio=0.65,
            deviation=0.0,
        )
        assert ratio.strand_type == "main"
        assert ratio.word_count == 5000

    def test_defaults(self):
        ratio = StrandRatio(strand_id="s1", strand_name="test", strand_type="sub")
        assert ratio.word_count == 0
        assert ratio.ratio == 0.0


class TestRedLineCheck:
    """Test RedLineCheck dataclass."""

    def test_creation(self):
        check = RedLineCheck(
            rule_name="main_dominance",
            passed=True,
            severity="error",
            message="主线占比达标",
            actual_value=0.65,
            threshold_value=0.60,
        )
        assert check.passed is True
        assert check.actual_value == 0.65


class TestStrandAdjustment:
    """Test StrandAdjustment dataclass."""

    def test_creation(self):
        adj = StrandAdjustment(
            strand_id="sub_1",
            strand_name="副线",
            current_ratio=0.10,
            target_ratio=0.15,
            suggestion="增加副线篇幅",
            priority="medium",
        )
        assert adj.priority == "medium"


class TestStrandAnalysisReport:
    """Test StrandAnalysisReport dataclass."""

    def test_defaults(self):
        report = StrandAnalysisReport()
        assert report.total_word_count == 0
        assert report.overall_health_score == 1.0
        assert report.strand_ratios == []

    def test_to_dict_empty(self):
        report = StrandAnalysisReport()
        d = report.to_dict()
        assert d["total_word_count"] == 0
        assert d["strand_ratios"] == []
        assert d["red_line_checks"] == []
        assert d["adjustments"] == []

    def test_to_dict_with_data(self):
        report = StrandAnalysisReport(
            total_word_count=10000,
            total_chapter_count=20,
            strand_ratios=[
                StrandRatio(strand_id="main", strand_name="主线", strand_type="main", word_count=6500, ratio=0.65, target_ratio=0.65),
            ],
            red_line_checks=[
                RedLineCheck(rule_name="main_dominance", passed=True, severity="error", message="ok", actual_value=0.65, threshold_value=0.60),
            ],
            adjustments=[
                StrandAdjustment(strand_id="sub", strand_name="副线", current_ratio=0.10, target_ratio=0.15, suggestion="增加副线"),
            ],
            overall_health_score=0.85,
            summary="整体健康",
        )
        d = report.to_dict()
        assert d["total_word_count"] == 10000
        assert len(d["strand_ratios"]) == 1
        assert len(d["red_line_checks"]) == 1
        assert len(d["adjustments"]) == 1
        assert d["overall_health_score"] == 0.85


# ===========================================================================
# Default Rules Tests
# ===========================================================================

class TestDefaultRules:
    """Test default red line rules."""

    def test_main_line_dominance_rule(self):
        rule = StrandTracker.DEFAULT_RULES["main_line_dominance"]
        assert rule["threshold"] == 0.60
        assert rule["operator"] == ">="
        assert rule["severity"] == "error"

    def test_if_line_ceiling_rule(self):
        rule = StrandTracker.DEFAULT_RULES["if_line_ceiling"]
        assert rule["threshold"] == 0.30
        assert rule["operator"] == "<="
        assert rule["severity"] == "warning"

    def test_sub_line_balance_rule(self):
        rule = StrandTracker.DEFAULT_RULES["sub_line_balance"]
        assert rule["threshold"] == 0.25
        assert rule["operator"] == "<="
        assert rule["severity"] == "warning"
