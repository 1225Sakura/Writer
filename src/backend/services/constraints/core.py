"""Core data types for the constraint engine.

Defines enums (Severity, LawType, RuleStatus) and dataclasses
(ConstraintRule, ConstraintViolation, ConstraintCheckResult) used
throughout the constraint subsystem.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class Severity(str, Enum):
    """Violation severity levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class LawType(str, Enum):
    """The three anti-hallucination laws."""

    OUTLINE_LAW = "outline_law"          # 大纲即法律
    SETTING_PHYSICS = "setting_physics"  # 设定即物理
    INVENTION_REGISTRATION = "invention_registration"  # 发明需识别


class RuleStatus(str, Enum):
    """Constraint rule status."""

    ACTIVE = "active"
    DISABLED = "disabled"
    DEPRECATED = "deprecated"


@dataclass
class ConstraintRule:
    """A single constraint rule definition.

    Rules can be auto-extracted from settings or manually defined.
    They are stored as JSON in the database (via AIInspectionResult
    or a dedicated JSON field).
    """

    id: str
    law_type: LawType
    name: str
    description: str
    pattern: Optional[str] = None          # Regex pattern for quick detection
    severity: Severity = Severity.HIGH
    status: RuleStatus = RuleStatus.ACTIVE
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "law_type": self.law_type.value,
            "name": self.name,
            "description": self.description,
            "pattern": self.pattern,
            "severity": self.severity.value,
            "status": self.status.value,
            "metadata": self.metadata,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ConstraintRule:
        return cls(
            id=data["id"],
            law_type=LawType(data.get("law_type", "outline_law")),
            name=data["name"],
            description=data.get("description", ""),
            pattern=data.get("pattern"),
            severity=Severity(data.get("severity", "high")),
            status=RuleStatus(data.get("status", "active")),
            metadata=data.get("metadata", {}),
            created_at=data.get("created_at", datetime.utcnow().isoformat()),
        )


@dataclass
class ConstraintViolation:
    """A detected constraint violation."""

    rule_id: str
    law_type: LawType
    severity: Severity
    message: str
    evidence: str = ""                     # Text snippet showing the violation
    location: Optional[str] = None         # Where in the text (e.g., "paragraph 3")
    suggestion: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "rule_id": self.rule_id,
            "law_type": self.law_type.value,
            "severity": self.severity.value,
            "message": self.message,
            "evidence": self.evidence,
            "location": self.location,
            "suggestion": self.suggestion,
            "metadata": self.metadata,
        }


@dataclass
class ConstraintCheckResult:
    """Result of a full constraint check."""

    passed: bool
    overall_score: int                     # 0-100
    violations: list[ConstraintViolation] = field(default_factory=list)
    rules_checked: list[str] = field(default_factory=list)
    summary: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "passed": self.passed,
            "overall_score": self.overall_score,
            "violations": [v.to_dict() for v in self.violations],
            "rules_checked": self.rules_checked,
            "summary": self.summary,
            "metadata": self.metadata,
        }
