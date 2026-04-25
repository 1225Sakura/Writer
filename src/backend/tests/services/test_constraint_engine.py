"""Tests for enhanced ConstraintEngine."""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from services.constraint_engine import (
    ConstraintEngine,
    ConstraintRule,
    ConstraintViolation,
    ConstraintCheckResult,
    LawType,
    Severity,
    RuleStatus,
)


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def mock_ai_service():
    """Create a mock AI service."""
    service = MagicMock()
    service.analyze = AsyncMock(return_value={"issues": []})
    return service


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = MagicMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture
def constraint_engine(mock_db_session, mock_ai_service):
    """Create a ConstraintEngine with mocked dependencies."""
    engine = ConstraintEngine(
        db=mock_db_session,
        ai_service=mock_ai_service,
    )
    return engine


# =============================================================================
# Test ConstraintViolation
# =============================================================================

class TestConstraintViolation:
    """Test ConstraintViolation model."""

    def test_violation_to_dict(self):
        """Violation converts to dict correctly."""
        violation = ConstraintViolation(
            rule_id="test_rule",
            law_type=LawType.OUTLINE_LAW,
            severity=Severity.HIGH,
            message="Test violation message",
            evidence="evidence text",
            location="paragraph 1",
            suggestion="Fix this",
        )
        d = violation.to_dict()

        assert d["rule_id"] == "test_rule"
        assert d["law_type"] == "outline_law"
        assert d["severity"] == "high"
        assert d["message"] == "Test violation message"
        assert d["evidence"] == "evidence text"
        assert d["location"] == "paragraph 1"
        assert d["suggestion"] == "Fix this"


# =============================================================================
# Test ConstraintCheckResult
# =============================================================================

class TestConstraintCheckResult:
    """Test ConstraintCheckResult model."""

    def test_result_to_dict(self):
        """Result converts to dict correctly."""
        violation = ConstraintViolation(
            rule_id="rule1",
            law_type=LawType.OUTLINE_LAW,
            severity=Severity.MEDIUM,
            message="Message",
        )
        result = ConstraintCheckResult(
            passed=True,
            overall_score=85,
            violations=[violation],
            rules_checked=["rule1", "rule2"],
            summary="Passed",
        )
        d = result.to_dict()

        assert d["passed"] is True
        assert d["overall_score"] == 85
        assert len(d["violations"]) == 1
        assert d["rules_checked"] == ["rule1", "rule2"]
        assert d["summary"] == "Passed"

    def test_result_empty_violations(self):
        """Result with no violations."""
        result = ConstraintCheckResult(
            passed=True,
            overall_score=100,
            violations=[],
            rules_checked=[],
        )

        assert result.passed is True
        assert result.overall_score == 100
        assert len(result.violations) == 0


# =============================================================================
# Test DSL Parsing API
# =============================================================================

class TestConstraintEngineParseDSL:
    """Test ConstraintEngine DSL parsing API."""

    @pytest.mark.asyncio
    async def test_parse_dsl_returns_rules(self, constraint_engine):
        """parse_dsl returns list of ConstraintRule objects."""
        dsl_content = """
rules:
  - id: "test_rule"
    law_type: "outline_law"
    name: "测试规则"
    description: "Test rule"
    conditions:
      - type: "character_milestone"
        character: "主角"
        milestone: "death"
        prohibited_before_chapter: 10
"""
        rules = await constraint_engine.parse_dsl(dsl_content)

        assert len(rules) == 1
        assert rules[0].id == "test_rule"
        assert rules[0].law_type == LawType.OUTLINE_LAW

    @pytest.mark.asyncio
    async def test_parse_dsl_invalid_raises_error(self, constraint_engine):
        """Invalid DSL raises DSLValidationError."""
        from services.constraint_dsl import DSLValidationError

        # Use truly invalid content that fails both YAML and JSON parsing
        dsl_content = "[invalid json"

        with pytest.raises(DSLValidationError):
            await constraint_engine.parse_dsl(dsl_content)


# =============================================================================
# Test DSL Validation API
# =============================================================================

class TestConstraintEngineValidateDSL:
    """Test ConstraintEngine DSL validation API."""

    @pytest.mark.asyncio
    async def test_validate_dsl_valid(self, constraint_engine):
        """validate_dsl returns (True, []) for valid DSL."""
        dsl_content = """
rules:
  - id: "valid_rule"
    law_type: "outline_law"
    name: "测试"
    description: "Test"
    conditions: []
"""
        is_valid, errors = await constraint_engine.validate_dsl(dsl_content)

        assert is_valid is True
        assert len(errors) == 0

    @pytest.mark.asyncio
    async def test_validate_dsl_invalid(self, constraint_engine):
        """validate_dsl returns (False, errors) for invalid DSL."""
        dsl_content = """
rules:
  - law_type: "outline_law"
    name: "缺少ID"
"""
        is_valid, errors = await constraint_engine.validate_dsl(dsl_content)

        assert is_valid is False
        assert len(errors) > 0


# =============================================================================
# Test Rule Validation API
# =============================================================================

class TestConstraintEngineValidateRule:
    """Test ConstraintEngine rule validation API."""

    @pytest.mark.asyncio
    async def test_validate_rule_valid(self, constraint_engine):
        """validate_rule returns True for valid rule."""
        rule = ConstraintRule(
            id="valid_rule",
            law_type=LawType.OUTLINE_LAW,
            name="测试规则",
            description="Test",
            severity=Severity.HIGH,
        )
        is_valid = await constraint_engine.validate_rule(rule)

        assert is_valid is True

    @pytest.mark.asyncio
    async def test_validate_rule_missing_id(self, constraint_engine):
        """validate_rule returns False for rule without ID."""
        rule = ConstraintRule(
            id="",
            law_type=LawType.OUTLINE_LAW,
            name="测试规则",
            description="Test",
            severity=Severity.HIGH,
        )
        is_valid = await constraint_engine.validate_rule(rule)

        assert is_valid is False

    @pytest.mark.asyncio
    async def test_validate_rule_missing_name(self, constraint_engine):
        """validate_rule returns False for rule without name."""
        rule = ConstraintRule(
            id="no_name_rule",
            law_type=LawType.OUTLINE_LAW,
            name="",
            description="Test",
            severity=Severity.HIGH,
        )
        is_valid = await constraint_engine.validate_rule(rule)

        assert is_valid is False


# =============================================================================
# Test Violation Report Generation
# =============================================================================

class TestConstraintEngineViolationReport:
    """Test ConstraintEngine violation report generation."""

    @pytest.mark.asyncio
    async def test_generate_report_text(self, constraint_engine):
        """generate_violation_report creates text report."""
        violations = [
            ConstraintViolation(
                rule_id="rule1",
                law_type=LawType.OUTLINE_LAW,
                severity=Severity.CRITICAL,
                message="严重违规",
                evidence="证据",
            ),
            ConstraintViolation(
                rule_id="rule2",
                law_type=LawType.SETTING_PHYSICS,
                severity=Severity.HIGH,
                message="高风险违规",
                evidence="证据2",
            ),
        ]
        report = await constraint_engine.generate_violation_report(violations, format="text")

        assert "约束违规报告" in report
        assert "严重违规" in report
        assert "高风险违规" in report
        assert "critical" in report.lower()
        assert "2" in report  # Total violations

    @pytest.mark.asyncio
    async def test_generate_report_json(self, constraint_engine):
        """generate_violation_report creates JSON report."""
        violations = [
            ConstraintViolation(
                rule_id="rule1",
                law_type=LawType.OUTLINE_LAW,
                severity=Severity.HIGH,
                message="Test",
            ),
        ]
        report = await constraint_engine.generate_violation_report(violations, format="json")

        assert "rule1" in report
        assert "outline_law" in report

    @pytest.mark.asyncio
    async def test_generate_report_empty(self, constraint_engine):
        """generate_violation_report handles empty violations."""
        report = await constraint_engine.generate_violation_report([], format="text")

        assert "约束检查通过" in report


# =============================================================================
# Test Real-time Validation API
# =============================================================================

class TestConstraintEngineRealTimeValidation:
    """Test ConstraintEngine real-time validation API."""

    @pytest.mark.asyncio
    async def test_real_time_validate_no_rules(self, constraint_engine):
        """real_time_validate with no rules returns empty result."""
        with patch.object(constraint_engine, "get_rules", AsyncMock(return_value=[])):
            with patch.object(constraint_engine, "_build_context", AsyncMock(return_value={})):
                result = await constraint_engine.real_time_validate("test content")

        assert result.passed is True
        assert result.overall_score == 100
        assert len(result.violations) == 0

    @pytest.mark.asyncio
    async def test_real_time_validate_pattern_detects_violation(self, constraint_engine):
        """real_time_validate detects pattern violations."""
        rule = ConstraintRule(
            id="death_rule",
            law_type=LawType.OUTLINE_LAW,
            name="不死规则",
            description="主角不能死",
            pattern=r"主角[^。！？]{0,20}(?:死了|死亡)",
            severity=Severity.CRITICAL,
        )
        content = "主角被击中，死了。"

        with patch.object(constraint_engine, "get_rules", AsyncMock(return_value=[rule])):
            with patch.object(constraint_engine, "_build_context", AsyncMock(return_value={})):
                result = await constraint_engine.real_time_validate(content, chapter_id=5)

        # Should detect the violation
        assert len(result.violations) > 0
        assert any("主角" in v.message for v in result.violations)
        # Score is reduced by 25 points for critical violation: 100-25=75

    @pytest.mark.asyncio
    async def test_real_time_validate_pattern_matching(self, constraint_engine):
        """real_time_validate matches patterns correctly."""
        rule = ConstraintRule(
            id="test_pattern",
            law_type=LawType.OUTLINE_LAW,
            name="测试模式",
            description="Test pattern",
            pattern=r"测试([^，。！？]+)",
            severity=Severity.MEDIUM,
        )
        content = "这是一个测试内容"

        with patch.object(constraint_engine, "get_rules", AsyncMock(return_value=[rule])):
            with patch.object(constraint_engine, "_build_context", AsyncMock(return_value={})):
                result = await constraint_engine.real_time_validate(content)

        # Pattern should match
        assert len(result.rules_checked) == 1
        assert "test_pattern" in result.rules_checked


# =============================================================================
# Test Score Computation
# =============================================================================

class TestConstraintEngineScoreComputation:
    """Test ConstraintEngine score computation."""

    def test_compute_score_empty_violations(self, constraint_engine):
        """Score is 100 with no violations."""
        score = constraint_engine._compute_score([])
        assert score == 100

    def test_compute_score_critical_violations(self, constraint_engine):
        """Score decreases with critical violations."""
        violations = [
            ConstraintViolation(
                rule_id="r1",
                law_type=LawType.OUTLINE_LAW,
                severity=Severity.CRITICAL,
                message="Test",
            ),
        ]
        score = constraint_engine._compute_score(violations)
        assert score < 100

    def test_compute_score_multiple_violations(self, constraint_engine):
        """Score accounts for multiple violations."""
        violations = [
            ConstraintViolation(rule_id="r1", law_type=LawType.OUTLINE_LAW, severity=Severity.HIGH, message="Test"),
            ConstraintViolation(rule_id="r2", law_type=LawType.OUTLINE_LAW, severity=Severity.MEDIUM, message="Test"),
            ConstraintViolation(rule_id="r3", law_type=LawType.OUTLINE_LAW, severity=Severity.LOW, message="Test"),
        ]
        score = constraint_engine._compute_score(violations)
        assert score < 100
        # HIG=15, MED=8, LOW=3 => 100-15-8-3 = 74
        assert score == 74

    def test_compute_score_minimum_zero(self, constraint_engine):
        """Score does not go below 0."""
        violations = [
            ConstraintViolation(rule_id="r1", law_type=LawType.OUTLINE_LAW, severity=Severity.CRITICAL, message="Test"),
            ConstraintViolation(rule_id="r2", law_type=LawType.OUTLINE_LAW, severity=Severity.CRITICAL, message="Test"),
            ConstraintViolation(rule_id="r3", law_type=LawType.OUTLINE_LAW, severity=Severity.CRITICAL, message="Test"),
            ConstraintViolation(rule_id="r4", law_type=LawType.OUTLINE_LAW, severity=Severity.CRITICAL, message="Test"),
            ConstraintViolation(rule_id="r5", law_type=LawType.OUTLINE_LAW, severity=Severity.CRITICAL, message="Test"),
        ]
        score = constraint_engine._compute_score(violations)
        assert score == 0


# =============================================================================
# Test Summary Building
# =============================================================================

class TestConstraintEngineSummaryBuilding:
    """Test ConstraintEngine summary building."""

    def test_build_summary_empty(self, constraint_engine):
        """Summary for no violations."""
        summary = constraint_engine._build_summary([], 100)
        assert "通过" in summary

    def test_build_summary_with_violations(self, constraint_engine):
        """Summary includes violation counts."""
        violations = [
            ConstraintViolation(rule_id="r1", law_type=LawType.OUTLINE_LAW, severity=Severity.CRITICAL, message="Test"),
            ConstraintViolation(rule_id="r2", law_type=LawType.SETTING_PHYSICS, severity=Severity.HIGH, message="Test"),
        ]
        summary = constraint_engine._build_summary(violations, 60)

        assert "60" in summary
        assert "2" in summary  # 2 violations

    def test_build_summary_critical_warning(self, constraint_engine):
        """Summary includes critical warning."""
        violations = [
            ConstraintViolation(rule_id="r1", law_type=LawType.OUTLINE_LAW, severity=Severity.CRITICAL, message="Test"),
        ]
        summary = constraint_engine._build_summary(violations, 50)

        assert "严重" in summary


# =============================================================================
# Test Enforce API
# =============================================================================

class TestConstraintEngineEnforce:
    """Test ConstraintEngine enforce API."""

    @pytest.mark.asyncio
    async def test_enforce_quick_mode(self, constraint_engine):
        """enforce with mode="quick" calls quick_scan."""
        with patch.object(constraint_engine, "quick_scan", AsyncMock()) as mock_quick:
            mock_quick.return_value = ConstraintCheckResult(
                passed=True, overall_score=100, violations=[], rules_checked=[]
            )
            result = await constraint_engine.enforce("content", mode="quick")

            mock_quick.assert_called_once()

    @pytest.mark.asyncio
    async def test_enforce_deep_mode(self, constraint_engine):
        """enforce with mode="deep" calls deep_analyze."""
        with patch.object(constraint_engine, "deep_analyze", AsyncMock()) as mock_deep:
            mock_deep.return_value = ConstraintCheckResult(
                passed=True, overall_score=100, violations=[], rules_checked=[]
            )
            result = await constraint_engine.enforce("content", mode="deep")

            mock_deep.assert_called_once()
