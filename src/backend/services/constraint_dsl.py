"""Constraint DSL Parser - YAML/JSON DSL for defining constraint rules.

This module provides:
- DSLCondition: Base class for DSL condition types
- Condition parsers for each condition type:
  - CharacterMilestoneCondition
  - FieldMonotonicCondition
  - RelationshipConsistencyCondition
  - TemporalConsistencyCondition
  - OwnershipExclusivityCondition
- ConstraintDSLCParser: Parses YAML/JSON DSL into ConstraintRule objects
- DSLValidationError: Custom exception for DSL validation errors
"""

from __future__ import annotations

import json
import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING, Any, Optional

import yaml

if TYPE_CHECKING:
    from backend.services.constraint_engine import (
        ConstraintRule,
        ConstraintViolation,
        LawType,
        RuleStatus,
        Severity,
    )

logger = logging.getLogger(__name__)


class ConditionType(str, Enum):
    """DSL condition types."""
    CHARACTER_MILESTONE = "character_milestone"
    FIELD_MONOTONIC = "field_monotonic"
    RELATIONSHIP_CONSISTENCY = "relationship_consistency"
    TEMPORAL_CONSISTENCY = "temporal_consistency"
    OWNERSHIP_EXCLUSIVITY = "ownership_exclusivity"


class MonotonicMode(str, Enum):
    """Field monotonicity modes."""
    NON_DECREASING = "non_decreasing"
    NON_INCREASING = "non_increasing"
    STRICTLY_INCREASING = "strictly_increasing"
    STRICTLY_DECREASING = "strictly_decreasing"


@dataclass
class DSLCondition(ABC):
    """Base class for DSL conditions."""

    @abstractmethod
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation."""
        pass

    @abstractmethod
    def validate(self) -> list[str]:
        """Validate the condition. Returns list of error messages."""
        pass

    @abstractmethod
    def check(
        self,
        content: str,
        context: dict[str, Any],
    ) -> list[ConstraintViolation]:
        """Check this condition against content. Returns violations."""
        pass


@dataclass
class CharacterMilestoneCondition(DSLCondition):
    """Character milestone condition.

    Enforces that a character cannot reach a certain milestone
    (e.g., death, marriage) before a specific chapter.
    """
    character: str
    milestone: str  # e.g., "death", "marriage", "betrayal"
    prohibited_before_chapter: Optional[int] = None
    prohibited_before_word_count: Optional[int] = None
    required_before_chapter: Optional[int] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": ConditionType.CHARACTER_MILESTONE.value,
            "character": self.character,
            "milestone": self.milestone,
            "prohibited_before_chapter": self.prohibited_before_chapter,
            "prohibited_before_word_count": self.prohibited_before_word_count,
            "required_before_chapter": self.required_before_chapter,
        }

    def validate(self) -> list[str]:
        errors = []
        if not self.character:
            errors.append("character cannot be empty")
        if not self.milestone:
            errors.append("milestone cannot be empty")
        if self.prohibited_before_chapter is not None and self.prohibited_before_chapter < 0:
            errors.append("prohibited_before_chapter must be non-negative")
        if self.prohibited_before_word_count is not None and self.prohibited_before_word_count < 0:
            errors.append("prohibited_before_word_count must be non-negative")
        return errors

    def check(
        self,
        content: str,
        context: dict[str, Any],
    ) -> list["ConstraintViolation"]:
        # Lazy import to avoid circular dependency
        from backend.services.constraint_engine import ConstraintViolation, LawType, Severity

        violations = []

        # Detect milestone in content
        milestone_patterns = {
            "death": [
                rf"{re.escape(self.character)}[^。！？]{{0,20}}(?:死了|死亡|陨落|牺牲|阵亡|毙命|断气|身亡|殒命)",
                rf"(?:死了|死亡|陨落|牺牲|阵亡)的[^。！？]{{0,10}}{re.escape(self.character)}",
            ],
            "marriage": [
                rf"{re.escape(self.character)}[^。！？]{{0,20}}(?:结婚|成婚|大喜|完婚|拜堂)",
                rf"(?:结婚|成婚)的[^。！？]{{0,10}}{re.escape(self.character)}",
            ],
            "betrayal": [
                rf"{re.escape(self.character)}[^。！？]{{0,20}}(?:背叛|反叛|叛变|出卖|背叛)",
                rf"(?:背叛|反叛|叛变)的[^。！？]{{0,10}}{re.escape(self.character)}",
            ],
        }

        patterns = milestone_patterns.get(self.milestone, [])
        current_chapter = context.get("current_chapter", 0)
        current_word_count = context.get("current_word_count", 0)

        for pattern in patterns:
            match = re.search(pattern, content)
            if match:
                # Check prohibited_before_chapter
                if self.prohibited_before_chapter is not None:
                    if current_chapter < self.prohibited_before_chapter:
                        violations.append(ConstraintViolation(
                            rule_id=f"character_milestone_{self.character}_{self.milestone}",
                            law_type=LawType.OUTLINE_LAW,
                            severity=Severity.CRITICAL,
                            message=f"角色'{self.character}'在第{self.milestone}之前不能达到里程碑'{self.milestone}'（禁止在第{self.prohibited_before_chapter}章前{self.milestone}）",
                            evidence=match.group(0),
                            suggestion=f"请延迟该角色的{self.milestone}剧情至第{self.prohibited_before_chapter}章之后",
                        ))

                # Check prohibited_before_word_count
                if self.prohibited_before_word_count is not None:
                    if current_word_count < self.prohibited_before_word_count:
                        violations.append(ConstraintViolation(
                            rule_id=f"character_milestone_{self.character}_{self.milestone}",
                            law_type=LawType.OUTLINE_LAW,
                            severity=Severity.CRITICAL,
                            message=f"角色'{self.character}'在{self.milestone}前不能达到里程碑'{self.milestone}'（禁止在{self.prohibited_before_word_count}字前{self.milestone}）",
                            evidence=match.group(0),
                            suggestion=f"请延迟该角色的{self.milestone}剧情至{self.prohibited_before_word_count}字之后",
                        ))

                # Check required_before_chapter
                if self.required_before_chapter is not None:
                    if current_chapter > self.required_before_chapter:
                        violations.append(ConstraintViolation(
                            rule_id=f"character_milestone_{self.character}_{self.milestone}",
                            law_type=LawType.OUTLINE_LAW,
                            severity=Severity.HIGH,
                            message=f"角色'{self.character}'必须在第{self.required_before_chapter}章前达到里程碑'{self.milestone}'",
                            evidence=match.group(0),
                            suggestion="请在规定章节前添加该里程碑剧情",
                        ))

        return violations


@dataclass
class FieldMonotonicCondition(DSLCondition):
    """Field monotonicity condition.

    Enforces that a numeric or comparable field value
    must be non-decreasing, non-increasing, strictly increasing,
    or strictly decreasing.
    """
    entity_type: str  # e.g., "character", "item"
    field: str  # e.g., "cultivation_realm", "power_level"
    mode: MonotonicMode
    previous_value: Optional[Any] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": ConditionType.FIELD_MONOTONIC.value,
            "entity_type": self.entity_type,
            "field": self.field,
            "mode": self.mode.value,
            "previous_value": self.previous_value,
        }

    def validate(self) -> list[str]:
        errors = []
        if not self.entity_type:
            errors.append("entity_type cannot be empty")
        if not self.field:
            errors.append("field cannot be empty")
        if not self.mode:
            errors.append("mode cannot be empty")
        return errors

    def check(
        self,
        content: str,
        context: dict[str, Any],
    ) -> list["ConstraintViolation"]:
        # Lazy import to avoid circular dependency
        from backend.services.constraint_engine import ConstraintViolation, LawType, Severity

        violations = []

        # Get current entity states from context
        entities = context.get(f"{self.entity_type}s", {})
        current_chapter = context.get("current_chapter", 0)

        for entity_name, entity_data in entities.items():
            current_value = entity_data.get(self.field)
            if current_value is None:
                continue

            # Get previous chapter's value from context
            prev_key = f"prev_{self.entity_type}_{entity_name}_{self.field}"
            prev_value = context.get(prev_key)

            if prev_value is not None and current_value != prev_value:
                # Check monotonicity
                if self.mode == MonotonicMode.NON_DECREASING:
                    if self._compare(current_value, prev_value) < 0:
                        violations.append(ConstraintViolation(
                            rule_id=f"field_monotonic_{self.entity_type}_{self.field}",
                            law_type=LawType.SETTING_PHYSICS,
                            severity=Severity.HIGH,
                            message=f"实体'{entity_name}'的{self.field}从{prev_value}降级到{current_value}，违反了非递减规则",
                            evidence=f"{self.field}: {prev_value} -> {current_value}",
                            suggestion="修为境界不能降级，请修正",
                        ))
                elif self.mode == MonotonicMode.NON_INCREASING:
                    if self._compare(current_value, prev_value) > 0:
                        violations.append(ConstraintViolation(
                            rule_id=f"field_monotonic_{self.entity_type}_{self.field}",
                            law_type=LawType.SETTING_PHYSICS,
                            severity=Severity.HIGH,
                            message=f"实体'{entity_name}'的{self.field}从{prev_value}升级到{current_value}，违反了非递增规则",
                            evidence=f"{self.field}: {prev_value} -> {current_value}",
                            suggestion="该字段不能升级，请修正",
                        ))
                elif self.mode == MonotonicMode.STRICTLY_INCREASING:
                    if self._compare(current_value, prev_value) <= 0:
                        violations.append(ConstraintViolation(
                            rule_id=f"field_monotonic_{self.entity_type}_{self.field}",
                            law_type=LawType.SETTING_PHYSICS,
                            severity=Severity.CRITICAL,
                            message=f"实体'{entity_name}'的{self.field}必须严格递增，但未能增加",
                            evidence=f"{self.field}: {prev_value} -> {current_value}",
                            suggestion="该字段必须严格增加，请修正",
                        ))
                elif self.mode == MonotonicMode.STRICTLY_DECREASING:
                    if self._compare(current_value, prev_value) >= 0:
                        violations.append(ConstraintViolation(
                            rule_id=f"field_monotonic_{self.entity_type}_{self.field}",
                            law_type=LawType.SETTING_PHYSICS,
                            severity=Severity.CRITICAL,
                            message=f"实体'{entity_name}'的{self.field}必须严格递减，但未能减少",
                            evidence=f"{self.field}: {prev_value} -> {current_value}",
                            suggestion="该字段必须严格减少，请修正",
                        ))

        return violations

    def _compare(self, a: Any, b: Any) -> int:
        """Compare two values. Returns -1 if a < b, 0 if a == b, 1 if a > b."""
        if isinstance(a, (int, float)) and isinstance(b, (int, float)):
            if a < b:
                return -1
            elif a > b:
                return 1
            return 0

        # String comparison for cultivation realms
        cultivation_order = [
            "凡人", "炼气期", "筑基期", "金丹期", "元婴期",
            "化神期", "炼虚期", "合体期", "大乘期", "渡劫期",
        ]
        if self.field == "cultivation_realm":
            a_idx = next((i for i, r in enumerate(cultivation_order) if r == a), -1)
            b_idx = next((i for i, r in enumerate(cultivation_order) if r == b), -1)
            if a_idx < b_idx:
                return -1
            elif a_idx > b_idx:
                return 1
            return 0

        # Fallback to string comparison
        if a < b:
            return -1
        elif a > b:
            return 1
        return 0


@dataclass
class RelationshipConsistencyCondition(DSLCondition):
    """Relationship consistency condition.

    Enforces that relationships between entities remain consistent
    (e.g., if A is married to B, B is married to A).
    """
    entity_type: str
    relationship: str  # e.g., "married_to", "enemy_of", "mentor_of"
    source_entity: Optional[str] = None
    target_entity: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": ConditionType.RELATIONSHIP_CONSISTENCY.value,
            "entity_type": self.entity_type,
            "relationship": self.relationship,
            "source_entity": self.source_entity,
            "target_entity": self.target_entity,
        }

    def validate(self) -> list[str]:
        errors = []
        if not self.entity_type:
            errors.append("entity_type cannot be empty")
        if not self.relationship:
            errors.append("relationship cannot be empty")
        return errors

    def check(
        self,
        content: str,
        context: dict[str, Any],
    ) -> list["ConstraintViolation"]:
        # Lazy import to avoid circular dependency
        from backend.services.constraint_engine import ConstraintViolation, LawType, Severity

        violations = []

        relationships = context.get("relationships", {})
        current_chapter = context.get("current_chapter", 0)

        # Check if source_entity has the relationship with target_entity
        if self.source_entity and self.target_entity:
            source_rels = relationships.get(self.source_entity, {})
            expected_target_rels = source_rels.get(self.relationship, [])

            if self.target_entity not in expected_target_rels:
                # Check if the inverse relationship exists
                target_rels = relationships.get(self.target_entity, {})
                inverse_rel = self._get_inverse_relationship(self.relationship)
                inverse_targets = target_rels.get(inverse_rel, [])

                if self.source_entity not in inverse_targets:
                    violations.append(ConstraintViolation(
                        rule_id=f"relationship_consistency_{self.source_entity}_{self.relationship}_{self.target_entity}",
                        law_type=LawType.SETTING_PHYSICS,
                        severity=Severity.HIGH,
                        message=f"实体'{self.source_entity}'与'{self.target_entity}'的'{self.relationship}'关系不一致",
                        evidence=f"expected {self.target_entity} in {self.relationship}",
                        suggestion="请确保双向关系一致",
                    ))

        return violations

    def _get_inverse_relationship(self, rel: str) -> str:
        """Get the inverse relationship name."""
        inverse_map = {
            "married_to": "married_to",
            "enemy_of": "enemy_of",
            "friend_of": "friend_of",
            "mentor_of": "student_of",
            "student_of": "mentor_of",
            "parent_of": "child_of",
            "child_of": "parent_of",
            "sibling_of": "sibling_of",
            "master_of": "servant_of",
            "servant_of": "master_of",
        }
        return inverse_map.get(rel, rel)


@dataclass
class TemporalConsistencyCondition(DSLCondition):
    """Temporal consistency condition.

    Enforces that event sequences are valid
    (e.g., a character cannot be in two places at once).
    """
    entity: str
    event_sequence: list[str]  # Required sequence of events
    min_interval_chapters: Optional[int] = None
    min_interval_words: Optional[int] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": ConditionType.TEMPORAL_CONSISTENCY.value,
            "entity": self.entity,
            "event_sequence": self.event_sequence,
            "min_interval_chapters": self.min_interval_chapters,
            "min_interval_words": self.min_interval_words,
        }

    def validate(self) -> list[str]:
        errors = []
        if not self.entity:
            errors.append("entity cannot be empty")
        if not self.event_sequence:
            errors.append("event_sequence cannot be empty")
        if self.min_interval_chapters is not None and self.min_interval_chapters < 0:
            errors.append("min_interval_chapters must be non-negative")
        if self.min_interval_words is not None and self.min_interval_words < 0:
            errors.append("min_interval_words must be non-negative")
        return errors

    def check(
        self,
        content: str,
        context: dict[str, Any],
    ) -> list["ConstraintViolation"]:
        # Lazy import to avoid circular dependency
        from backend.services.constraint_engine import ConstraintViolation, LawType, Severity

        violations = []

        # Detect events in content
        detected_events: list[tuple[str, int]] = []  # (event, position)

        for event in self.event_sequence:
            patterns = self._get_event_patterns(event)
            for pattern in patterns:
                for match in re.finditer(pattern, content):
                    detected_events.append((event, match.start()))

        # Sort by position
        detected_events.sort(key=lambda x: x[1])

        # Check sequence
        expected_idx = 0
        for event, pos in detected_events:
            if event == self.event_sequence[expected_idx]:
                expected_idx += 1
                if expected_idx >= len(self.event_sequence):
                    break

        if expected_idx < len(self.event_sequence):
            missing = self.event_sequence[expected_idx]
            violations.append(ConstraintViolation(
                rule_id=f"temporal_consistency_{self.entity}",
                law_type=LawType.OUTLINE_LAW,
                severity=Severity.MEDIUM,
                message=f"实体'{self.entity}'的事件序列不完整，缺少'{missing}'",
                evidence=f"expected sequence: {' -> '.join(self.event_sequence)}",
                suggestion=f"请在剧情中添加{missing}事件",
            ))

        return violations

    def _get_event_patterns(self, event: str) -> list[str]:
        """Get regex patterns for an event."""
        patterns_map = {
            "birth": [r"出生", r"诞生", r"降生"],
            "death": [r"死亡", r"去世", r"牺牲", r"陨落"],
            "marriage": [r"结婚", r"成婚", r"大婚"],
            "first_meeting": [r"初次见面", r"第一次见面", r"相遇"],
            "betrayal": [r"背叛", r"叛变"],
            "reconciliation": [r"和解", r"和好", r"重归于好"],
        }
        return patterns_map.get(event, [re.escape(event)])


@dataclass
class OwnershipExclusivityCondition(DSLCondition):
    """Ownership exclusivity condition.

    Enforces that an item can only be owned by one character at a time.
    """
    item: str
    owner_field: str = "owner"

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": ConditionType.OWNERSHIP_EXCLUSIVITY.value,
            "item": self.item,
            "owner_field": self.owner_field,
        }

    def validate(self) -> list[str]:
        errors = []
        if not self.item:
            errors.append("item cannot be empty")
        if not self.owner_field:
            errors.append("owner_field cannot be empty")
        return errors

    def check(
        self,
        content: str,
        context: dict[str, Any],
    ) -> list["ConstraintViolation"]:
        # Lazy import to avoid circular dependency
        from backend.services.constraint_engine import ConstraintViolation, LawType, Severity

        violations = []

        # Track which characters have the item
        items = context.get("items", {})
        item_data = items.get(self.item, {})
        current_owner = item_data.get(self.owner_field)

        # Check if another character is described as having the item
        other_characters = [
            c for c in context.get("characters", {}).keys()
            if c != current_owner
        ]

        for char in other_characters:
            possession_patterns = [
                rf"{re.escape(char)}[^。！？]{{0,15}}(?:拥有|持有|拿着|拿着|腰佩|手持){re.escape(self.item)}",
                rf"{re.escape(self.item)}[^。！？]{{0,15}}(?:在|属于){re.escape(char)}",
            ]

            for pattern in possession_patterns:
                if re.search(pattern, content):
                    violations.append(ConstraintViolation(
                        rule_id=f"ownership_exclusivity_{self.item}",
                        law_type=LawType.SETTING_PHYSICS,
                        severity=Severity.HIGH,
                        message=f"物品'{self.item}'已被'{current_owner}'拥有，不能同时被'{char}'拥有",
                        evidence=f"{char} possession pattern matched",
                        suggestion=f"请确保'{self.item}'的归属权不冲突",
                    ))

        return violations


class ConditionParser:
    """Parses condition dictionaries into DSLCondition objects."""

    _parsers: dict[str, type[DSLCondition]] = {
        ConditionType.CHARACTER_MILESTONE.value: CharacterMilestoneCondition,
        ConditionType.FIELD_MONOTONIC.value: FieldMonotonicCondition,
        ConditionType.RELATIONSHIP_CONSISTENCY.value: RelationshipConsistencyCondition,
        ConditionType.TEMPORAL_CONSISTENCY.value: TemporalConsistencyCondition,
        ConditionType.OWNERSHIP_EXCLUSIVITY.value: OwnershipExclusivityCondition,
    }

    @classmethod
    def parse(cls, data: dict[str, Any]) -> Optional[DSLCondition]:
        """Parse a condition dictionary into a DSLCondition object."""
        cond_type = data.get("type")
        if not cond_type:
            logger.warning("Condition missing 'type' field: %s", data)
            return None

        parser_class = cls._parsers.get(cond_type)
        if not parser_class:
            logger.warning("Unknown condition type '%s': %s", cond_type, data)
            return None

        try:
            if cond_type == ConditionType.CHARACTER_MILESTONE.value:
                return CharacterMilestoneCondition(
                    character=data.get("character", ""),
                    milestone=data.get("milestone", ""),
                    prohibited_before_chapter=data.get("prohibited_before_chapter"),
                    prohibited_before_word_count=data.get("prohibited_before_word_count"),
                    required_before_chapter=data.get("required_before_chapter"),
                )
            elif cond_type == ConditionType.FIELD_MONOTONIC.value:
                mode_str = data.get("mode", "non_decreasing")
                try:
                    mode = MonotonicMode(mode_str)
                except ValueError:
                    mode = MonotonicMode.NON_DECREASING
                return FieldMonotonicCondition(
                    entity_type=data.get("entity_type", ""),
                    field=data.get("field", ""),
                    mode=mode,
                    previous_value=data.get("previous_value"),
                )
            elif cond_type == ConditionType.RELATIONSHIP_CONSISTENCY.value:
                return RelationshipConsistencyCondition(
                    entity_type=data.get("entity_type", ""),
                    relationship=data.get("relationship", ""),
                    source_entity=data.get("source_entity"),
                    target_entity=data.get("target_entity"),
                )
            elif cond_type == ConditionType.TEMPORAL_CONSISTENCY.value:
                return TemporalConsistencyCondition(
                    entity=data.get("entity", ""),
                    event_sequence=data.get("event_sequence", []),
                    min_interval_chapters=data.get("min_interval_chapters"),
                    min_interval_words=data.get("min_interval_words"),
                )
            elif cond_type == ConditionType.OWNERSHIP_EXCLUSIVITY.value:
                return OwnershipExclusivityCondition(
                    item=data.get("item", ""),
                    owner_field=data.get("owner_field", "owner"),
                )
        except Exception as e:
            logger.error("Failed to parse condition %s: %s", data, e)
            return None

        return None

    @classmethod
    def parse_all(cls, conditions_data: list[dict[str, Any]]) -> list[DSLCondition]:
        """Parse a list of condition dictionaries."""
        conditions = []
        for data in conditions_data:
            cond = cls.parse(data)
            if cond:
                conditions.append(cond)
        return conditions


class DSLValidationError(Exception):
    """Exception raised for DSL validation errors."""

    def __init__(self, message: str, errors: Optional[list[str]] = None) -> None:
        super().__init__(message)
        self.errors = errors or []


class ConstraintDSLCParser:
    """Parser for Constraint DSL in YAML/JSON format.

    Example YAML format:

    ```yaml
    rules:
      - id: "no_character_death_before_chapter_10"
        law_type: "outline_law"
        name: "主角保命规则"
        description: "主角不能在第10章前死亡"
        conditions:
          - type: "character_milestone"
            character: "主角"
            milestone: "death"
            prohibited_before_chapter: 10
        severity: "critical"

      - id: "cultivation_realm_consistency"
        law_type: "setting_physics"
        name: "修为境界一致性"
        description: "角色修为境界不能降级"
        conditions:
          - type: "field_monotonic"
            entity_type: "character"
            field: "cultivation_realm"
            mode: "non_decreasing"
        severity: "high"
    ```
    """

    def __init__(self) -> None:
        self._errors: list[str] = []

    def parse(self, dsl_content: str) -> list[ConstraintRule]:
        """Parse DSL content (YAML or JSON) into ConstraintRule objects.

        Args:
            dsl_content: YAML or JSON string containing rule definitions.

        Returns:
            List of ConstraintRule objects.

        Raises:
            DSLValidationError: If the DSL content is invalid.
        """
        self._errors = []

        # Try to parse as YAML first, then JSON
        try:
            data = yaml.safe_load(dsl_content)
        except yaml.YAMLError:
            try:
                data = json.loads(dsl_content)
            except json.JSONDecodeError as e:
                raise DSLValidationError(
                    f"Failed to parse DSL content as YAML or JSON: {e}",
                    [str(e)]
                )

        if not isinstance(data, dict):
            raise DSLValidationError(
                "DSL content must be a dictionary/object",
                [f"Got {type(data).__name__} instead"]
            )

        rules_data = data.get("rules", [])
        if not isinstance(rules_data, list):
            raise DSLValidationError(
                "'rules' must be a list",
                [f"Got {type(rules_data).__name__} instead"]
            )

        rules = []
        for idx, rule_data in enumerate(rules_data):
            try:
                rule = self._parse_rule(rule_data, idx)
                if rule:
                    rules.append(rule)
            except DSLValidationError:
                raise
            except Exception as e:
                self._errors.append(f"Rule {idx}: {str(e)}")

        if self._errors:
            raise DSLValidationError(
                f"DSL validation completed with {len(self._errors)} error(s)",
                self._errors
            )

        return rules

    def _parse_rule(self, data: dict[str, Any], idx: int) -> "ConstraintRule":
        """Parse a single rule from the DSL data."""
        # Lazy import to avoid circular dependency
        from backend.services.constraint_engine import ConstraintRule, LawType, RuleStatus, Severity

        if not isinstance(data, dict):
            raise DSLValidationError(
                f"Rule {idx} must be an object",
                [f"Got {type(data).__name__} instead"]
            )

        rule_id = data.get("id")
        if not rule_id:
            raise DSLValidationError(
                f"Rule {idx} missing required field 'id'",
                [f"Rule {idx} must have an 'id' field"]
            )

        # Validate conditions
        conditions_data = data.get("conditions", [])
        if not isinstance(conditions_data, list):
            raise DSLValidationError(
                f"Rule '{rule_id}' 'conditions' must be a list",
                [f"Got {type(conditions_data).__name__} instead"]
            )

        conditions = ConditionParser.parse_all(conditions_data)
        cond_errors = []
        for cond in conditions:
            cond_errors.extend(cond.validate())

        if cond_errors:
            raise DSLValidationError(
                f"Rule '{rule_id}' has invalid conditions",
                cond_errors
            )

        # Parse law_type
        law_type_str = data.get("law_type", "outline_law")
        try:
            law_type = LawType(law_type_str)
        except ValueError:
            raise DSLValidationError(
                f"Rule '{rule_id}' has invalid law_type '{law_type_str}'",
                [f"Valid values: {[e.value for e in LawType]}"]
            )

        # Parse severity
        severity_str = data.get("severity", "high")
        try:
            severity = Severity(severity_str)
        except ValueError:
            raise DSLValidationError(
                f"Rule '{rule_id}' has invalid severity '{severity_str}'",
                [f"Valid values: {[e.value for e in Severity]}"]
            )

        # Build metadata with conditions
        metadata = data.get("metadata", {})
        metadata["conditions"] = [c.to_dict() for c in conditions]

        # Generate pattern for quick detection if not provided
        pattern = data.get("pattern")
        if not pattern and conditions:
            pattern = self._generate_pattern(conditions)

        return ConstraintRule(
            id=rule_id,
            law_type=law_type,
            name=data.get("name", rule_id),
            description=data.get("description", ""),
            pattern=pattern,
            severity=severity,
            status=RuleStatus.ACTIVE,
            metadata=metadata,
        )

    def _generate_pattern(self, conditions: list[DSLCondition]) -> Optional[str]:
        """Generate a regex pattern for quick detection from conditions."""
        patterns = []

        for cond in conditions:
            if isinstance(cond, CharacterMilestoneCondition):
                # Generate pattern for milestone detection
                milestone_words = {
                    "death": ["死了", "死亡", "陨落", "牺牲"],
                    "marriage": ["结婚", "成婚"],
                    "betrayal": ["背叛", "叛变"],
                }
                words = milestone_words.get(cond.milestone, [])
                if words:
                    char_pattern = re.escape(cond.character)
                    word_patterns = [f"{char_pattern}.{{0,20}}{w}" for w in words]
                    patterns.append("|".join(word_patterns))

        if patterns:
            return "|".join(patterns)
        return None

    def validate(self, dsl_content: str) -> tuple[bool, list[str]]:
        """Validate DSL content without parsing it into rules.

        Args:
            dsl_content: YAML or JSON string containing rule definitions.

        Returns:
            Tuple of (is_valid, error_messages).
        """
        # Lazy import to avoid circular dependency
        from backend.services.constraint_engine import LawType, Severity

        errors: list[str] = []

        try:
            # Try to parse as YAML first, then JSON
            try:
                data = yaml.safe_load(dsl_content)
            except yaml.YAMLError:
                try:
                    data = json.loads(dsl_content)
                except json.JSONDecodeError as e:
                    errors.append(f"Invalid syntax: {e}")
                    return False, errors

            if not isinstance(data, dict):
                errors.append("Content must be a dictionary/object")
                return False, errors

            rules_data = data.get("rules", [])
            if not isinstance(rules_data, list):
                errors.append("'rules' must be a list")
                return False, errors

            for idx, rule_data in enumerate(rules_data):
                if not isinstance(rule_data, dict):
                    errors.append(f"Rule {idx} must be an object")
                    continue

                rule_id = rule_data.get("id")
                if not rule_id:
                    errors.append(f"Rule {idx} missing 'id' field")

                # Validate law_type
                law_type_str = rule_data.get("law_type", "outline_law")
                try:
                    LawType(law_type_str)
                except ValueError:
                    errors.append(f"Rule '{rule_id or idx}' has invalid law_type")

                # Validate severity
                severity_str = rule_data.get("severity", "high")
                try:
                    Severity(severity_str)
                except ValueError:
                    errors.append(f"Rule '{rule_id or idx}' has invalid severity")

                # Validate conditions
                conditions_data = rule_data.get("conditions", [])
                if not isinstance(conditions_data, list):
                    errors.append(f"Rule '{rule_id}' 'conditions' must be a list")
                else:
                    for c_idx, cond_data in enumerate(conditions_data):
                        if not isinstance(cond_data, dict):
                            errors.append(f"Rule '{rule_id}' condition {c_idx} must be an object")
                            continue

                        cond_type = cond_data.get("type")
                        if not cond_type:
                            errors.append(f"Rule '{rule_id}' condition {c_idx} missing 'type'")
                        elif cond_type not in [e.value for e in ConditionType]:
                            errors.append(f"Rule '{rule_id}' condition {c_idx} has unknown type '{cond_type}'")

        except Exception as e:
            errors.append(f"Validation error: {str(e)}")

        return len(errors) == 0, errors
