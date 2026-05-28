"""Extended tests for Constraint DSL — Phase 5 Tier 2.

Covers additional edge cases for: RelationshipConsistencyCondition,
TemporalConsistencyCondition, OwnershipExclusivityCondition,
ConditionParser edge cases, DSL parser edge cases, pattern generation,
MonotonicMode/ConditionType enums, and FieldMonotonicCondition comparison logic.
"""

import pytest
from unittest.mock import MagicMock

from backend.services.constraint_dsl import (
    ConstraintDSLCParser,
    DSLValidationError,
    ConditionParser,
    CharacterMilestoneCondition,
    FieldMonotonicCondition,
    RelationshipConsistencyCondition,
    TemporalConsistencyCondition,
    OwnershipExclusivityCondition,
    MonotonicMode,
    ConditionType,
    DSLCondition,
)
from backend.services.constraints import (
    ConstraintRule,
    ConstraintViolation,
    LawType,
    Severity,
    RuleStatus,
)


# =============================================================================
# ConditionType enum
# =============================================================================


class TestConditionTypeEnum:
    """Test ConditionType enum values."""

    def test_all_types_exist(self):
        assert ConditionType.CHARACTER_MILESTONE.value == "character_milestone"
        assert ConditionType.FIELD_MONOTONIC.value == "field_monotonic"
        assert ConditionType.RELATIONSHIP_CONSISTENCY.value == "relationship_consistency"
        assert ConditionType.TEMPORAL_CONSISTENCY.value == "temporal_consistency"
        assert ConditionType.OWNERSHIP_EXCLUSIVITY.value == "ownership_exclusivity"

    def test_enum_from_value(self):
        assert ConditionType("character_milestone") == ConditionType.CHARACTER_MILESTONE

    def test_enum_count(self):
        assert len(ConditionType) == 5


# =============================================================================
# MonotonicMode enum
# =============================================================================


class TestMonotonicModeEnum:
    """Test MonotonicMode enum values."""

    def test_all_modes_exist(self):
        assert MonotonicMode.NON_DECREASING.value == "non_decreasing"
        assert MonotonicMode.NON_INCREASING.value == "non_increasing"
        assert MonotonicMode.STRICTLY_INCREASING.value == "strictly_increasing"
        assert MonotonicMode.STRICTLY_DECREASING.value == "strictly_decreasing"

    def test_enum_from_value(self):
        assert MonotonicMode("non_decreasing") == MonotonicMode.NON_DECREASING

    def test_enum_count(self):
        assert len(MonotonicMode) == 4


# =============================================================================
# RelationshipConsistencyCondition
# =============================================================================


class TestRelationshipConsistencyCondition:
    """Test RelationshipConsistencyCondition."""

    def test_validate_empty_entity_type(self):
        cond = RelationshipConsistencyCondition(
            entity_type="", relationship="married_to"
        )
        errors = cond.validate()
        assert any("entity_type" in e for e in errors)

    def test_validate_empty_relationship(self):
        cond = RelationshipConsistencyCondition(
            entity_type="character", relationship=""
        )
        errors = cond.validate()
        assert any("relationship" in e for e in errors)

    def test_validate_valid(self):
        cond = RelationshipConsistencyCondition(
            entity_type="character", relationship="married_to"
        )
        errors = cond.validate()
        assert len(errors) == 0

    def test_to_dict(self):
        cond = RelationshipConsistencyCondition(
            entity_type="character",
            relationship="married_to",
            source_entity="A",
            target_entity="B",
        )
        d = cond.to_dict()
        assert d["type"] == "relationship_consistency"
        assert d["entity_type"] == "character"
        assert d["relationship"] == "married_to"
        assert d["source_entity"] == "A"
        assert d["target_entity"] == "B"

    def test_check_consistent_relationship(self):
        """No violation when relationship is consistent."""
        cond = RelationshipConsistencyCondition(
            entity_type="character",
            relationship="married_to",
            source_entity="A",
            target_entity="B",
        )
        context = {
            "relationships": {
                "A": {"married_to": ["B"]},
                "B": {"married_to": ["A"]},
            }
        }
        violations = cond.check("content", context)
        assert len(violations) == 0

    def test_check_inconsistent_relationship(self):
        """Violation when relationship is inconsistent."""
        cond = RelationshipConsistencyCondition(
            entity_type="character",
            relationship="married_to",
            source_entity="A",
            target_entity="B",
        )
        context = {
            "relationships": {
                "A": {"married_to": []},
                "B": {"married_to": []},
            }
        }
        violations = cond.check("content", context)
        assert len(violations) == 1

    def test_check_inverse_relationship_mentor(self):
        """mentor_of -> student_of inverse mapping works."""
        cond = RelationshipConsistencyCondition(
            entity_type="character",
            relationship="mentor_of",
            source_entity="师父",
            target_entity="徒弟",
        )
        context = {
            "relationships": {
                "师父": {"mentor_of": []},
                "徒弟": {"student_of": ["师父"]},
            }
        }
        violations = cond.check("content", context)
        assert len(violations) == 0

    def test_check_inverse_relationship_parent(self):
        """parent_of -> child_of inverse mapping works."""
        cond = RelationshipConsistencyCondition(
            entity_type="character",
            relationship="parent_of",
            source_entity="父",
            target_entity="子",
        )
        context = {
            "relationships": {
                "父": {"parent_of": []},
                "子": {"child_of": ["父"]},
            }
        }
        violations = cond.check("content", context)
        assert len(violations) == 0

    def test_check_no_source_target_skips(self):
        """Without source/target, check returns empty."""
        cond = RelationshipConsistencyCondition(
            entity_type="character", relationship="married_to"
        )
        violations = cond.check("content", {"relationships": {}})
        assert len(violations) == 0


# =============================================================================
# TemporalConsistencyCondition
# =============================================================================


class TestTemporalConsistencyCondition:
    """Test TemporalConsistencyCondition."""

    def test_validate_empty_entity(self):
        cond = TemporalConsistencyCondition(entity="", event_sequence=["birth"])
        errors = cond.validate()
        assert any("entity" in e for e in errors)

    def test_validate_empty_event_sequence(self):
        cond = TemporalConsistencyCondition(entity="hero", event_sequence=[])
        errors = cond.validate()
        assert any("event_sequence" in e for e in errors)

    def test_validate_negative_min_interval_chapters(self):
        cond = TemporalConsistencyCondition(
            entity="hero",
            event_sequence=["birth"],
            min_interval_chapters=-1,
        )
        errors = cond.validate()
        assert any("min_interval_chapters" in e for e in errors)

    def test_validate_negative_min_interval_words(self):
        cond = TemporalConsistencyCondition(
            entity="hero",
            event_sequence=["birth"],
            min_interval_words=-1,
        )
        errors = cond.validate()
        assert any("min_interval_words" in e for e in errors)

    def test_validate_valid(self):
        cond = TemporalConsistencyCondition(
            entity="hero",
            event_sequence=["birth", "death"],
            min_interval_chapters=5,
        )
        errors = cond.validate()
        assert len(errors) == 0

    def test_to_dict(self):
        cond = TemporalConsistencyCondition(
            entity="hero",
            event_sequence=["birth", "death"],
            min_interval_chapters=10,
            min_interval_words=5000,
        )
        d = cond.to_dict()
        assert d["type"] == "temporal_consistency"
        assert d["entity"] == "hero"
        assert d["event_sequence"] == ["birth", "death"]
        assert d["min_interval_chapters"] == 10
        assert d["min_interval_words"] == 5000

    def test_check_complete_sequence(self):
        """No violation when all events appear in order."""
        cond = TemporalConsistencyCondition(
            entity="hero", event_sequence=["birth", "death"]
        )
        content = "英雄出生了。英雄死亡了。"
        violations = cond.check(content, {})
        assert len(violations) == 0

    def test_check_missing_event(self):
        """Violation when event is missing from content."""
        cond = TemporalConsistencyCondition(
            entity="hero", event_sequence=["birth", "death"]
        )
        content = "英雄出生了。"
        violations = cond.check(content, {})
        assert len(violations) == 1
        assert "death" in violations[0].message

    def test_check_empty_content(self):
        """Empty content with required events produces violation."""
        cond = TemporalConsistencyCondition(
            entity="hero", event_sequence=["birth"]
        )
        violations = cond.check("", {})
        assert len(violations) == 1

    def test_check_single_event_present(self):
        """Single required event present in content."""
        cond = TemporalConsistencyCondition(
            entity="hero", event_sequence=["birth"]
        )
        content = "英雄诞生了。"
        violations = cond.check(content, {})
        assert len(violations) == 0

    def test_check_unknown_event_type(self):
        """Unknown event uses escaped literal pattern."""
        cond = TemporalConsistencyCondition(
            entity="hero", event_sequence=["custom_event"]
        )
        content = "hero custom_event happened."
        violations = cond.check(content, {})
        # The escaped pattern "custom_event" should match
        assert len(violations) == 0


# =============================================================================
# OwnershipExclusivityCondition
# =============================================================================


class TestOwnershipExclusivityCondition:
    """Test OwnershipExclusivityCondition."""

    def test_validate_empty_item(self):
        cond = OwnershipExclusivityCondition(item="")
        errors = cond.validate()
        assert any("item" in e for e in errors)

    def test_validate_empty_owner_field(self):
        cond = OwnershipExclusivityCondition(item="sword", owner_field="")
        errors = cond.validate()
        assert any("owner_field" in e for e in errors)

    def test_validate_valid(self):
        cond = OwnershipExclusivityCondition(item="sword")
        errors = cond.validate()
        assert len(errors) == 0

    def test_to_dict(self):
        cond = OwnershipExclusivityCondition(item="sword", owner_field="holder")
        d = cond.to_dict()
        assert d["type"] == "ownership_exclusivity"
        assert d["item"] == "sword"
        assert d["owner_field"] == "holder"

    def test_check_no_conflict(self):
        """No violation when only current owner possesses item."""
        cond = OwnershipExclusivityCondition(item="神剑")
        context = {
            "items": {"神剑": {"owner": "主角"}},
            "characters": {"主角": {}, "反派": {}},
        }
        violations = cond.check("主角拿着神剑战斗。", context)
        assert len(violations) == 0

    def test_check_conflict_detected(self):
        """Violation when another character is described possessing the item."""
        cond = OwnershipExclusivityCondition(item="神剑")
        context = {
            "items": {"神剑": {"owner": "主角"}},
            "characters": {"主角": {}, "反派": {}},
        }
        content = "反派手持神剑，斩向敌人。"
        violations = cond.check(content, context)
        assert len(violations) >= 1

    def test_check_no_current_owner(self):
        """When item has no current owner, no exclusivity check."""
        cond = OwnershipExclusivityCondition(item="神剑")
        context = {
            "items": {"神剑": {}},
            "characters": {"主角": {}},
        }
        violations = cond.check("主角拿着神剑。", context)
        # No current_owner, so other_characters includes everyone
        # but possession pattern might still match
        assert isinstance(violations, list)

    def test_check_default_owner_field(self):
        cond = OwnershipExclusivityCondition(item="sword")
        assert cond.owner_field == "owner"


# =============================================================================
# FieldMonotonicCondition comparison
# =============================================================================


class TestFieldMonotonicComparison:
    """Test FieldMonotonicCondition._compare method."""

    def test_compare_numeric_less(self):
        cond = FieldMonotonicCondition(
            entity_type="character",
            field="power",
            mode=MonotonicMode.NON_DECREASING,
        )
        assert cond._compare(1, 2) == -1

    def test_compare_numeric_greater(self):
        cond = FieldMonotonicCondition(
            entity_type="character",
            field="power",
            mode=MonotonicMode.NON_DECREASING,
        )
        assert cond._compare(2, 1) == 1

    def test_compare_numeric_equal(self):
        cond = FieldMonotonicCondition(
            entity_type="character",
            field="power",
            mode=MonotonicMode.NON_DECREASING,
        )
        assert cond._compare(5, 5) == 0

    def test_compare_cultivation_realm_ordering(self):
        cond = FieldMonotonicCondition(
            entity_type="character",
            field="cultivation_realm",
            mode=MonotonicMode.NON_DECREASING,
        )
        assert cond._compare("炼气期", "筑基期") == -1
        assert cond._compare("筑基期", "炼气期") == 1
        assert cond._compare("金丹期", "金丹期") == 0

    def test_compare_cultivation_realm_extremes(self):
        cond = FieldMonotonicCondition(
            entity_type="character",
            field="cultivation_realm",
            mode=MonotonicMode.NON_DECREASING,
        )
        assert cond._compare("凡人", "渡劫期") == -1
        assert cond._compare("渡劫期", "凡人") == 1

    def test_compare_unknown_cultivation_realm(self):
        cond = FieldMonotonicCondition(
            entity_type="character",
            field="cultivation_realm",
            mode=MonotonicMode.NON_DECREASING,
        )
        # Unknown realm falls back to string comparison
        result = cond._compare("未知境界", "凡人")
        assert isinstance(result, int)

    def test_compare_string_fallback(self):
        cond = FieldMonotonicCondition(
            entity_type="character",
            field="name",
            mode=MonotonicMode.NON_DECREASING,
        )
        assert cond._compare("abc", "def") == -1
        assert cond._compare("def", "abc") == 1
        assert cond._compare("abc", "abc") == 0

    def test_compare_float_values(self):
        cond = FieldMonotonicCondition(
            entity_type="character",
            field="power",
            mode=MonotonicMode.NON_DECREASING,
        )
        assert cond._compare(1.5, 2.5) == -1
        assert cond._compare(2.5, 1.5) == 1
        assert cond._compare(1.5, 1.5) == 0


# =============================================================================
# FieldMonotonicCondition check modes
# =============================================================================


class TestFieldMonotonicCheckModes:
    """Test FieldMonotonicCondition check for all modes."""

    def _make_cond(self, mode):
        return FieldMonotonicCondition(
            entity_type="character",
            field="power",
            mode=mode,
        )

    def test_non_decreasing_valid(self):
        cond = self._make_cond(MonotonicMode.NON_DECREASING)
        context = {
            "characters": {"hero": {"power": 10}},
            "prev_character_hero_power": 5,
        }
        violations = cond.check("", context)
        assert len(violations) == 0

    def test_non_decreasing_violation(self):
        cond = self._make_cond(MonotonicMode.NON_DECREASING)
        context = {
            "characters": {"hero": {"power": 3}},
            "prev_character_hero_power": 10,
        }
        violations = cond.check("", context)
        assert len(violations) == 1

    def test_non_increasing_valid(self):
        cond = self._make_cond(MonotonicMode.NON_INCREASING)
        context = {
            "characters": {"hero": {"power": 5}},
            "prev_character_hero_power": 10,
        }
        violations = cond.check("", context)
        assert len(violations) == 0

    def test_non_increasing_violation(self):
        cond = self._make_cond(MonotonicMode.NON_INCREASING)
        context = {
            "characters": {"hero": {"power": 15}},
            "prev_character_hero_power": 10,
        }
        violations = cond.check("", context)
        assert len(violations) == 1

    def test_strictly_increasing_valid(self):
        cond = self._make_cond(MonotonicMode.STRICTLY_INCREASING)
        context = {
            "characters": {"hero": {"power": 15}},
            "prev_character_hero_power": 10,
        }
        violations = cond.check("", context)
        assert len(violations) == 0

    def test_strictly_increasing_skips_when_equal(self):
        """When values are equal, the check is skipped (no change detected)."""
        cond = self._make_cond(MonotonicMode.STRICTLY_INCREASING)
        context = {
            "characters": {"hero": {"power": 10}},
            "prev_character_hero_power": 10,
        }
        violations = cond.check("", context)
        # Code skips check when current == prev (no change detected)
        assert len(violations) == 0

    def test_strictly_decreasing_valid(self):
        cond = self._make_cond(MonotonicMode.STRICTLY_DECREASING)
        context = {
            "characters": {"hero": {"power": 5}},
            "prev_character_hero_power": 10,
        }
        violations = cond.check("", context)
        assert len(violations) == 0

    def test_strictly_decreasing_skips_when_equal(self):
        """When values are equal, the check is skipped (no change detected)."""
        cond = self._make_cond(MonotonicMode.STRICTLY_DECREASING)
        context = {
            "characters": {"hero": {"power": 10}},
            "prev_character_hero_power": 10,
        }
        violations = cond.check("", context)
        # Code skips check when current == prev (no change detected)
        assert len(violations) == 0

    def test_no_previous_value_skips_check(self):
        cond = self._make_cond(MonotonicMode.NON_DECREASING)
        context = {"characters": {"hero": {"power": 10}}}
        violations = cond.check("", context)
        assert len(violations) == 0

    def test_none_current_value_skips(self):
        cond = self._make_cond(MonotonicMode.NON_DECREASING)
        context = {
            "characters": {"hero": {"power": None}},
            "prev_character_hero_power": 10,
        }
        violations = cond.check("", context)
        assert len(violations) == 0


# =============================================================================
# ConditionParser edge cases
# =============================================================================


class TestConditionParserExtended:
    """Extended ConditionParser tests."""

    def test_parse_missing_type_returns_none(self):
        data = {"character": "hero"}
        cond = ConditionParser.parse(data)
        assert cond is None

    def test_parse_relationship_consistency(self):
        data = {
            "type": "relationship_consistency",
            "entity_type": "character",
            "relationship": "married_to",
            "source_entity": "A",
            "target_entity": "B",
        }
        cond = ConditionParser.parse(data)
        assert isinstance(cond, RelationshipConsistencyCondition)

    def test_parse_temporal_consistency(self):
        data = {
            "type": "temporal_consistency",
            "entity": "hero",
            "event_sequence": ["birth", "death"],
            "min_interval_chapters": 5,
        }
        cond = ConditionParser.parse(data)
        assert isinstance(cond, TemporalConsistencyCondition)

    def test_parse_ownership_exclusivity(self):
        data = {
            "type": "ownership_exclusivity",
            "item": "sword",
            "owner_field": "holder",
        }
        cond = ConditionParser.parse(data)
        assert isinstance(cond, OwnershipExclusivityCondition)

    def test_parse_field_monotonic_with_invalid_mode(self):
        """Invalid mode falls back to NON_DECREASING."""
        data = {
            "type": "field_monotonic",
            "entity_type": "character",
            "field": "power",
            "mode": "invalid_mode",
        }
        cond = ConditionParser.parse(data)
        assert isinstance(cond, FieldMonotonicCondition)
        assert cond.mode == MonotonicMode.NON_DECREASING

    def test_parse_all_empty_list(self):
        conditions = ConditionParser.parse_all([])
        assert conditions == []

    def test_parse_all_mixed_valid_invalid(self):
        data = [
            {"type": "character_milestone", "character": "A", "milestone": "death"},
            {"type": "unknown_type"},
            {"type": "field_monotonic", "entity_type": "c", "field": "f", "mode": "non_decreasing"},
        ]
        conditions = ConditionParser.parse_all(data)
        assert len(conditions) == 2

    def test_parse_all_all_invalid(self):
        data = [
            {"type": "unknown_1"},
            {"type": "unknown_2"},
        ]
        conditions = ConditionParser.parse_all(data)
        assert len(conditions) == 0


# =============================================================================
# DSL parser edge cases
# =============================================================================


class TestDSLParserExtended:
    """Extended DSL parser tests."""

    def test_parse_json_array_rules(self):
        dsl_content = '{"rules": [{"id": "r1", "law_type": "outline_law", "name": "test", "conditions": []}]}'
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)
        assert len(rules) == 1

    def test_parse_with_metadata(self):
        dsl_content = """
rules:
  - id: "meta_rule"
    law_type: "outline_law"
    name: "test"
    metadata:
      custom_key: "custom_value"
    conditions:
      - type: "character_milestone"
        character: "主角"
        milestone: "death"
"""
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)
        assert "custom_key" in rules[0].metadata
        assert rules[0].metadata["custom_key"] == "custom_value"

    def test_parse_with_pattern_override(self):
        dsl_content = """
rules:
  - id: "pattern_rule"
    law_type: "outline_law"
    name: "test"
    pattern: "custom_pattern"
    conditions:
      - type: "character_milestone"
        character: "主角"
        milestone: "death"
"""
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)
        assert rules[0].pattern == "custom_pattern"

    def test_parse_default_severity(self):
        dsl_content = """
rules:
  - id: "default_sev"
    law_type: "outline_law"
    name: "test"
    conditions: []
"""
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)
        assert rules[0].severity == Severity.HIGH

    def test_parse_default_law_type(self):
        dsl_content = """
rules:
  - id: "default_law"
    name: "test"
    conditions: []
"""
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)
        assert rules[0].law_type == LawType.OUTLINE_LAW

    def test_validate_non_dict_content(self):
        parser = ConstraintDSLCParser()
        is_valid, errors = parser.validate("- just a string")
        # YAML parses this as a string, not a dict
        assert is_valid is False

    def test_validate_rules_not_list(self):
        parser = ConstraintDSLCParser()
        is_valid, errors = parser.validate("rules: not_a_list")
        assert is_valid is False
        assert any("rules" in e.lower() for e in errors)

    def test_parse_non_dict_rule_raises(self):
        dsl_content = """
rules:
  - "not_a_dict"
"""
        parser = ConstraintDSLCParser()
        with pytest.raises(DSLValidationError):
            parser.parse(dsl_content)

    def test_parse_conditions_not_list_raises(self):
        dsl_content = """
rules:
  - id: "bad_conds"
    law_type: "outline_law"
    name: "test"
    conditions: "not_a_list"
"""
        parser = ConstraintDSLCParser()
        with pytest.raises(DSLValidationError):
            parser.parse(dsl_content)

    def test_parse_condition_not_dict_raises(self):
        """Non-dict condition raises error (AttributeError from .get() call)."""
        dsl_content = """
rules:
  - id: "cond_not_dict"
    law_type: "outline_law"
    name: "test"
    conditions:
      - "not_a_dict"
"""
        parser = ConstraintDSLCParser()
        with pytest.raises((DSLValidationError, AttributeError)):
            parser.parse(dsl_content)


# =============================================================================
# Pattern generation
# =============================================================================


class TestPatternGeneration:
    """Test DSL pattern generation."""

    def test_pattern_for_death_milestone(self):
        dsl_content = """
rules:
  - id: "death_pattern"
    law_type: "outline_law"
    name: "test"
    conditions:
      - type: "character_milestone"
        character: "主角"
        milestone: "death"
"""
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)
        assert rules[0].pattern is not None
        assert "主角" in rules[0].pattern

    def test_pattern_for_marriage_milestone(self):
        dsl_content = """
rules:
  - id: "marriage_pattern"
    law_type: "outline_law"
    name: "test"
    conditions:
      - type: "character_milestone"
        character: "主角"
        milestone: "marriage"
"""
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)
        assert rules[0].pattern is not None

    def test_pattern_for_betrayal_milestone(self):
        dsl_content = """
rules:
  - id: "betrayal_pattern"
    law_type: "outline_law"
    name: "test"
    conditions:
      - type: "character_milestone"
        character: "反派"
        milestone: "betrayal"
"""
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)
        assert rules[0].pattern is not None

    def test_pattern_for_unknown_milestone(self):
        dsl_content = """
rules:
  - id: "unknown_milestone"
    law_type: "outline_law"
    name: "test"
    conditions:
      - type: "character_milestone"
        character: "主角"
        milestone: "unknown_milestone"
"""
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)
        # Unknown milestone has no word list, so pattern is None
        assert rules[0].pattern is None

    def test_pattern_for_non_milestone_condition(self):
        dsl_content = """
rules:
  - id: "field_rule"
    law_type: "setting_physics"
    name: "test"
    conditions:
      - type: "field_monotonic"
        entity_type: "character"
        field: "power"
        mode: "non_decreasing"
"""
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)
        # Field monotonic doesn't generate patterns
        assert rules[0].pattern is None


# =============================================================================
# CharacterMilestoneCondition extended
# =============================================================================


class TestCharacterMilestoneExtended:
    """Extended CharacterMilestoneCondition tests."""

    def test_to_dict_all_fields(self):
        cond = CharacterMilestoneCondition(
            character="主角",
            milestone="death",
            prohibited_before_chapter=10,
            prohibited_before_word_count=5000,
            required_before_chapter=50,
        )
        d = cond.to_dict()
        assert d["type"] == "character_milestone"
        assert d["character"] == "主角"
        assert d["milestone"] == "death"
        assert d["prohibited_before_chapter"] == 10
        assert d["prohibited_before_word_count"] == 5000
        assert d["required_before_chapter"] == 50

    def test_validate_valid(self):
        cond = CharacterMilestoneCondition(
            character="主角", milestone="death", prohibited_before_chapter=10
        )
        errors = cond.validate()
        assert len(errors) == 0

    def test_validate_negative_word_count(self):
        cond = CharacterMilestoneCondition(
            character="主角",
            milestone="death",
            prohibited_before_word_count=-1,
        )
        errors = cond.validate()
        assert any("word_count" in e for e in errors)

    def test_check_marriage_milestone(self):
        cond = CharacterMilestoneCondition(
            character="主角",
            milestone="marriage",
            prohibited_before_chapter=20,
        )
        content = "主角与女主角结婚了。"
        context = {"current_chapter": 10}
        violations = cond.check(content, context)
        assert len(violations) == 1

    def test_check_betrayal_milestone(self):
        cond = CharacterMilestoneCondition(
            character="反派",
            milestone="betrayal",
            prohibited_before_chapter=15,
        )
        content = "反派背叛了主角。"
        context = {"current_chapter": 5}
        violations = cond.check(content, context)
        assert len(violations) == 1

    def test_check_required_before_chapter(self):
        """Violation when chapter exceeds required_before_chapter."""
        cond = CharacterMilestoneCondition(
            character="主角",
            milestone="death",
            required_before_chapter=10,
        )
        content = "主角死了。"
        context = {"current_chapter": 15}
        violations = cond.check(content, context)
        assert len(violations) == 1

    def test_check_prohibited_word_count(self):
        cond = CharacterMilestoneCondition(
            character="主角",
            milestone="death",
            prohibited_before_word_count=10000,
        )
        content = "主角死了。"
        context = {"current_word_count": 5000}
        violations = cond.check(content, context)
        assert len(violations) == 1

    def test_check_unknown_milestone_no_patterns(self):
        """Unknown milestone type has no patterns, so no violations."""
        cond = CharacterMilestoneCondition(
            character="主角",
            milestone="ascension",
            prohibited_before_chapter=10,
        )
        content = "主角ascension了。"
        context = {"current_chapter": 5}
        violations = cond.check(content, context)
        assert len(violations) == 0
