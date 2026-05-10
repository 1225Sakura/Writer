"""Tests for Constraint DSL Parser."""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock

from backend.services.constraint_dsl import (
    ConstraintDSLCParser,
    DSLValidationError,
    ConditionParser,
    CharacterMilestoneCondition,
    FieldMonotonicCondition,
    MonotonicMode,
    ConditionType,
)
from backend.services.constraint_engine import (
    ConstraintRule,
    LawType,
    Severity,
    RuleStatus,
)


# =============================================================================
# Condition Parser Tests
# =============================================================================

class TestConditionParser:
    """Test condition dictionary parsing."""

    def test_parse_character_milestone_condition(self):
        """Parsing character milestone condition works correctly."""
        data = {
            "type": "character_milestone",
            "character": "主角",
            "milestone": "death",
            "prohibited_before_chapter": 10,
        }
        cond = ConditionParser.parse(data)

        assert isinstance(cond, CharacterMilestoneCondition)
        assert cond.character == "主角"
        assert cond.milestone == "death"
        assert cond.prohibited_before_chapter == 10

    def test_parse_field_monotonic_condition(self):
        """Parsing field monotonic condition works correctly."""
        data = {
            "type": "field_monotonic",
            "entity_type": "character",
            "field": "cultivation_realm",
            "mode": "non_decreasing",
        }
        cond = ConditionParser.parse(data)

        assert isinstance(cond, FieldMonotonicCondition)
        assert cond.entity_type == "character"
        assert cond.field == "cultivation_realm"
        assert cond.mode == MonotonicMode.NON_DECREASING

    def test_parse_unknown_condition_returns_none(self):
        """Parsing unknown condition type returns None."""
        data = {"type": "unknown_condition"}
        cond = ConditionParser.parse(data)

        assert cond is None

    def test_parse_all_filters_invalid(self):
        """parse_all filters out invalid conditions."""
        conditions_data = [
            {"type": "character_milestone", "character": "主角", "milestone": "death"},
            {"type": "unknown_type"},
        ]
        conditions = ConditionParser.parse_all(conditions_data)

        assert len(conditions) == 1
        assert isinstance(conditions[0], CharacterMilestoneCondition)


# =============================================================================
# DSL Parser Tests
# =============================================================================

class TestConstraintDSLCParser:
    """Test Constraint DSL parsing."""

    def test_parse_simple_yaml_rule(self):
        """Parsing simple YAML rule works correctly."""
        dsl_content = """
rules:
  - id: "test_rule_1"
    law_type: "outline_law"
    name: "测试规则"
    description: "这是一个测试规则"
    severity: "high"
    conditions:
      - type: "character_milestone"
        character: "主角"
        milestone: "death"
        prohibited_before_chapter: 10
"""
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)

        assert len(rules) == 1
        rule = rules[0]
        assert rule.id == "test_rule_1"
        assert rule.law_type == LawType.OUTLINE_LAW
        assert rule.name == "测试规则"
        assert rule.severity == Severity.HIGH
        assert "conditions" in rule.metadata

    def test_parse_multiple_rules(self):
        """Parsing multiple rules works correctly."""
        dsl_content = """
rules:
  - id: "rule_1"
    law_type: "outline_law"
    name: "规则1"
    conditions:
      - type: "character_milestone"
        character: "主角"
        milestone: "death"
        prohibited_before_chapter: 10

  - id: "rule_2"
    law_type: "setting_physics"
    name: "规则2"
    conditions:
      - type: "field_monotonic"
        entity_type: "character"
        field: "cultivation_realm"
        mode: "non_decreasing"
"""
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)

        assert len(rules) == 2
        assert rules[0].id == "rule_1"
        assert rules[1].id == "rule_2"

    def test_parse_json_content(self):
        """Parsing JSON content works correctly."""
        dsl_content = '{"rules": [{"id": "json_rule", "law_type": "outline_law", "name": "JSON规则", "conditions": []}]}'
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)

        assert len(rules) == 1
        assert rules[0].id == "json_rule"

    def test_parse_invalid_yaml_raises_error(self):
        """Invalid YAML raises DSLValidationError."""
        dsl_content = "invalid: yaml: content: ["
        parser = ConstraintDSLCParser()

        with pytest.raises(DSLValidationError):
            parser.parse(dsl_content)

    def test_parse_missing_rule_id_raises_error(self):
        """Rule without ID raises DSLValidationError."""
        dsl_content = """
rules:
  - law_type: "outline_law"
    name: "无ID规则"
    conditions: []
"""
        parser = ConstraintDSLCParser()

        with pytest.raises(DSLValidationError) as exc_info:
            parser.parse(dsl_content)
        assert "missing" in str(exc_info.value).lower()

    def test_parse_invalid_law_type_raises_error(self):
        """Invalid law_type raises DSLValidationError."""
        dsl_content = """
rules:
  - id: "bad_law_type"
    law_type: "invalid_law"
    name: "测试"
    conditions: []
"""
        parser = ConstraintDSLCParser()

        with pytest.raises(DSLValidationError) as exc_info:
            parser.parse(dsl_content)
        assert "law_type" in str(exc_info.value).lower()

    def test_parse_invalid_severity_raises_error(self):
        """Invalid severity raises DSLValidationError."""
        dsl_content = """
rules:
  - id: "bad_severity"
    law_type: "outline_law"
    name: "测试"
    severity: "invalid"
    conditions: []
"""
        parser = ConstraintDSLCParser()

        with pytest.raises(DSLValidationError) as exc_info:
            parser.parse(dsl_content)
        assert "severity" in str(exc_info.value).lower()


class TestDSLValidation:
    """Test DSL validation without parsing."""

    def test_validate_valid_dsl(self):
        """Valid DSL passes validation."""
        dsl_content = """
rules:
  - id: "valid_rule"
    law_type: "outline_law"
    name: "测试规则"
    severity: "high"
    conditions:
      - type: "character_milestone"
        character: "主角"
        milestone: "death"
"""
        parser = ConstraintDSLCParser()
        is_valid, errors = parser.validate(dsl_content)

        assert is_valid is True
        assert len(errors) == 0

    def test_validate_invalid_dsl_returns_errors(self):
        """Invalid DSL returns error messages."""
        dsl_content = """
rules:
  - law_type: "outline_law"
    name: "缺少ID"
"""
        parser = ConstraintDSLCParser()
        is_valid, errors = parser.validate(dsl_content)

        assert is_valid is False
        assert len(errors) > 0

    def test_validate_unknown_condition_type(self):
        """Unknown condition type is reported."""
        dsl_content = """
rules:
  - id: "bad_condition"
    law_type: "outline_law"
    name: "测试"
    conditions:
      - type: "unknown_condition"
"""
        parser = ConstraintDSLCParser()
        is_valid, errors = parser.validate(dsl_content)

        assert is_valid is False
        assert any("unknown_condition" in e for e in errors)


# =============================================================================
# Condition Validation Tests
# =============================================================================

class TestCharacterMilestoneConditionValidation:
    """Test CharacterMilestoneCondition validation."""

    def test_validate_empty_character_returns_error(self):
        """Empty character name returns validation error."""
        cond = CharacterMilestoneCondition(
            character="",
            milestone="death",
        )
        errors = cond.validate()

        assert len(errors) > 0
        assert any("character" in e for e in errors)

    def test_validate_empty_milestone_returns_error(self):
        """Empty milestone returns validation error."""
        cond = CharacterMilestoneCondition(
            character="主角",
            milestone="",
        )
        errors = cond.validate()

        assert len(errors) > 0
        assert any("milestone" in e for e in errors)

    def test_validate_negative_chapter_returns_error(self):
        """Negative prohibited_before_chapter returns validation error."""
        cond = CharacterMilestoneCondition(
            character="主角",
            milestone="death",
            prohibited_before_chapter=-1,
        )
        errors = cond.validate()

        assert len(errors) > 0


class TestFieldMonotonicConditionValidation:
    """Test FieldMonotonicCondition validation."""

    def test_validate_empty_entity_type_returns_error(self):
        """Empty entity_type returns validation error."""
        cond = FieldMonotonicCondition(
            entity_type="",
            field="cultivation_realm",
            mode=MonotonicMode.NON_DECREASING,
        )
        errors = cond.validate()

        assert len(errors) > 0
        assert any("entity_type" in e for e in errors)

    def test_validate_valid_condition_returns_no_errors(self):
        """Valid condition returns no errors."""
        cond = FieldMonotonicCondition(
            entity_type="character",
            field="cultivation_realm",
            mode=MonotonicMode.NON_DECREASING,
        )
        errors = cond.validate()

        assert len(errors) == 0


# =============================================================================
# Condition Check Tests
# =============================================================================

class TestCharacterMilestoneConditionCheck:
    """Test CharacterMilestoneCondition checking."""

    def test_check_detects_death_before_chapter(self):
        """Detects character death before prohibited chapter."""
        cond = CharacterMilestoneCondition(
            character="主角",
            milestone="death",
            prohibited_before_chapter=10,
        )
        content = "主角被敌人击中，死了。"
        context = {"current_chapter": 5}

        violations = cond.check(content, context)

        assert len(violations) == 1
        assert "主角" in violations[0].message
        assert violations[0].severity == Severity.CRITICAL

    def test_check_allows_death_after_chapter(self):
        """Allows character death after permitted chapter."""
        cond = CharacterMilestoneCondition(
            character="主角",
            milestone="death",
            prohibited_before_chapter=10,
        )
        content = "主角被敌人击中，死了。"
        context = {"current_chapter": 15}

        violations = cond.check(content, context)

        assert len(violations) == 0

    def test_check_no_death_returns_empty(self):
        """No death in content returns no violations."""
        cond = CharacterMilestoneCondition(
            character="主角",
            milestone="death",
            prohibited_before_chapter=10,
        )
        content = "主角与敌人战斗，胜利了。"
        context = {"current_chapter": 5}

        violations = cond.check(content, context)

        assert len(violations) == 0


# =============================================================================
# Rule Generation Tests
# =============================================================================

class TestConstraintRuleGeneration:
    """Test ConstraintRule generation from DSL."""

    def test_rule_has_pattern_when_generated(self):
        """Generated rule has pattern for character milestone."""
        dsl_content = """
rules:
  - id: "no_death_rule"
    law_type: "outline_law"
    name: "不死规则"
    conditions:
      - type: "character_milestone"
        character: "主角"
        milestone: "death"
        prohibited_before_chapter: 10
"""
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)

        assert len(rules) == 1
        assert rules[0].pattern is not None
        assert "主角" in rules[0].pattern or len(rules[0].pattern) > 0

    def test_rule_conditions_stored_in_metadata(self):
        """Parsed conditions are stored in rule metadata."""
        dsl_content = """
rules:
  - id: "test_rule"
    law_type: "outline_law"
    name: "测试"
    conditions:
      - type: "character_milestone"
        character: "主角"
        milestone: "death"
"""
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)

        assert "conditions" in rules[0].metadata
        assert len(rules[0].metadata["conditions"]) == 1
        assert rules[0].metadata["conditions"][0]["type"] == "character_milestone"


# =============================================================================
# Error Handling Tests
# =============================================================================

class TestDSLValidationErrors:
    """Test DSL validation error handling."""

    def test_validation_error_contains_errors_list(self):
        """DSLValidationError contains list of specific errors."""
        dsl_content = """
rules:
  - id: "rule1"
    law_type: "outline_law"
    name: "规则1"
    conditions:
      - type: "character_milestone"
        character: ""
        milestone: "death"
"""
        parser = ConstraintDSLCParser()

        with pytest.raises(DSLValidationError) as exc_info:
            parser.parse(dsl_content)
        assert exc_info.value.errors is not None
        assert len(exc_info.value.errors) > 0

    def test_parse_empty_rules_list(self):
        """Empty rules list parses successfully."""
        dsl_content = """
rules: []
"""
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)

        assert len(rules) == 0

    def test_parse_rules_not_list_raises_error(self):
        """Non-list rules raises DSLValidationError."""
        dsl_content = """
rules:
  id: "not_a_list"
"""
        parser = ConstraintDSLCParser()

        with pytest.raises(DSLValidationError) as exc_info:
            parser.parse(dsl_content)
        assert "rules" in str(exc_info.value).lower()
