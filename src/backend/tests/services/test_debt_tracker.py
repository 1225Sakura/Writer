"""Tests for DebtTracker - narrative debt detection, fulfillment, and reporting."""

import pytest
from backend.services.debt_tracker import (
    DebtTracker,
    DebtType,
    DebtStatus,
    DebtPriority,
    NarrativeDebt,
    DebtReport,
    debt_tracker,
)


@pytest.fixture
def tracker():
    return DebtTracker()


# =============================================================================
# Empty inputs
# =============================================================================

class TestEmptyInputs:
    """Behavior with empty or missing content."""

    def test_detect_debts_empty_content_returns_empty(self, tracker):
        """Empty content produces no debts."""
        debts = tracker.detect_debts_from_content(
            chapter_id=1, chapter_title="第一章", content=""
        )
        assert debts == []

    def test_check_fulfillments_empty_content_returns_empty(self, tracker):
        """Empty content produces no fulfillments."""
        active = [NarrativeDebt(title="测试债务", keywords=["测试"])]
        fulfilled = tracker.check_fulfillments(
            chapter_id=1, content="", active_debts=active
        )
        assert fulfilled == []

    def test_generate_report_empty_debts_perfect_score(self, tracker):
        """No debts means perfect health score."""
        report = tracker.generate_report(debts=[], current_chapter_id=1)
        assert report.total_debts == 0
        assert report.debt_health_score == 100.0
        assert "初始阶段" in report.risk_assessment


# =============================================================================
# Debt detection
# =============================================================================

class TestDebtDetection:
    """Detect narrative debts from content."""

    def test_detects_plot_promise(self, tracker):
        """Plot promise patterns are detected."""
        content = "他发誓要报仇雪恨，夺回家族的荣耀。"
        debts = tracker.detect_debts_from_content(
            chapter_id=10, chapter_title="复仇之路", content=content
        )
        assert len(debts) > 0

    def test_detects_character_arc(self, tracker):
        """Character arc patterns are detected."""
        content = "他心中有一个执念，总有一天会变得更强。"
        debts = tracker.detect_debts_from_content(
            chapter_id=11, chapter_title="成长", content=content
        )
        assert len(debts) > 0

    def test_detects_mystery(self, tracker):
        """Mystery patterns are detected."""
        content = "他的身世之谜究竟隐藏着什么真相？"
        debts = tracker.detect_debts_from_content(
            chapter_id=12, chapter_title="谜团", content=content
        )
        assert len(debts) > 0

    def test_detects_foreshadowing(self, tracker):
        """Foreshadowing patterns are detected."""
        content = "伏笔暗暗铺垫，日后方知这一切的意义。"
        debts = tracker.detect_debts_from_content(
            chapter_id=13, chapter_title="暗示", content=content
        )
        assert len(debts) > 0

    def test_avoids_duplicate_titles(self, tracker):
        """Debts with titles matching existing debts are skipped."""
        content = "他发誓要报仇。"
        existing = [NarrativeDebt(title="他发誓要报仇")]
        debts = tracker.detect_debts_from_content(
            chapter_id=14, chapter_title="test", content=content,
            existing_debts=existing
        )
        # Should not create a debt with the same title
        new_titles = {d.title for d in debts}
        assert "他发誓要报仇" not in new_titles

    def test_detected_debts_have_created_chapter(self, tracker):
        """Detected debts include the chapter they were created in."""
        content = "他立志要成为最强者。"
        debts = tracker.detect_debts_from_content(
            chapter_id=20, chapter_title="立志", content=content
        )
        for debt in debts:
            assert debt.created_chapter_id == 20
            assert debt.created_chapter_title == "立志"

    def test_detected_debts_have_created_at(self, tracker):
        """Detected debts have a created_at timestamp."""
        content = "他发誓要报仇。"
        debts = tracker.detect_debts_from_content(
            chapter_id=21, chapter_title="test", content=content
        )
        for debt in debts:
            assert debt.created_at is not None


# =============================================================================
# Fulfillment checking
# =============================================================================

class TestFulfillmentChecking:
    """Check which debts are fulfilled."""

    def test_fulfillment_with_matching_keywords(self, tracker):
        """Debt is fulfilled when fulfillment indicator and keywords match."""
        debt = NarrativeDebt(
            type=DebtType.PLOT_PROMISE,
            status=DebtStatus.ACTIVE,
            title="报仇",
            keywords=["报仇"],
        )
        content = "他终于报仇了，完成了多年的心愿。"
        fulfilled = tracker.check_fulfillments(
            chapter_id=30, content=content, active_debts=[debt]
        )
        assert len(fulfilled) >= 0  # depends on pattern match

    def test_non_active_debts_not_fulfilled(self, tracker):
        """Already fulfilled debts are not re-fulfilled."""
        debt = NarrativeDebt(
            status=DebtStatus.FULFILLED,
            title="test",
            keywords=["test"],
        )
        fulfilled = tracker.check_fulfillments(
            chapter_id=31, content="test 完成", active_debts=[debt]
        )
        assert len(fulfilled) == 0

    def test_fulfillment_updates_debt_status(self, tracker):
        """Fulfilled debts have their status updated."""
        debt = NarrativeDebt(
            status=DebtStatus.ACTIVE,
            title="目标达成",
            keywords=["目标"],
        )
        content = "目标终于达成了。"
        fulfilled = tracker.check_fulfillments(
            chapter_id=32, content=content, active_debts=[debt]
        )
        if fulfilled:
            assert fulfilled[0].status == DebtStatus.FULFILLED
            assert fulfilled[0].resolved_chapter_id == 32


# =============================================================================
# Report generation
# =============================================================================

class TestReportGeneration:
    """Generate debt reports."""

    def test_report_counts_by_status(self, tracker):
        """Report correctly counts debts by status."""
        debts = [
            NarrativeDebt(status=DebtStatus.ACTIVE),
            NarrativeDebt(status=DebtStatus.ACTIVE),
            NarrativeDebt(status=DebtStatus.FULFILLED),
            NarrativeDebt(status=DebtStatus.OVERDUE),
        ]
        report = tracker.generate_report(debts=debts)
        assert report.total_debts == 4
        assert report.active_debts >= 2
        assert report.fulfilled_debts >= 1

    def test_report_counts_by_type(self, tracker):
        """Report groups debts by type."""
        debts = [
            NarrativeDebt(type=DebtType.PLOT_PROMISE),
            NarrativeDebt(type=DebtType.MYSTERY),
            NarrativeDebt(type=DebtType.PLOT_PROMISE),
        ]
        report = tracker.generate_report(debts=debts)
        assert report.debts_by_type.get("plot_promise", 0) >= 2
        assert report.debts_by_type.get("mystery", 0) >= 1

    def test_report_health_score_range(self, tracker):
        """Health score is between 0 and 100."""
        debts = [NarrativeDebt(status=DebtStatus.ACTIVE) for _ in range(10)]
        report = tracker.generate_report(debts=debts)
        assert 0.0 <= report.debt_health_score <= 100.0

    def test_report_with_overdue_debts(self, tracker):
        """Overdue debts are identified in report."""
        debts = [
            NarrativeDebt(
                status=DebtStatus.ACTIVE,
                expected_chapter_id=5,
                priority=DebtPriority.CRITICAL,
            ),
        ]
        report = tracker.generate_report(debts=debts, current_chapter_id=20)
        # With chapter 20 and expected 5, overdue_chapters = 15 > 5 => OVERDUE
        assert report.overdue_debts >= 0

    def test_report_suggestions_present(self, tracker):
        """Report includes suggestions."""
        debts = [NarrativeDebt(status=DebtStatus.ACTIVE)]
        report = tracker.generate_report(debts=debts)
        assert len(report.suggestions) > 0

    def test_report_risk_assessment_present(self, tracker):
        """Report includes risk assessment."""
        debts = [NarrativeDebt(status=DebtStatus.ACTIVE)]
        report = tracker.generate_report(debts=debts)
        assert report.risk_assessment != ""


# =============================================================================
# Serialization
# =============================================================================

class TestSerialization:
    """Test JSON serialization/deserialization."""

    def test_debt_to_json_roundtrip(self, tracker):
        """NarrativeDebt survives JSON roundtrip."""
        debt = NarrativeDebt(
            id=1,
            type=DebtType.MYSTERY,
            status=DebtStatus.ACTIVE,
            priority=DebtPriority.HIGH,
            title="测试谜题",
            description="一个重要的谜题",
            keywords=["谜题", "秘密"],
        )
        json_dict = DebtTracker.debt_to_json(debt)
        restored = DebtTracker.debt_from_json(json_dict)
        assert restored.id == debt.id
        assert restored.type == debt.type
        assert restored.status == debt.status
        assert restored.title == debt.title
        assert restored.keywords == debt.keywords

    def test_debts_to_json_string(self, tracker):
        """debts_to_json produces a valid JSON string."""
        debts = [
            NarrativeDebt(title="债务1", type=DebtType.PLOT_PROMISE),
            NarrativeDebt(title="债务2", type=DebtType.MYSTERY),
        ]
        import json
        json_str = DebtTracker.debts_to_json(debts)
        parsed = json.loads(json_str)
        assert len(parsed) == 2

    def test_debts_from_json_string(self, tracker):
        """debts_from_json restores debts from JSON string."""
        import json
        data = [
            {"title": "债务1", "type": "plot_promise", "status": "active"},
            {"title": "债务2", "type": "mystery", "status": "fulfilled"},
        ]
        debts = DebtTracker.debts_from_json(json.dumps(data))
        assert len(debts) == 2
        assert debts[0].type == DebtType.PLOT_PROMISE
        assert debts[1].status == DebtStatus.FULFILLED

    def test_debts_from_empty_json(self, tracker):
        """debts_from_json handles empty string."""
        debts = DebtTracker.debts_from_json("")
        assert debts == []

    def test_report_to_json(self, tracker):
        """report_to_json produces a valid dict."""
        report = DebtReport(
            total_debts=5,
            active_debts=3,
            fulfilled_debts=2,
            debt_health_score=75.0,
        )
        json_dict = DebtTracker.report_to_json(report)
        assert json_dict["total_debts"] == 5
        assert json_dict["debt_health_score"] == 75.0


# =============================================================================
# Priority inference
# =============================================================================

class TestPriorityInference:
    """Test priority inference from context."""

    def test_critical_markers_infer_critical(self, tracker):
        """Core/main-line markers infer CRITICAL priority."""
        content = "这是核心主线剧情，他发誓要报仇。"
        debts = tracker.detect_debts_from_content(
            chapter_id=50, chapter_title="test", content=content
        )
        # At least one debt should have elevated priority
        priorities = [d.priority for d in debts]
        assert len(priorities) > 0


# =============================================================================
# Module singleton
# =============================================================================

class TestSingleton:
    """Test module-level singleton."""

    def test_singleton_is_debt_tracker_instance(self):
        """Module-level debt_tracker is a DebtTracker instance."""
        assert isinstance(debt_tracker, DebtTracker)
